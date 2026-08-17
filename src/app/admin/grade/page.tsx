'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './grade.module.css'
import {
  MOCK_ESSAY_QUESTIONS_MAP,
  MOCK_ESSAY_QUESTIONS
} from '@/lib/mockData'
import {
  loadEssaySession,
  loadExamSession,
  clearEssayLock,
  EssayExamSession,
  ExamSession,
  saveExamSession
} from '@/lib/examSession'
import { addHistoryRecord } from '@/lib/historyStore'

// 定義通用後台考卷型別（包含申論與綜合模式）
export interface PendingExamItem {
  examId: string
  mode: 'quiz' | 'essay'
  uid: string
  displayName: string
  email: string
  submittedAt: string
  status: 'submitted' | 'graded'
  totalScore?: number  // 0-100（若已批改）
  choiceScore?: number // 綜合模式專用：選擇題得分
  passed?: boolean     // 是否通過
  answers: {
    questionId: string
    userAnswer: string
    timeExpired: boolean
    score?: number     // 申論: 0-10；綜合問答題: 得分
    comment?: string
    questionDoc?: any
  }[]
}

// 預設幾筆情境測試假考卷資料
const INITIAL_MOCK_PENDING_EXAMS: PendingExamItem[] = [
  {
    examId: 'quiz-exam-demo-002',
    mode: 'quiz',
    uid: 'user-examinee-04',
    displayName: '小火龍 (新人客服 D)',
    email: 'charmander@example.com',
    submittedAt: '2026-08-04T15:30:00.000Z',
    status: 'submitted',
    choiceScore: 75,
    answers: [
      {
        questionId: 'q-demo-03',
        userAnswer: '針對超過 7 天鑑賞期的退款申請，我會先表達同理：「非常理解您的處境」，並向客戶說明公司的退換貨規範。接著主動提供折抵券或延長使用期限的替代方案，減緩客戶的不滿。',
        timeExpired: false,
        questionDoc: {
          id: 'q-demo-03',
          type: 'qa',
          content: '請簡述當客戶購買產品超過 7 天鑑賞期，但因特殊理由堅持要求全額退費時的標準處置應對原則。',
          context: '退費政策應對情境',
          difficulty: 'medium',
          answer: '先同理客戶心情，說明公司規範政策，並嘗試爭取替代補償方案（如延期或點數回饋）。'
        }
      }
    ]
  },
  {
    examId: 'quiz-exam-demo-001',
    mode: 'quiz',
    uid: 'user-examinee-03',
    displayName: '皮卡丘 (新人客服 C)',
    email: 'pikachu@example.com',
    submittedAt: '2026-08-04T12:00:00.000Z',
    status: 'submitted',
    choiceScore: 60,
    answers: [
      {
        questionId: 'qa-demo-01',
        userAnswer: '客戶要求無條件退款時，先同理客戶心情，說明退款相關政策規範，並協助爭取替代補償方案。',
        timeExpired: false,
        questionDoc: {
          id: 'qa-demo-01',
          type: 'qa',
          content: '請簡述當客戶要求無條件退費時，標準應答作業流程。',
          context: '客戶購買課程後超過鑑賞期要求退費',
          difficulty: 'medium',
          answer: '同理說明政策，提供替代方案'
        }
      }
    ]
  },
  {
    examId: 'essay-exam-demo-001',
    mode: 'essay',
    uid: 'user-examinee-01',
    displayName: '菇菇寶貝 (新人客服 A)',
    email: 'mushroom@example.com',
    submittedAt: '2026-08-04T10:30:00.000Z',
    status: 'submitted',
    answers: [
      {
        questionId: 'eq-001',
        userAnswer: '首先我會用平穩且具專業感的手調向客戶致歉：「非常抱歉讓您久等了，我是客服人員小蘑，我完全能理解您等待時的心情...」接著立刻切入重點幫他確認帳號資料，不再使用敷衍詞彙。',
        timeExpired: false,
      },
      {
        questionId: 'eq-002',
        userAnswer: '流程：1. 確認配送地址與收件人 2. 聯繫 logistics 物流特快車專線 3. 告知客戶預計追蹤回覆時程。先安撫再追查，避免盲目承諾。',
        timeExpired: false,
      },
      {
        questionId: 'eq-003',
        userAnswer: '針對超過30天要求退款，我會先傾聽他的不滿，再說明30天政策與保障。接著爭取「免費升級原廠保固額度」作為特別替代方案，讓客戶感受到重視。',
        timeExpired: true, // 這題超時自動提交
      }
    ]
  }
]

