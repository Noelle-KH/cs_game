'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadExamSession, ExamSession } from '@/lib/examSession'
import { addHistoryRecord } from '@/lib/historyStore'
import styles from './page.module.css'

const IS_DEV = process.env.NODE_ENV === 'development'

export default function ResultPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = use(params)
  const router = useRouter()
  const [session, setSession] = useState<ExamSession | null>(null)
  const [showScore, setShowScore] = useState(false)

  useEffect(() => {
    const data = loadExamSession(examId)
    if (!data && !IS_DEV) {
      router.replace('/exam/quiz/lobby')
      return
    }
    // DEV fallback：若無 session，產生一筆假的
    const effective = data ?? MOCK_SESSION(examId)
    setSession(effective)

    // 雙向記錄至 historyStore
    if (effective) {
      const isGraded = effective.status === 'graded'
      addHistoryRecord({
        id: effective.examId,
        mode: 'quiz',
        displayName: effective.displayName || '客服勇者',
        score: effective.score,
        maxScore: effective.maxScore,
        passed: isGraded ? effective.passed : false,
        status: effective.status || 'submitted',
        date: new Date(effective.submittedAt || Date.now()).toLocaleString('zh-TW', { hour12: false }).slice(0, 16),
        details: effective
      })

      // 只有在全選擇題（即時 graded）時才自動發送 Google Sheets 匯出；若含有問答題 (submitted)，改由主管完成批改後觸發
      if (isGraded) {
        fetch('/api/export-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'examinee@example.com', // 未來串接 Auth 時帶入真實 Auth Email
            displayName: effective.displayName || '客服勇者',
            date: new Date(effective.submittedAt || Date.now()).toLocaleString('zh-TW', { hour12: false }),
            mode: 'quiz',
            score: effective.score,
            maxScore: effective.maxScore,
            passed: effective.passed,
            attemptCount: 1,
          })
        }).then(res => res.json())
          .then(resData => console.log('📊 [GoogleSheets Sync]', resData))
          .catch(err => console.error('📊 [GoogleSheets Sync Error]', err))
      }
    }
    // 分數動畫：短暫延遲後顯示
    const t = setTimeout(() => setShowScore(true), 400)
    return () => clearTimeout(t)
  }, [examId, router])

  if (!session) {
    return (
      <div className={styles.loading}>
        <p className="pixel-title animate-float">載入成績中...</p>
      </div>
    )
  }

  const { score, passed, correctCount, totalChoice, totalQa, expiredCount, answeredCount } = session
  const totalQuestions = totalChoice + totalQa
  const unansweredCount = totalQuestions - answeredCount

  const isSubmitted = session.status === 'submitted'

  return (
    <main className={`pixel-bg ${styles.main}`}>
      <div className={`container ${styles.content}`}>

        {/* ── 結果卡片 ── */}
        <div className={`pixel-panel animate-slide-in ${styles.resultCard}`}>

          {/* 通過 / 未通過 / 待審核 Banner */}
          {isSubmitted ? (
            <div className={`${styles.resultBanner} ${styles.bannerPassed}`} style={{ backgroundColor: '#2b3964', borderColor: '#4a6fa5' }}>
              <span className={styles.bannerIcon}>⏳</span>
              <span className={`pixel-title ${styles.bannerText}`}>
                已交卷，等待主管審核中！
              </span>
              <span className={styles.bannerSub}>
                選擇題已完成結算，問答題由主管批改完成後將更新最終總分與排行榜
              </span>
            </div>
          ) : (
            <div className={`${styles.resultBanner} ${passed ? styles.bannerPassed : styles.bannerFailed}`}>
              <span className={styles.bannerIcon}>{passed ? '🏆' : '📚'}</span>
              <span className={`pixel-title ${styles.bannerText}`}>
                {passed ? '恭喜通過！' : '繼續加油！'}
              </span>
              <span className={styles.bannerSub}>
                {passed ? '成績已達通過門檻 90 分' : '差一點就到了，再試一次吧！'}
              </span>
            </div>
          )}

          {/* 分數大字 */}
          <div className={styles.scoreSection}>
            <div className={`${styles.scoreCircle} ${isSubmitted ? '' : (passed ? styles.scoreCirclePassed : styles.scoreCircleFailed)}`} style={isSubmitted ? { borderColor: '#4a6fa5' } : undefined}>
              <span className={`pixel-title ${styles.scoreNumber} ${showScore ? styles.scoreVisible : ''}`}>
                {showScore ? (session.choiceScore ?? score) : '—'}
              </span>
              <span className={styles.scoreMax}>/ 100</span>
            </div>
            <div className={styles.scoreDetail}>
              <p className={styles.scoreNote}>
                {isSubmitted
                  ? `📝 選擇題得分：${session.choiceScore ?? score} 分（問答題待主管評分）`
                  : (passed ? '✅ 已達通過門檻（90 分）' : `❌ 距通過門檻還差 ${90 - score} 分`)}
              </p>
            </div>
          </div>

          {/* 統計數據 */}
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>✅</span>
              <span className={`pixel-title ${styles.statValue} ${styles.colorGreen}`}>{correctCount}</span>
              <span className={styles.statLabel}>選擇題答對</span>
              <span className={styles.statSub}>/ {totalChoice} 題</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>✍️</span>
              <span className={`pixel-title ${styles.statValue} ${styles.colorBlue}`}>
                {isSubmitted ? '待批改' : (session.qaScore ?? 0)}
              </span>
              <span className={styles.statLabel}>{isSubmitted ? '問答題審核' : '問答題得分'}</span>
              <span className={styles.statSub}>/ {totalQa} 題</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>⏱️</span>
              <span className={`pixel-title ${styles.statValue} ${expiredCount > 0 ? styles.colorRed : styles.colorGreen}`}>
                {expiredCount}
              </span>
              <span className={styles.statLabel}>超時未答</span>
              <span className={styles.statSub}>題</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>📝</span>
              <span className={`pixel-title ${styles.statValue} ${unansweredCount > 0 ? styles.colorRed : styles.colorGreen}`}>
                {unansweredCount}
              </span>
              <span className={styles.statLabel}>略過未答</span>
              <span className={styles.statSub}>題</span>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className={styles.actions}>
            <button
              id="btn-review"
              className={`btn-pixel btn-secondary ${styles.actionBtn}`}
              onClick={() => router.push(`/exam/quiz/${examId}/review`)}
            >
              🔍 查看錯題回顧
            </button>
            <button
              id="btn-retry"
              className={`btn-pixel btn-primary ${styles.actionBtn}`}
              onClick={() => router.push('/exam/quiz/lobby')}
            >
              🔁 再挑戰一次
            </button>
            <button
              id="btn-home"
              className={`btn-pixel btn-ghost ${styles.actionBtn}`}
              onClick={() => router.push('/')}
            >
              🏠 回首頁
            </button>
          </div>
        </div>

        {/* 提交時間 */}
        <p className={styles.submitTime}>
          提交時間：{new Date(session.submittedAt).toLocaleString('zh-TW')}
        </p>
      </div>
    </main>
  )
}

