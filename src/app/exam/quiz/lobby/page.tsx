'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserDoc } from '@/types'
import styles from './page.module.css'

// ⚠️ 開發模式 Mock 使用者（未登入時自動套用）
const DEV_MOCK_USERDO: UserDoc = {
  uid: 'dev-uid-001',
  email: 'dev@example.com',
  displayName: '開發測試員',
  role: 'examinee',
  createdAt: new Date('2026-01-01'),
  lastLoginAt: new Date(),
}

import { createExamFirestore, getUserExamsFirestore } from '@/lib/examStore'

const QUIZ_RULES = [
  { icon: '📋', label: '題型', value: '選擇題 + 問答題混合，共 20 題' },
  { icon: '⏱️', label: '計時', value: '每題 5 分鐘倒數，超時自動交卷' },
  { icon: '🎯', label: '通過門檻', value: '90 分（含）以上' },
  { icon: '📊', label: '計分方式', value: '每題 5 分，共 100 分' },
  { icon: '🔁', label: '重複作答', value: '可無限刷題，排行榜取最高分' },
  { icon: '⚡', label: '計時基準', value: '以伺服器時間為準，不可修改' },
]
// ────────────────────────────────────────────────────────────────

export default function QuizLobbyPage() {
  const { user, userDoc, loading, logout } = useAuth()
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)

  // 開發模式：無真實使用者時自動套用 Mock 資料
  const isDev = process.env.NODE_ENV === 'development'
  const effectiveUserDoc = userDoc ?? (isDev && !loading ? DEV_MOCK_USERDO : null)

  if (loading || !effectiveUserDoc) {
    return (
      <div className={styles.loading}>
        <p className="pixel-title">載入中...</p>
      </div>
    )
  }

  const handleLogout = async () => {
    if (user) await logout()
    else router.push('/login')
  }

  // 載入該使用者的雲端歷史成績
  const [cloudExams, setCloudExams] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      if (user?.uid) {
        setLoadingHistory(true)
        const exams = await getUserExamsFirestore(user.uid)
        setCloudExams(exams.filter(e => e.mode === 'quiz'))
        setLoadingHistory(false)
      } else {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [user])

  const bestScore = cloudExams.length > 0 
    ? Math.max(...cloudExams.map(e => e.score || 0)) 
    : 0

  async function handleStart() {
    setIsStarting(true)
    try {
      const newExamId = `quiz-${Date.now()}`
      // 初步創建雲端考卷集合紀錄
      await createExamFirestore({
        id: newExamId,
        uid: user?.uid || 'dev-examinee-uid',
        userEmail: user?.email || 'examinee@example.com',
        displayName: userDoc?.displayName || '客服勇者',
        mode: 'quiz',
        answers: [],
      })
      router.push(`/exam/quiz/${newExamId}`)
    } catch (e) {
      console.error('Failed to create quiz exam in Firestore:', e)
      alert('建立雲端考場失敗，請檢查網路連線！')
      setIsStarting(false)
    }
  }

  return (
    <main className={`pixel-bg ${styles.main}`}>
      {/* 頂部導覽列 */}
      <nav className={styles.navbar}>
        <button
          id="btn-back-home"
          className={`btn-pixel btn-ghost ${styles.backBtn}`}
          onClick={() => router.push('/')}
        >
          ← 返回大廳
        </button>
        <span className={`pixel-title ${styles.navTitle}`}>⚔️ 綜合模式</span>
        <div className={styles.navRight}>
          <span className={styles.playerName}>👤 {effectiveUserDoc.displayName}</span>
          <button
            id="btn-logout"
            className={`btn-pixel btn-ghost ${styles.logoutBtn}`}
            onClick={handleLogout}
          >
            登出
          </button>
        </div>
      </nav>

      <div className={`container ${styles.content}`}>
        {/* 頁面標題 */}
        <section className={`animate-slide-in ${styles.hero}`}>
          <div className={styles.heroIcon}>⚔️</div>
          <h1 className={`pixel-title ${styles.heroTitle}`}>綜合模式考試大廳</h1>
          <p className={styles.heroSub}>準備好迎接挑戰了嗎？確認規則後即可開始！</p>
        </section>

        <div className={styles.grid}>
          {/* 左欄：考試規則 */}
          <section className={`pixel-panel ${styles.rulesPanel}`}>
            <h2 className={`pixel-title ${styles.panelTitle}`}>📜 考試規則</h2>
            <ul className={styles.ruleList}>
              {QUIZ_RULES.map((rule) => (
                <li key={rule.label} className={styles.ruleItem}>
                  <span className={styles.ruleIcon}>{rule.icon}</span>
                  <div>
                    <span className={styles.ruleLabel}>{rule.label}</span>
                    <span className={styles.ruleValue}>{rule.value}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* 最高分顯示 */}
            <div className={styles.bestScoreBox}>
              <span className={styles.bestScoreLabel}>🏆 個人最高分</span>
              <span className={`pixel-title ${styles.bestScoreValue} ${bestScore >= 90 ? styles.passed : styles.failed}`}>
                {bestScore} 分
              </span>
            </div>

            {/* 開始按鈕 */}
            <button
              id="btn-start-exam"
              className={`btn-pixel btn-primary ${styles.startBtn}`}
              onClick={handleStart}
              disabled={isStarting}
            >
              {isStarting ? (
                <span className={styles.startingText}>⏳ 準備中...</span>
              ) : (
                <>⚔️ 開始考試</>
              )}
            </button>
          </section>

          {/* 右欄：歷史成績 */}
          <section className={`pixel-panel ${styles.historyPanel}`}>
            <h2 className={`pixel-title ${styles.panelTitle}`}>📊 歷次成績</h2>

            {loadingHistory ? (
              <div className={styles.emptyHistory}>
                <p>⏳ 正在讀取雲端歷次紀錄...</p>
              </div>
            ) : cloudExams.length === 0 ? (
              <div className={styles.emptyHistory}>
                <p>尚無考試記錄</p>
                <p className={styles.emptyHint}>完成第一次考試後記錄將顯示於此</p>
              </div>
            ) : (
              <div className={styles.historyList}>
                {cloudExams.map((exam, idx) => (
                  <div key={exam.id} className={`${styles.historyCard} ${exam.passed ? styles.cardPassed : styles.cardFailed}`}>
                    <div className={styles.historyRank}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </div>
                    <div className={styles.historyInfo}>
                      <span className={styles.historyDate}>
                        {exam.startedAt?.toLocaleDateString ? exam.startedAt.toLocaleDateString() : '最近測驗'}
                      </span>
                      <span className={styles.historyCorrect}>
                        選擇題得分 {exam.choiceScore} 分
                      </span>
                    </div>
                    <div className={styles.historyScoreWrap}>
                      <span className={`pixel-title ${styles.historyScore} ${exam.passed ? styles.scorePassed : styles.scoreFailed}`}>
                        {exam.score}
                      </span>
                      <span className={styles.historyUnit}>分</span>
                      <span className={`${styles.historyBadge} ${exam.passed ? styles.badgePassed : styles.badgeFailed}`}>
                        {exam.status === 'submitted' ? '⏳ 待主管審核' : exam.passed ? '✅ 通過' : '❌ 未通過'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.historyNote}>
              <span className={styles.noteText}>💡 排行榜以最高分計算</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