export default function AdminGradePage() {
  // 從 sessionStorage 或預設假資料載入考卷清單
  const [exams, setExams] = useState<PendingExamItem[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'quiz' | 'essay'>('all')
  
  // 正在批改的分數與評語暫存 state (key: questionId)
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({})
  const [gradingComments, setGradingComments] = useState<Record<string, string>>({})
  
  // Toast 或成功訊息通知
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 初始化資料：組合 SessionStorage 的考卷與 Mock 清單
  useEffect(() => {
    let list: PendingExamItem[] = [...INITIAL_MOCK_PENDING_EXAMS]
    
    // 1. 嘗試讀取考生本機剛剛交卷的申論 session
    const storedEssay = loadEssaySession('essay-exam-demo-001') || loadEssaySession('essay-exam-latest')
    if (storedEssay) {
      const existsIndex = list.findIndex(e => e.examId === storedEssay.examId)
      const newExam: PendingExamItem = {
        examId: storedEssay.examId,
        mode: 'essay',
        uid: 'user-current-session',
        displayName: storedEssay.displayName || '目前測試考生',
        email: 'current_test@example.com',
        submittedAt: storedEssay.submittedAt,
        status: storedEssay.status,
        answers: storedEssay.answers
      }
      if (existsIndex >= 0) list[existsIndex] = newExam
      else list.unshift(newExam)
    }

    // 2. 嘗試讀取考生本機剛剛交卷的綜合 session (如有問答題)
    const storedQuiz = loadExamSession('quiz-exam-latest') || loadExamSession('quiz-exam-demo')
    if (storedQuiz && storedQuiz.totalQa > 0) {
      const existsIndex = list.findIndex(e => e.examId === storedQuiz.examId)
      const qaAnswers = storedQuiz.answers.filter(a => a.questionDoc?.type === 'qa')
      const newExam: PendingExamItem = {
        examId: storedQuiz.examId,
        mode: 'quiz',
        uid: 'user-current-session',
        displayName: storedQuiz.displayName || '目前測試考生',
        email: 'current_test@example.com',
        submittedAt: storedQuiz.submittedAt,
        status: storedQuiz.status || 'submitted',
        choiceScore: storedQuiz.choiceScore ?? storedQuiz.score,
        answers: qaAnswers.map(a => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          timeExpired: a.timeExpired,
          score: a.score,
          comment: a.comment,
          questionDoc: a.questionDoc
        }))
      }
      if (existsIndex >= 0) list[existsIndex] = newExam
      else list.unshift(newExam)
    }

    setExams(list)
    if (list.length > 0) {
      setSelectedExamId(list[0].examId)
    }
  }, [])

  // 篩選考卷
  const filteredExams = exams.filter(e => filterMode === 'all' || e.mode === filterMode)
  const currentExam = exams.find(e => e.examId === selectedExamId)

  useEffect(() => {
    if (!currentExam) return
    const initialScores: Record<string, number> = {}
    const initialComments: Record<string, string> = {}

    currentExam.answers.forEach(ans => {
      initialScores[ans.questionId] = ans.score !== undefined ? ans.score : (currentExam.mode === 'quiz' ? 10 : 8)
      initialComments[ans.questionId] = ans.comment || ''
    })

    setGradingScores(initialScores)
    setGradingComments(initialComments)
  }, [selectedExamId, currentExam])

  const handleScoreChange = (qId: string, val: number) => {
    const maxVal = currentExam?.mode === 'quiz' ? 20 : 10
    const clamped = Math.max(0, Math.min(maxVal, val))
    setGradingScores(prev => ({ ...prev, [qId]: clamped }))
  }

  const handleCommentChange = (qId: string, text: string) => {
    setGradingComments(prev => ({ ...prev, [qId]: text }))
  }

  const handleSubmitGrading = () => {
    if (!currentExam) return

    let finalScore = 0
    let isPassed = false

    if (currentExam.mode === 'essay') {
      const totalAwarded = currentExam.answers.reduce((acc, ans) => acc + (gradingScores[ans.questionId] || 0), 0)
      const maxPossible = currentExam.answers.length * 10
      finalScore = maxPossible > 0 ? Math.round((totalAwarded / maxPossible) * 100) : 0
      isPassed = finalScore >= 90
      clearEssayLock()
    } else {
      // 綜合模式：選擇題得分 + 問答題得分
      const qaAwarded = currentExam.answers.reduce((acc, ans) => acc + (gradingScores[ans.questionId] || 0), 0)
      const choiceScore = currentExam.choiceScore ?? 0
      finalScore = Math.min(100, choiceScore + qaAwarded)
      isPassed = finalScore >= 90

      // 回寫 SessionStorage
      const localQuizSession = loadExamSession(currentExam.examId)
      if (localQuizSession) {
        saveExamSession({
          ...localQuizSession,
          status: 'graded',
          score: finalScore,
          qaScore: qaAwarded,
          passed: isPassed,
          gradedAt: new Date().toISOString()
        })
      }
    }

    // 更新歷史紀錄 (寫入 historyStore 使排行榜生效)
    addHistoryRecord({
      id: currentExam.examId,
      mode: currentExam.mode,
      displayName: currentExam.displayName,
      score: finalScore,
      maxScore: 100,
      passed: isPassed,
      status: 'graded',
      date: new Date().toLocaleString('zh-TW', { hour12: false }).slice(0, 16)
    })

    const updatedAnswers = currentExam.answers.map(ans => ({
      ...ans,
      score: gradingScores[ans.questionId],
      comment: gradingComments[ans.questionId]
    }))

    const updatedExam: PendingExamItem = {
      ...currentExam,
      status: 'graded',
      totalScore: finalScore,
      passed: isPassed,
      answers: updatedAnswers
    }

    setExams(prev => prev.map(e => e.examId === currentExam.examId ? updatedExam : e))

    // 自動寫入 / 匯出至 Google Sheets
    fetch('/api/export-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentExam.email || 'examinee@example.com',
        displayName: currentExam.displayName || '客服勇者',
        date: new Date().toLocaleString('zh-TW', { hour12: false }),
        mode: currentExam.mode,
        score: finalScore,
        maxScore: 100,
        passed: isPassed,
        attemptCount: 1,
      })
    }).then(res => res.json())
      .then(resData => console.log('📊 [Score Sheet Sync]', resData))
      .catch(err => console.error('📊 [Score Sheet Sync Error]', err))

    showToast(`✅ 批改完成！${currentExam.mode === 'quiz' ? '綜合' : '申論'}考生成績：${finalScore} 分 (${isPassed ? '通過' : '未通過'})。已更新排行榜並同步至 Google Sheets！`)
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  return (
    <div className={styles.container}>
      {/* 頂部導航 header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.backBtn}>
            ⬅️ 返回大廳
          </Link>
          <h1 className={styles.title}>👑 主管批改後台 (綜合 / 申論)</h1>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.roleBadge}>Role: Supervisor / Admin</span>
        </div>
      </header>

      {/* Toast 提示框 */}
      {toastMessage && (
        <div className={styles.toast}>
          {toastMessage}
        </div>
      )}

      {/* 主內容區：左側待批改清單，右側作答詳情與評分 */}
      <div className={styles.mainLayout}>
        {/* 左側考卷列表 */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitleRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className={styles.sidebarTitle} style={{ margin: 0 }}>📋 待批改考卷</h2>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              style={{ background: '#1c2237', color: '#fff', border: '1px solid #4a6fa5', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
            >
              <option value="all">全部模式</option>
              <option value="quiz">綜合模式 (Quiz)</option>
              <option value="essay">申論模式 (Essay)</option>
            </select>
          </div>
          <div className={styles.examList}>
            {filteredExams.map(exam => {
              const isSelected = exam.examId === selectedExamId
              return (
                <button
                  key={exam.examId}
                  className={`${styles.examCard} ${isSelected ? styles.examCardActive : ''}`}
                  onClick={() => setSelectedExamId(exam.examId)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.examineeName}>
                      {exam.mode === 'quiz' ? '🎯 [綜合] ' : '📜 [申論] '}
                      {exam.displayName}
                    </span>
                    <span className={`${styles.statusBadge} ${styles[exam.status]}`}>
                      {exam.status === 'submitted' ? '⏳ 待批改' : '✅ 已批改'}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>提交時間：{new Date(exam.submittedAt).toLocaleString('zh-TW')}</span>
                    {exam.mode === 'quiz' && (
                      <span style={{ display: 'block', fontSize: 12, color: '#a0aec0', marginTop: 2 }}>
                        選擇題得分：{exam.choiceScore ?? 0} 分
                      </span>
                    )}
                    {exam.status === 'graded' && (
                      <span className={styles.scoreText}>總分：{exam.totalScore} 分</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* 右側詳細作答與評分面板 */}
        <section className={styles.detailSection}>
          {!currentExam ? (
            <div className={styles.emptyState}>
              <p>請選擇左側的考卷進行批改</p>
            </div>
          ) : (
            <div className={styles.detailPanel}>
              {/* 考卷頭部資訊 */}
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.examineeTitle}>
                    {currentExam.mode === 'quiz' ? '🎯 綜合模式考卷' : '📜 申論模式考卷'} — {currentExam.displayName} ({currentExam.email})
                  </h2>
                  <p className={styles.subDetail}>
                    考卷 ID: {currentExam.examId} | 狀態：
                    <span className={`${styles.statusText} ${styles[currentExam.status]}`}>
                      {currentExam.status === 'submitted' ? '等待主管審核評分' : `已批改 (${currentExam.totalScore}分 / ${currentExam.passed ? '通過' : '未通過'})`}
                    </span>
                    {currentExam.mode === 'quiz' && (
                      <span style={{ marginLeft: 12, color: '#68d391' }}>
                        （選擇題已得分：{currentExam.choiceScore ?? 0} 分）
                      </span>
                    )}
                  </p>
                </div>
                <button
                  className="btn-pixel btn-primary"
                  onClick={handleSubmitGrading}
                >
                  💾 {currentExam.status === 'submitted' ? '送出評分與評語' : '更新評分資料'}
                </button>
              </div>

              {/* 每題作答詳情與評分輸入 */}
              <div className={styles.questionsContainer}>
                {currentExam.answers.map((ans, idx) => {
                  const qData = ans.questionDoc || MOCK_ESSAY_QUESTIONS_MAP[ans.questionId] || {
                    content: `題目 (ID: ${ans.questionId})`,
                    context: '',
                    difficulty: 'medium',
                    answer: ''
                  }

                  const maxScorePerQ = currentExam.mode === 'quiz' ? 20 : 10
                  const score = gradingScores[ans.questionId] ?? (currentExam.mode === 'quiz' ? 10 : 8)
                  const comment = gradingComments[ans.questionId] ?? ''

                  return (
                    <div key={ans.questionId} className={styles.questionCard}>
                      <div className={styles.qHeader}>
                        <span className={styles.qIndex}>第 {idx + 1} 題 ({currentExam.mode === 'quiz' ? '問答題' : '申論題'})</span>
                        <span className={styles.qDifficulty}>難度：{qData.difficulty}</span>
                        {ans.timeExpired && (
                          <span className={styles.expiredBadge}>⏱️ 此題因作答超時自動關閉</span>
                        )}
                      </div>

                      {/* 題目情境與內文 */}
                      {qData.context && (
                        <div className={styles.qContext}>
                          <strong>📌 題目情境：</strong> {qData.context}
                        </div>
                      )}
                      <div className={styles.qContent}>
                        <strong>問：</strong>{qData.content}
                      </div>

                      {/* 參考標準答案（如果有） */}
                      {qData.answer && (
                        <div className={styles.qContext} style={{ backgroundColor: '#2d3748', borderLeftColor: '#4299e1', marginTop: 8 }}>
                          <strong>💡 參考答案/關鍵字：</strong> {qData.answer}
                        </div>
                      )}

                      {/* 考生答案 */}
                      <div className={styles.userAnswerBox}>
                        <div className={styles.answerBoxLabel}>💬 考生作答內容：</div>
                        <div className={styles.userAnswerText}>
                          {ans.userAnswer || <span className={styles.noAnswer}>（未輸入答案，直接提交）</span>}
                        </div>
                      </div>

                      {/* 主管評分與評語輸入區 */}
                      <div className={styles.gradingBox}>
                        <div className={styles.scoreRow}>
                          <label className={styles.scoreLabel}>
                            🎯 主管給分 (0 - {maxScorePerQ} 分)：
                          </label>
                          <div className={styles.scoreInputGroup}>
                            <input
                              type="number"
                              min={0}
                              max={maxScorePerQ}
                              value={score}
                              onChange={(e) => handleScoreChange(ans.questionId, parseInt(e.target.value) || 0)}
                              className={styles.scoreInput}
                            />
                            <span className={styles.scoreMax}>/ {maxScorePerQ} 分</span>
                          </div>
                        </div>

                        <div className={styles.commentRow}>
                          <label className={styles.commentLabel}>
                            📝 評語與指導建議：
                          </label>
                          <textarea
                            rows={3}
                            placeholder="請針對此題作答邏輯、同理心表現給予文字指導..."
                            value={comment}
                            onChange={(e) => handleCommentChange(ans.questionId, e.target.value)}
                            className={styles.commentTextarea}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 底部按鈕 */}
              <div className={styles.panelFooter}>
                <button
                  className="btn-pixel btn-primary"
                  onClick={handleSubmitGrading}
                >
                  🚀 確認完成批改並寫入成績
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