// ── DEV fallback session ─────────────────────────────────────────
function MOCK_SESSION(examId: string): ExamSession {
  return {
    examId,
    mode: 'quiz',
    displayName: '開發測試員',
    status: 'submitted',
    score: 72,
    choiceScore: 60,
    maxScore: 100,
    passed: false,
    correctCount: 4,
    totalChoice: 5,
    totalQa: 3,
    expiredCount: 1,
    answeredCount: 7,
    answers: [
      { questionId: 'q-001', userAnswer: 'B', isCorrect: true,  timeExpired: false },
      { questionId: 'q-002', userAnswer: 'A', isCorrect: false, timeExpired: false },
      { questionId: 'q-003', userAnswer: 'C', isCorrect: true,  timeExpired: false },
      { questionId: 'q-004', userAnswer: '應先同理客戶，承諾回覆時間', isCorrect: undefined, timeExpired: false },
      { questionId: 'q-005', userAnswer: 'B', isCorrect: true,  timeExpired: false },
      { questionId: 'q-006', userAnswer: '',  isCorrect: undefined, timeExpired: true  },
      { questionId: 'q-007', userAnswer: 'B', isCorrect: true,  timeExpired: false },
      { questionId: 'q-008', userAnswer: '應評估當前案件可否暫停', isCorrect: undefined, timeExpired: false },
    ],
    submittedAt: new Date().toISOString(),
  }
}
