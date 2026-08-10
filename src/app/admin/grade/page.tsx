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
  clearEssayLock,
  EssayExamSession
} from '@/lib/examSession'

// 定義假資料列表型別（主管視角看到的每筆待批改/已批改申論考卷）
export interface PendingEssayExam {
  examId: string
  uid: string
  displayName: string
  email: string
  submittedAt: string
  status: 'submitted' | 'graded'
  totalScore?: number  // 0-100（若已批改）
  passed?: boolean     // 是否通過
  answers: {
    questionId: string
    userAnswer: string
    timeExpired: boolean
    score?: number     // 0-10
    comment?: string
  }[]
}

// 預設幾筆情境測試假考卷資料
const INITIAL_MOCK_PENDING_EXAMS: PendingEssayExam[] = [
  {
    examId: 'essay-exam-demo-001',
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
  },
  {
    examId: 'essay-exam-demo-002',
    uid: 'user-examinee-02',
    displayName: '綠水靈 (新人客服 B)',
    email: 'slime@example.com',
    submittedAt: '2026-08-03T16:15:00.000Z',
    status: 'graded',
    totalScore: 92,
    passed: true,
    answers: [
      {
        questionId: 'eq-001',
        userAnswer: '誠摯向客戶說明今日電話量較大導致等候，會盡全力在最短時間內解決問題。',
        timeExpired: false,
        score: 9,
        comment: '應答得體，能展現誠意。'
      },
      {
        questionId: 'eq-002',
        userAnswer: '幫客戶查詢單號，如果遺失就補寄一份。',
        timeExpired: false,
        score: 7,
        comment: '流程較為簡略，建議加上 logistics 確認步驟。'
      }
    ]
  }
]

