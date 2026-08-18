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
import { useAuth } from '@/contexts/AuthContext'
import { getPendingExamsFirestore, gradeExamFirestore } from '@/lib/examStore'
import { addHistoryRecord } from '@/lib/historyStore'

// 定義通用後台考卷型別（包含申論與綜合模式）
export interface PendingExamItem {
  examId: string
  mode: 'quiz' | 'essay'
  uid: string
  displayName: string
  email: string
  submittedAt: string
  status: 'submitted' | 'graded' | 'in_progress'
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

// 預設考卷資料（潔淨狀態，無假資料）
const INITIAL_MOCK_PENDING_EXAMS: PendingExamItem[] = []

export default function AdminGradePage() {
  const { userDoc } = useAuth()
  const [exams, setExams] = useState<PendingExamItem[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'quiz' | 'essay'>('all')
  
  // 正在批改的分數與評語暫存 state (key: questionId)
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({})
  const [gradingComments, setGradingComments] = useState<Record<string, string>>({})
  
  // Toast 或成功訊息通知
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 從 Firestore 實時載入待批改考卷
  const fetchPendingExams = async () => {
    setLoadingPending(true)
    const cloudList = await getPendingExamsFirestore()
    const formatted: PendingExamItem[] = cloudList.map((e) => {
      // 若為綜合模式，僅將問答題 (qa) 放入待批改題目中，選擇題 (choice) 已經由系統完成電腦打分
      const gradableAnswers = e.mode === 'quiz' 
        ? e.answers.filter((a) => a.questionDoc?.type === 'qa' || (!a.questionDoc && a.questionId.includes('qa')))
        : e.answers

      return {
        examId: e.id,
        mode: e.mode,
        uid: e.uid,
        displayName: e.displayName,
        email: e.userEmail,
        submittedAt: e.submittedAt?.toLocaleDateString ? e.submittedAt.toLocaleDateString() : '最近提交',
        status: e.status,
        choiceScore: e.choiceScore || 0,
        answers: gradableAnswers.map((a) => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          timeExpired: false,
          score: a.score || 0,
          comment: a.feedback || '',
          questionDoc: a.questionDoc,
        })),
      }
    })
    setExams(formatted)
    if (formatted.length > 0) {
      setSelectedExamId((prev) => prev || formatted[0].examId)
    }
    setLoadingPending(false)
  }

  useEffect(() => {
    fetchPendingExams()
  }, [])

  // 篩選考卷
  const filteredExams = exams.filter(e => filterMode === 'all' || e.mode === filterMode)
  const currentExam = exams.find(e => e.examId === selectedExamId)

  useEffect(() => {
    if (!currentExam) return
    const initialScores: Record<string, number> = {}
    const initialComments: Record<string, string> = {}

    currentExam.answers.forEach(ans => {
      initialScores[ans.questionId] = ans.score !== undefined ? ans.score : (currentExam.mode === 'quiz' ? 5 : 8)
      initialComments[ans.questionId] = ans.comment || ''
    })

    setGradingScores(initialScores)
    setGradingComments(initialComments)
  }, [selectedExamId, currentExam])

  const handleScoreChange = (qId: string, val: number) => {
    const maxVal = currentExam?.mode === 'quiz' ? 5 : 10
    const clamped = Math.max(0, Math.min(maxVal, val))
    setGradingScores(prev => ({ ...prev, [qId]: clamped }))
  }

  const handleCommentChange = (qId: string, text: string) => {
    setGradingComments(prev => ({ ...prev, [qId]: text }))
  }


  const handleSubmitGrading = async () => {
    if (!currentExam) return

    let essayScoreSum = 0
    const updatedAnswers = currentExam.answers.map((ans) => {
      const awarded = gradingScores[ans.questionId] || 0
      essayScoreSum += awarded
      return {
        questionId: ans.questionId,
        userAnswer: ans.userAnswer,
        score: awarded,
        feedback: gradingComments[ans.questionId] || '',
        questionDoc: ans.questionDoc,
      }
    })

    try {
      const totalScore = await gradeExamFirestore({
        examId: currentExam.examId,
        answers: updatedAnswers,
        essayScore: essayScoreSum,
        choiceScore: currentExam.choiceScore || 0,
        gradedBy: userDoc?.displayName || '管理者',
      })

      const isPassed = totalScore >= 90

      // 自動寫入 / 匯出至 Google Sheets
      fetch('/api/export-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentExam.email || 'examinee@example.com',
          displayName: currentExam.displayName || '客服勇者',
          date: new Date().toLocaleString('zh-TW', { hour12: false }),
          mode: currentExam.mode,
          score: totalScore,
          maxScore: 100,
          passed: isPassed,
          attemptCount: 1,
        }),
      }).catch((err) => console.error('📊 [Score Sheet Sync Error]', err))

      if (currentExam.mode === 'essay') {
        clearEssayLock()
      }

      showToast(`✅ 批改完成！總得分：${totalScore} 分 (${isPassed ? '通過' : '未通過'})。紀錄已更新至雲端與 Google Sheets！`)

      await fetchPendingExams()
    } catch (e: any) {
      console.error('Failed to submit grade to Firestore:', e)
      alert(`⚠️ 批改失敗：${e?.message || '請確認網路連線'}`)
    }
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

                  const maxScorePerQ = currentExam.mode === 'quiz' ? 5 : 10
                  const score = gradingScores[ans.questionId] ?? (currentExam.mode === 'quiz' ? 5 : 8)
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
