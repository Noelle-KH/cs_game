'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import * as ExcelJS from 'exceljs'
import styles from './questions.module.css'
import { QuestionDoc, QuestionType, Difficulty } from '@/types'
import {
  getFirestoreQuestions,
  toggleQuestionEnabledFirestore,
  saveSingleQuestionFirestore,
  deleteQuestionSoftFirestore,
  importQuestionsToFirestore,
} from '@/lib/questionStore'

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionDoc[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState<string>('')

  // Modal 狀態
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentEdit, setCurrentEdit] = useState<Partial<QuestionDoc>>({})

  // Excel 匯入 Modal 狀態
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importMode, setImportMode] = useState<'append' | 'upsert'>('append')
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [isSubmittingImport, setIsSubmittingImport] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 載入 Firestore 雲端資料
  const fetchCloudQuestions = async () => {
    setLoadingQuestions(true)
    const data = await getFirestoreQuestions()
    setQuestions(data)
    setLoadingQuestions(false)
  }

  useEffect(() => {
    fetchCloudQuestions()
  }, [])

  // 篩選題目
  const filteredQuestions = questions.filter((q) => {
    if (filterType !== 'all' && q.type !== filterType) return false
    if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      const matchContent = q.content.toLowerCase().includes(kw)
      const matchContext = q.context?.toLowerCase().includes(kw) || false
      const matchId = q.id.toLowerCase().includes(kw)
      if (!matchContent && !matchContext && !matchId) return false
    }
    return true
  })

  // 開關啟用/停用
  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    setLoadingQuestions(true)
    const updated = await toggleQuestionEnabledFirestore(id, currentEnabled)
    setQuestions(updated)
    setLoadingQuestions(false)
  }

  // 軟刪除題目
  const handleDelete = async (id: string) => {
    if (confirm('確定要停用/軟刪除此題目嗎？（該題目將不發送至測驗考場）')) {
      setLoadingQuestions(true)
      const updated = await deleteQuestionSoftFirestore(id)
      setQuestions(updated)
      setLoadingQuestions(false)
    }
  }

  // 打開新增/編輯彈窗
  const openEditModal = (q?: QuestionDoc) => {
    if (q) {
      setCurrentEdit({ ...q })
    } else {
      setCurrentEdit({
        id: `q-cloud-${Date.now()}`,
        type: 'choice',
        difficulty: 'medium',
        context: '',
        content: '',
        options: { A: '', B: '', C: '', D: '' },
        answer: 'A',
        explanation: '',
        enabled: true,
        sourceId: 'manual',
      })
    }
    setEditModalOpen(true)
  }

  // 儲存編輯內容至 Firestore
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEdit.content || !currentEdit.type || !currentEdit.difficulty) {
      alert('請填寫題目主文、題型與難易度！')
      return
    }

    const docToSave: QuestionDoc = {
      id: currentEdit.id || `q-cloud-${Date.now()}`,
      type: currentEdit.type as QuestionType,
      difficulty: currentEdit.difficulty as Difficulty,
      context: currentEdit.context || '',
      content: currentEdit.content,
      options: currentEdit.type === 'choice' ? currentEdit.options : undefined,
      answer: currentEdit.answer || '',
      explanation: currentEdit.explanation || '',
      enabled: currentEdit.enabled !== undefined ? currentEdit.enabled : true,
      sourceId: currentEdit.sourceId || 'manual',
      syncedAt: new Date(),
    }

    setLoadingQuestions(true)
    const updated = await saveSingleQuestionFirestore(docToSave)
    setQuestions(updated)
    setLoadingQuestions(false)
    setEditModalOpen(false)
  }

  // 處理上傳 Excel 解析
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const workbook = new ExcelJS.Workbook()
      const arrayBuffer = await file.arrayBuffer()
      await workbook.xlsx.load(arrayBuffer)

      const worksheet = workbook.getWorksheet('題庫導入模板') || workbook.worksheets[0]
      if (!worksheet) {
        alert('無法解析 Excel 分頁！')
        return
      }

      const rows: any[] = []
      const headers: string[] = []

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell) => {
            headers.push(cell.text.trim())
          })
        } else {
          const rowData: any = {}
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1]
            if (header) {
              rowData[header] = cell.text ? cell.text.trim() : ''
            }
          })
          if (Object.keys(rowData).length > 0) {
            rows.push(rowData)
          }
        }
      })

      setParsedRows(rows)
      setImportSummary(`成功讀取 ${rows.length} 筆資料，點擊下方「確定匯入」寫入 Firestore 雲端題庫。`)
    } catch (err) {
      console.error('Excel Parsing Error:', err)
      alert('解析 Excel 檔案失敗，請確保檔案格式正確！')
    }
  }

  const [importProgressMsg, setImportProgressMsg] = useState<string | null>(null)

  // 執行匯入 Firestore 雲端
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      alert('⚠️ 請先選取並解析 Excel 檔案！')
      return
    }
    setIsSubmittingImport(true)
    setImportProgressMsg('準備開始分批寫入 Firestore 雲端...')
    try {
      const result = await importQuestionsToFirestore(
        parsedRows,
        importMode,
        (current, total) => {
          setImportProgressMsg(`🚀 正在寫入雲端 Firestore (${current} / ${total} 筆)...`)
        }
      )
      setQuestions(result.updatedList)
      alert(
        `🎉 雲端題庫匯入完成！\n新增：${result.addedCount} 筆\n更新：${result.updatedCount} 筆\n格式錯誤/忽略：${result.errorCount} 筆`
      )
      setImportModalOpen(false)
      setParsedRows([])
      setImportSummary(null)
    } catch (e: any) {
      console.error('Import failed:', e)
      alert(`⚠️ 匯入過程發生錯誤：${e?.message || '請確認網路或 Firebase 權限'}`)
    } finally {
      setIsSubmittingImport(false)
      setImportProgressMsg(null)
    }
  }

  // 匯出現有題庫 Excel
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('題庫清單')

    ws.columns = [
      { header: 'id', key: 'id', width: 20 },
      { header: '題型 (type)', key: 'type', width: 15 },
      { header: '難易度 (difficulty)', key: 'difficulty', width: 18 },
      { header: '情境描述 (context)', key: 'context', width: 30 },
      { header: '題目主文 (content)', key: 'content', width: 40 },
      { header: '選項A (optionA)', key: 'optionA', width: 20 },
      { header: '選項B (optionB)', key: 'optionB', width: 20 },
      { header: '選項C (optionC)', key: 'optionC', width: 20 },
      { header: '選項D (optionD)', key: 'optionD', width: 20 },
      { header: '答案 (answer)', key: 'answer', width: 25 },
      { header: '解析 (explanation)', key: 'explanation', width: 30 },
      { header: '是否啟用 (enabled)', key: 'enabled', width: 15 },
    ]

    questions.forEach((q) => {
      ws.addRow({
        id: q.id,
        type: q.type,
        difficulty: q.difficulty,
        context: q.context || '',
        content: q.content,
        optionA: q.options?.A || '',
        optionB: q.options?.B || '',
        optionC: q.options?.C || '',
        optionD: q.options?.D || '',
        answer: q.answer || '',
        explanation: q.explanation || '',
        enabled: q.enabled ? 'Y' : 'N',
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cs_game_questions_export_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // 動態產出標準 Excel 範本下載
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('題庫導入模板')

    ws.columns = [
      { header: 'id', key: 'id', width: 22 },
      { header: '題型 (type)', key: 'type', width: 16 },
      { header: '難易度 (difficulty)', key: 'difficulty', width: 18 },
      { header: '情境描述 (context)', key: 'context', width: 35 },
      { header: '題目主文 (content)', key: 'content', width: 45 },
      { header: '選項A (optionA)', key: 'optionA', width: 22 },
      { header: '選項B (optionB)', key: 'optionB', width: 22 },
      { header: '選項C (optionC)', key: 'optionC', width: 22 },
      { header: '選項D (optionD)', key: 'optionD', width: 22 },
      { header: '答案 (answer)', key: 'answer', width: 25 },
      { header: '解析 (explanation)', key: 'explanation', width: 35 },
      { header: '是否啟用 (enabled)', key: 'enabled', width: 16 },
    ]

    // 加入示範範例列
    ws.addRow({
      id: 'q-demo-001',
      type: 'choice',
      difficulty: 'basic',
      context: '客服標準退換貨流程說明',
      content: '客戶要求在 7 天鑑賞期內無理由退貨，客服人員應如何處理？',
      optionA: '直接拒絕退貨',
      optionB: '協助引導辦理退貨流程並核對訂單資料',
      optionC: '要求客戶自行聯繫快遞',
      optionD: '無視訊息',
      answer: 'B',
      explanation: '7 天鑑賞期內應協助辦理退貨並核對客戶資料。',
      enabled: 'Y',
    })

    ws.addRow({
      id: 'q-demo-002',
      type: 'qa',
      difficulty: 'medium',
      context: '當專業名詞客戶不理解時',
      content: '請解釋何謂「買單」？並說明客服應如何向客戶解說。',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      answer: '看漲的訂單。客服應以簡明用語說明買單即預期價格上漲之交易。',
      explanation: '問答題無 ABCD 選項，答案欄位填寫參考解答或關鍵字。',
      enabled: 'Y',
    })

    ws.addRow({
      id: 'q-demo-003',
      type: 'essay',
      difficulty: 'hard',
      context: '爭議事件處理與情緒安撫',
      content: '客戶因系統延遲導致交易損失，情緒非常激動要求賠償。請撰寫一份客服應對模擬對話與處置方案。',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      answer: '1. 同理心安撫情緒；2. 紀錄受影響訂單；3. 向上呈報處置方案。',
      explanation: '申論題由主管於後台進行人工批改與給予評語。',
      enabled: 'Y',
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cs_game_question_template.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // 重新從 Firestore 刷新雲端題庫
  const handleResetDefault = async () => {
    setLoadingQuestions(true)
    const cloudList = await getFirestoreQuestions()
    setQuestions(cloudList)
    setLoadingQuestions(false)
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <span className={styles.titleIcon}>📚</span>
          <div>
            <h1 className={styles.titleText}>客服題庫管理後台</h1>
            <p className={styles.subtitle}>
              管理題庫內容、單筆新增修訂，或透過 Excel 進行批量上傳與維護
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href="/" className={styles.pixelBtn}>
            🏠 回首頁
          </Link>
          <button
            className={`${styles.pixelBtn} ${styles.btnPrimary}`}
            onClick={() => openEditModal()}
          >
            ➕ 單筆新增題目
          </button>
          <button
            className={`${styles.pixelBtn} ${styles.btnSuccess}`}
            onClick={() => setImportModalOpen(true)}
          >
            📥 匯入 Excel 題庫
          </button>
          <button className={styles.pixelBtn} onClick={handleExportExcel}>
            📤 匯出現有題庫
          </button>
          <button
            className={`${styles.pixelBtn} ${styles.btnWarning}`}
            onClick={handleDownloadTemplate}
          >
            📄 下載 Excel 標準模板
          </button>
        </div>
      </header>

      {/* Toolbar / Filters */}
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>
            題型：
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">全部題型</option>
              <option value="choice">選擇題 (choice)</option>
              <option value="qa">問答題 (qa)</option>
              <option value="essay">申論題 (essay)</option>
            </select>
          </label>

          <label>
            難易度：
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">全部難易度</option>
              <option value="basic">基礎 (basic)</option>
              <option value="medium">中等 (medium)</option>
              <option value="advanced">進階 (advanced)</option>
            </select>
          </label>

          <input
            type="text"
            placeholder="搜尋題目關鍵字或 ID..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.statsText}>
          共計 <strong>{filteredQuestions.length}</strong> / {questions.length} 道題目
          <button
            onClick={handleResetDefault}
            style={{ marginLeft: 12, cursor: 'pointer', opacity: 0.7 }}
          >
            [還原預設]
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <table className={styles.questionTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>狀態</th>
              <th>題型</th>
              <th>難易度</th>
              <th>情境描述 / 題目主文</th>
              <th>答案 / 解析</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loadingQuestions ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#a0aec0' }}>
                  ⏳ 正在載入雲端題庫資料...
                </td>
              </tr>
            ) : filteredQuestions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                  查無符合條件的題目
                </td>
              </tr>
            ) : (
              filteredQuestions.map((q) => (
                <tr key={q.id} className={!q.enabled ? styles.disabledRow : ''}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{q.id}</td>
                  <td>
                    <button
                      className={`${styles.pixelBtn} ${
                        q.enabled ? styles.btnSuccess : styles.btnDanger
                      }`}
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleToggleEnabled(q.id, q.enabled)}
                    >
                      {q.enabled ? '啟用中' : '已停用'}
                    </button>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        q.type === 'choice'
                          ? styles.badgeChoice
                          : q.type === 'qa'
                          ? styles.badgeQa
                          : styles.badgeEssay
                      }`}
                    >
                      {q.type}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        q.difficulty === 'basic'
                          ? styles.badgeBasic
                          : q.difficulty === 'medium'
                          ? styles.badgeMedium
                          : styles.badgeAdvanced
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </td>
                  <td>
                    {q.context && (
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 4 }}>
                        📌 情境：{q.context}
                      </div>
                    )}
                    <strong style={{ color: '#f8fafc' }}>{q.content}</strong>
                    {q.type === 'choice' && q.options && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 4,
                          fontSize: '0.78rem',
                          marginTop: 6,
                          color: '#cbd5e1',
                        }}
                      >
                        <div>A: {q.options.A}</div>
                        <div>B: {q.options.B}</div>
                        <div>C: {q.options.C}</div>
                        <div>D: {q.options.D}</div>
                      </div>
                    )}
                  </td>
                  <td>
                    {q.answer && (
                      <div style={{ color: '#4ade80' }}>
                        <strong>答案：</strong>
                        {q.answer}
                      </div>
                    )}
                    {q.explanation && (
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
                        解析：{q.explanation}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className={styles.pixelBtn}
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => openEditModal(q)}
                      >
                        ✏️ 編輯
                      </button>
                      <button
                        className={`${styles.pixelBtn} ${styles.btnDanger}`}
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => handleDelete(q.id)}
                      >
                        🗑️ 刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 單筆編輯 / 新增 Modal */}
      {editModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {currentEdit.id ? '✏️ 編輯題目' : '➕ 新增題目'}
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: 18 }}
              >
                ✖
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className={styles.optionsGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>題型 (type)</label>
                  <select
                    className={styles.formSelect}
                    value={currentEdit.type || 'choice'}
                    onChange={(e) =>
                      setCurrentEdit({ ...currentEdit, type: e.target.value as QuestionType })
                    }
                  >
                    <option value="choice">選擇題 (choice)</option>
                    <option value="qa">問答題 (qa)</option>
                    <option value="essay">申論題 (essay)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>難易度 (difficulty)</label>
                  <select
                    className={styles.formSelect}
                    value={currentEdit.difficulty || 'medium'}
                    onChange={(e) =>
                      setCurrentEdit({ ...currentEdit, difficulty: e.target.value as Difficulty })
                    }
                  >
                    <option value="basic">基礎 (basic)</option>
                    <option value="medium">中等 (medium)</option>
                    <option value="advanced">進階 (advanced)</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>情境描述 (context，可空)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={currentEdit.context || ''}
                  onChange={(e) => setCurrentEdit({ ...currentEdit, context: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>題目主文 (content)</label>
                <textarea
                  className={styles.formTextarea}
                  value={currentEdit.content || ''}
                  onChange={(e) => setCurrentEdit({ ...currentEdit, content: e.target.value })}
                  required
                />
              </div>

              {currentEdit.type === 'choice' && (
                <div className={styles.optionsGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>選項 A</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={currentEdit.options?.A || ''}
                      onChange={(e) =>
                        setCurrentEdit({
                          ...currentEdit,
                          options: {
                            A: e.target.value,
                            B: currentEdit.options?.B || '',
                            C: currentEdit.options?.C || '',
                            D: currentEdit.options?.D || '',
                          },
                        })
                      }
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>選項 B</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={currentEdit.options?.B || ''}
                      onChange={(e) =>
                        setCurrentEdit({
                          ...currentEdit,
                          options: {
                            A: currentEdit.options?.A || '',
                            B: e.target.value,
                            C: currentEdit.options?.C || '',
                            D: currentEdit.options?.D || '',
                          },
                        })
                      }
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>選項 C</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={currentEdit.options?.C || ''}
                      onChange={(e) =>
                        setCurrentEdit({
                          ...currentEdit,
                          options: {
                            A: currentEdit.options?.A || '',
                            B: currentEdit.options?.B || '',
                            C: e.target.value,
                            D: currentEdit.options?.D || '',
                          },
                        })
                      }
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>選項 D</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={currentEdit.options?.D || ''}
                      onChange={(e) =>
                        setCurrentEdit({
                          ...currentEdit,
                          options: {
                            A: currentEdit.options?.A || '',
                            B: currentEdit.options?.B || '',
                            C: currentEdit.options?.C || '',
                            D: e.target.value,
                          },
                        })
                      }
                      required
                    />
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  {currentEdit.type === 'choice'
                    ? '標準答案 (填寫 A, B, C 或 D)'
                    : '標準答案 / 參考解答 / 評分重點'}
                </label>
                <textarea
                  className={styles.formTextarea}
                  value={currentEdit.answer || ''}
                  onChange={(e) => setCurrentEdit({ ...currentEdit, answer: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>答案解析 (explanation，可空)</label>
                <textarea
                  className={styles.formTextarea}
                  value={currentEdit.explanation || ''}
                  onChange={(e) => setCurrentEdit({ ...currentEdit, explanation: e.target.value })}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.pixelBtn}
                  onClick={() => setEditModalOpen(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={`${styles.pixelBtn} ${styles.btnPrimary}`}
                >
                  儲存題目
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel 匯入 Modal */}
      {importModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: 800 }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>📥 匯入 Excel 題庫檔案</h3>
              <button
                onClick={() => setImportModalOpen(false)}
                style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: 18 }}
              >
                ✖
              </button>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>選擇匯入模式：</label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                  />
                  <strong>全自動追加 (Append Only)</strong>：每一列皆視為新題目寫入
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="upsert"
                    checked={importMode === 'upsert'}
                    onChange={() => setImportMode('upsert')}
                  />
                  <strong>比對更新 (Upsert Mode)</strong>：若 ID 相同則更新覆蓋，無 ID 則新增
                </label>
              </div>
            </div>

            <div
              className={styles.fileDropZone}
              onClick={() => fileInputRef.current?.click()}
            >
              📄 點擊選取 `.xlsx` 題庫檔案
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>

            {importProgressMsg ? (
              <div style={{ padding: 12, background: '#fef3c7', color: '#92400e', borderRadius: 4, marginBottom: 12, fontWeight: 'bold' }}>
                {importProgressMsg}
              </div>
            ) : importSummary ? (
              <div style={{ padding: 10, background: '#e0f2fe', color: '#0369a1', borderRadius: 4, marginBottom: 12 }}>
                {importSummary}
              </div>
            ) : null}

            {parsedRows.length > 0 && (
              <div>
                <div className={styles.formLabel}>預覽前 5 筆資料：</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.previewTable}>
                    <thead>
                      <tr>
                        <th>題型</th>
                        <th>難易度</th>
                        <th>情境</th>
                        <th>題目主文</th>
                        <th>答案</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          <td>{row['題型 (type)'] || row['type']}</td>
                          <td>{row['難易度 (difficulty)'] || row['difficulty']}</td>
                          <td>{row['情境描述 (context)'] || row['context']}</td>
                          <td>{row['題目主文 (content)'] || row['content']}</td>
                          <td>{row['答案 (answer)'] || row['answer']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={styles.modalFooter}>
              <button
                className={styles.pixelBtn}
                onClick={() => setImportModalOpen(false)}
              >
                取消
              </button>
              <button
                className={`${styles.pixelBtn} ${styles.btnSuccess}`}
                disabled={parsedRows.length === 0 || isSubmittingImport}
                onClick={handleConfirmImport}
              >
                {isSubmittingImport ? '⏳ 雲端匯入中...' : `確認執行匯入 (${parsedRows.length} 筆)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
