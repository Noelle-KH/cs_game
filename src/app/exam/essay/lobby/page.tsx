'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserDoc } from '@/types'
import { getEssayLock, clearEssayLock } from '@/lib/examSession'
import { getUserExamsFirestore, createExamFirestore, CloudExamDoc } from '@/lib/examStore'
import { getSystemSettings } from '@/lib/settingsStore'
import { SettingsDoc } from '@/types'
import styles from './page.module.css'

// 輔助函式：格式化秒數為易讀字串
function formatTimeText(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 秒'
  if (seconds < 60) return `${seconds} 秒`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins} 分 ${secs} 秒` : `${mins} 分鐘`
}

export default function EssayLobbyPage() {
  const { user, userDoc, loading, logout } = useAuth()
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [existingLock, setExistingLock] = useState<ReturnType<typeof getEssayLock>>(null)
  const [essayHistory, setEssayHistory] = useState<CloudExamDoc[]>([])
  const [hasSubmittedThisMonth, setHasSubmittedThisMonth] = useState(false)
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false)
  const [sysSettings, setSysSettings] = useState<SettingsDoc>({
    sheetsIdQuestions: '',
    sheetsIdResults: '',
    passThreshold: 90,
    quizQuestionCount: 20,
    essayQuestionCount: 10,
    quizTimePerQuestion: 300,
    essayTimePerQuestion: 600,
  })

  const now = new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // 未登入自動重導回 /login
  useEffect(() => {
    if (!loading && !userDoc) {
      router.replace('/login')
    }
  }, [loading, userDoc, router])

  useEffect(() => {
    setExistingLock(getEssayLock())
    async function loadSettings() {
      const s = await getSystemSettings()
      setSysSettings(s)
    }
    loadSettings()
  }, [])

  const dynamicEssayRules = [
    { icon: '📝', label: '題型', value: `申論題，共 ${sysSettings.essayQuestionCount} 題` },
    { icon: '⏱️', label: '計時', value: `每題 ${formatTimeText(sysSettings.essayTimePerQuestion)} 倒數，超時自動換題` },
    { icon: '🎯', label: '評分方式', value: `主管逐題批改（每題 0–${Math.round(100 / (sysSettings.essayQuestionCount || 10))} 分，滿分 100）` },
    { icon: '🔔', label: '批改通知', value: '主管批改完成後系統推送通知' },
    { icon: '⚠️', label: '並行限制', value: '同時只能存在一場（含待批改中）' },
    { icon: '📅', label: '提交頻率', value: '每月至少提交一次，首頁顯示提醒' },
  ]

  useEffect(() => {
    if (!userDoc?.uid) {
      if (!loading) setIsHistoryLoaded(true)
      return
    }
    const currentUid = userDoc.uid
    async function loadCloudHistory() {
      try {
        const allExams = await getUserExamsFirestore(currentUid)
        const essayExams = allExams.filter((e) => e.mode === 'essay')
        setEssayHistory(essayExams)

        // 檢查本月是否有提交紀錄 (submitted 或 graded)
        const submittedThisMonth = essayExams.some((e) => {
          if (!e.submittedAt) return false
          const d = new Date(e.submittedAt)
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          return ym === currentYearMonth
        })
        setHasSubmittedThisMonth(submittedThisMonth)

        // 檢查是否包含狀態為 submitted 待審核中的考卷
        const pendingExam = essayExams.find((e) => e.status === 'submitted')
        if (pendingExam) {
          // 雲端仍有待批改考卷 -> 保持/補上鎖定
          const lockObj = {
            examId: pendingExam.id,
            startedAt: pendingExam.startedAt?.toISOString
              ? pendingExam.startedAt.toISOString()
              : new Date().toISOString(),
          }
          setExistingLock(lockObj)
        } else {
          // 雲端無待批改考卷（已完成批改或無考卷） -> 自動釋放本地 Lock 鎖定
          clearEssayLock()
          setExistingLock(null)
        }
      } finally {
        setIsHistoryLoaded(true)
      }
    }
    loadCloudHistory()
  }, [userDoc, currentYearMonth, loading])

  if (loading || !userDoc || !isHistoryLoaded) {
    return (
      <div className={styles.loading}>
        <p className="pixel-title">載入中...</p>
      </div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  async function handleStart() {
    if (existingLock || hasSubmittedThisMonth || !userDoc) {
      if (hasSubmittedThisMonth) alert('⚠️ 您本月份已完成申論模式考核，每月限提交一次！')
      return
    }
    setIsStarting(true)

    try {
      const newExamId = `essay-${Date.now()}`
      await createExamFirestore({
        id: newExamId,
        uid: userDoc.uid,
        userEmail: userDoc.email,
        displayName: userDoc.displayName,
        mode: 'essay',
        answers: [],
      })
      router.push(`/exam/essay/${newExamId}`)
    } catch (e) {
      console.error('Failed to create essay exam in Firestore:', e)
      alert('⚠️ 建立申論考卷失敗，請確認網路連線')
      setIsStarting(false)
    }
  }

  function handleDevClearLock() {
    clearEssayLock()
    setExistingLock(null)
  }

  const monthDisplay = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`

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
        <span className={`pixel-title ${styles.navTitle}`}>📝 申論模式</span>
        <div className={styles.navRight}>
          <span className={styles.playerName}>👤 {userDoc.displayName}</span>
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
          <div className={styles.heroIcon}>📝</div>
          <h1 className={`pixel-title ${styles.heroTitle}`}>申論模式考試大廳</h1>
          <p className={styles.heroSub}>深度情境申論，由主管親自評分批改</p>
        </section>

        {/* 本月提醒 */}
        {!hasSubmittedThisMonth && (
          <div className={styles.monthAlert}>
            <span className={styles.alertIcon}>⚠️</span>
            <span className={styles.alertText}>
              <strong>{monthDisplay}</strong> 尚未提交申論考試，請盡快完成！
            </span>
          </div>
        )}

        {/* 進行中提示 */}
        {existingLock && (
          <div className={styles.lockBanner}>
            <div className={styles.lockIcon}>🔒</div>
            <div className={styles.lockInfo}>
              <p className={`pixel-title ${styles.lockTitle}`}>你有一場申論等待批改中</p>
              <p className={styles.lockDesc}>
                場次 ID：<code>{existingLock.examId}</code><br />
                提交於：{new Date(existingLock.startedAt).toLocaleString('zh-TW')}
              </p>
              <p className={styles.lockHint}>
                等待主管批改完成後，即可開始新的申論考試。
              </p>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <button
                className={`btn-pixel btn-ghost ${styles.devClearBtn}`}
                onClick={handleDevClearLock}
              >
                ⚠️ DEV: 清除鎖定
              </button>
            )}
          </div>
        )}

        <div className={styles.grid}>
          {/* 左欄：考試規則 */}
          <section className={`pixel-panel ${styles.rulesPanel}`}>
            <h2 className={`pixel-title ${styles.panelTitle}`}>📜 考試規則</h2>
            <ul className={styles.ruleList}>
              {dynamicEssayRules.map((rule) => (
                <li key={rule.label} className={styles.ruleItem}>
                  <span className={styles.ruleIcon}>{rule.icon}</span>
                  <div>
                    <span className={styles.ruleLabel}>{rule.label}</span>
                    <span className={styles.ruleValue}>{rule.value}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* 開始按鈕 */}
            <button
              id="btn-start-essay"
              className={`btn-pixel btn-secondary ${styles.startBtn} ${(existingLock || hasSubmittedThisMonth) ? styles.startDisabled : ''}`}
              onClick={handleStart}
              disabled={isStarting || !!existingLock || hasSubmittedThisMonth}
            >
              {isStarting ? (
                <span className={styles.startingText}>⏳ 準備中...</span>
              ) : existingLock ? (
                <>🔒 等待主管批改中（暫無法開始）</>
              ) : hasSubmittedThisMonth ? (
                <>✅ 本月申論任務已完成</>
              ) : (
                <>📝 開始申論考試</>
              )}
            </button>

            {existingLock ? (
              <p className={styles.lockHintSmall}>
                批改完成後你將收到系統通知，請耐心等候。
              </p>
            ) : hasSubmittedThisMonth ? (
              <p className={styles.lockHintSmall} style={{ color: '#4ade80' }}>
                🎉 本月申論考核任務已達標！下個月將開放新的申論特訓。
              </p>
            ) : null}
          </section>

          {/* 右欄：歷史成績 */}
          <section className={`pixel-panel ${styles.historyPanel}`}>
            <h2 className={`pixel-title ${styles.panelTitle}`}>📊 歷次申論成績</h2>

            {essayHistory.length === 0 ? (
              <div className={styles.emptyHistory}>
                <p>尚無申論記錄</p>
                <p className={styles.emptyHint}>完成第一次申論後記錄將顯示於此</p>
              </div>
            ) : (
              <div className={styles.historyList}>
                {essayHistory.map((exam) => (
                  <div
                    key={exam.id}
                    className={`${styles.historyCard} ${
                      exam.status === 'graded'
                        ? exam.passed
                          ? styles.cardPassed
                          : styles.cardFailed
                        : styles.cardPending
                    }`}
                  >
                    <div className={styles.historyInfo}>
                      <span className={styles.historyDate}>
                        {exam.submittedAt
                          ? new Date(exam.submittedAt).toLocaleDateString('zh-TW')
                          : new Date(exam.startedAt).toLocaleDateString('zh-TW')}
                      </span>
                      <span className={`${styles.statusBadge} ${
                        exam.status === 'graded'
                          ? exam.passed ? styles.badgePassed : styles.badgeFailed
                          : styles.badgePending
                      }`}>
                        {exam.status === 'graded'
                          ? exam.passed ? '✅ 通過' : '❌ 未通過'
                          : '⏳ 待批改'}
                      </span>
                    </div>
                    <div className={styles.historyScoreWrap}>
                      {exam.status === 'graded' ? (
                        <>
                          <span className={`pixel-title ${styles.historyScore} ${exam.passed ? styles.scorePassed : styles.scoreFailed}`}>
                            {exam.score}
                          </span>
                          <span className={styles.historyUnit}>/ 100 分</span>
                        </>
                      ) : (
                        <span className={styles.pendingText}>批改中...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.historyNote}>
              <span className={styles.noteText}>💡 申論成績由主管評定，滿分 100 分</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