export default function AdminGradePage() {
  // 從 sessionStorage 或預設假資料載入考卷清單
  const [exams, setExams] = useState<PendingEssayExam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  
  // 正在批改的分數與評語暫存 state (key: questionId)
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({})
  const [gradingComments, setGradingComments] = useState<Record<string, string>>({})
  
  // Toast 或成功訊息通知
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 初始化資料：組合 SessionStorage 的考卷與 Mock 清單
  useEffect(() => {
    let list: PendingEssayExam[] = [...INITIAL_MOCK_PENDING_EXAMS]
    
    // 嘗試讀取考生本機剛剛交卷的 session
    // 我們可以從 ESSAY_LOCK 拿到最新考卷 id
    const storedSession = loadEssaySession('essay-exam-demo-001') || loadEssaySession('essay-exam-latest')
    if (storedSession) {
      // 檢查是否已在列表中
      const existsIndex = list.findIndex(e => e.examId === storedSession.examId)
      const newExam: PendingEssayExam = {
        examId: storedSession.examId,
        uid: 'user-current-session',
        displayName: storedSession.displayName || '目前測試考生',
        email: 'current_test@example.com',
        submittedAt: storedSession.submittedAt,
        status: storedSession.status,
        answers: storedSession.answers
      }
      if (existsIndex >= 0) {
        list[existsIndex] = newExam
      } else {
        list.unshift(newExam)
      }
    }

    setExams(list)
    if (list.length > 0) {
      setSelectedExamId(list[0].examId)
    }
  }, [])

  // 當切換選中的考卷時，預填舊的分數與評語（若有）
  const currentExam = exams.find(e => e.examId === selectedExamId)

  useEffect(() => {
    if (!currentExam) return
    const initialScores: Record<string, number> = {}
    const initialComments: Record<string, string> = {}

    currentExam.answers.forEach(ans => {
      // 若已經有批改過則帶入舊值，否則預設 8 分與空評語
      initialScores[ans.questionId] = ans.score !== undefined ? ans.score : 8
      initialComments[ans.questionId] = ans.comment || ''
    })

    setGradingScores(initialScores)
    setGradingComments(initialComments)
  }, [selectedExamId, currentExam])

  // 修改單題分數 (0~10)
  const handleScoreChange = (qId: string, val: number) => {
    const clamped = Math.max(0, Math.min(10, val))
    setGradingScores(prev => ({ ...prev, [qId]: clamped }))
  }

  // 修改單題評語
  const handleCommentChange = (qId: string, text: string) => {
    setGradingComments(prev => ({ ...prev, [qId]: text }))
  }

  // 送出批改結果
  const handleSubmitGrading = () => {
    if (!currentExam) return

    // 計算總分：假設目前申論評分是 N 題，每題滿分 10，我們換算成滿分 100 分
    // 若題數不滿 10 題，則按題數平均換算成 100 分
    const totalAwarded = currentExam.answers.reduce((acc, ans) => {
      return acc + (gradingScores[ans.questionId] || 0)
    }, 0)
    
    const maxPossible = currentExam.answers.length * 10
    const finalScore = maxPossible > 0 ? Math.round((totalAwarded / maxPossible) * 100) : 0
    const isPassed = finalScore >= 90

    // 更新 state 中該考卷狀態
    const updatedAnswers = currentExam.answers.map(ans => ({
      ...ans,
      score: gradingScores[ans.questionId],
      comment: gradingComments[ans.questionId]
    }))

    const updatedExam: PendingEssayExam = {
      ...currentExam,
      status: 'graded',
      totalScore: finalScore,
      passed: isPassed,
      answers: updatedAnswers
    }

    setExams(prev => prev.map(e => e.examId === currentExam.examId ? updatedExam : e))
    
    // 清除考生端的申論 Lock 鎖定，模擬主管批改完畢開放考生重新考申論題
    clearEssayLock()

    // 自動寫入 / 匯出至 Google Sheets
    fetch('/api/export-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentExam.email || 'examinee@example.com',
        displayName: currentExam.displayName || '申論考生',
        date: new Date().toLocaleString('zh-TW', { hour12: false }),
        mode: 'essay',
        score: finalScore,
        maxScore: 100,
        passed: isPassed,
        attemptCount: 1,
      })
    }).then(res => res.json())
      .then(resData => console.log('📊 [Essay Score Sheet Sync]', resData))
      .catch(err => console.error('📊 [Essay Score Sheet Sync Error]', err))

    // 顯示成功提示
    showToast(`✅ 批改完成！考生成績：${finalScore} 分 (${isPassed ? '通過' : '未通過'})。已自動將成績同步至 Google Sheets。`)
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
          <h1 className={styles.title}>👑 主管申論批改後台</h1>
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
          <h2 className={styles.sidebarTitle}>📋 申論題考卷列表</h2>
          <div className={styles.examList}>
            {exams.map(exam => {
              const isSelected = exam.examId === selectedExamId
              return (
                <button
                  key={exam.examId}
                  className={`${styles.examCard} ${isSelected ? styles.examCardActive : ''}`}
                  onClick={() => setSelectedExamId(exam.examId)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.examineeName}>{exam.displayName}</span>
                    <span className={`${styles.statusBadge} ${styles[exam.status]}`}>
                      {exam.status === 'submitted' ? '⏳ 待批改' : '✅ 已批改'}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>提交時間：{new Date(exam.submittedAt).toLocaleString('zh-TW')}</span>
                    {exam.status === 'graded' && (
                      <span className={styles.scoreText}>得分：{exam.totalScore} 分</span>
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
                    考生：{currentExam.displayName} ({currentExam.email})
                  </h2>
                  <p className={styles.subDetail}>
                    考卷 ID: {currentExam.examId} | 狀態：
                    <span className={`${styles.statusText} ${styles[currentExam.status]}`}>
                      {currentExam.status === 'submitted' ? '等待主管審核評分' : `已批改 (${currentExam.totalScore}分 / ${currentExam.passed ? '通過' : '未通過'})`}
                    </span>
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
                  const qData = MOCK_ESSAY_QUESTIONS_MAP[ans.questionId] || {
                    content: `題目 (ID: ${ans.questionId})`,
                    context: '',
                    difficulty: 'medium'
                  }

                  const score = gradingScores[ans.questionId] ?? 0
                  const comment = gradingComments[ans.questionId] ?? ''

                  return (
                    <div key={ans.questionId} className={styles.questionCard}>
                      <div className={styles.qHeader}>
                        <span className={styles.qIndex}>第 {idx + 1} 題</span>
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
                            🎯 主管給分 (0 - 10 分)：
                          </label>
                          <div className={styles.scoreInputGroup}>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={score}
                              onChange={(e) => handleScoreChange(ans.questionId, parseInt(e.target.value) || 0)}
                              className={styles.scoreInput}
                            />
                            <span className={styles.scoreMax}>/ 10 分</span>
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
