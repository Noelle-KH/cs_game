'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserDoc } from '@/types'
import {
  getEssayLock,
  clearEssayLock,
  setEssayLock,
} from '@/lib/examSession'
import styles from './page.module.css'

// ⚠️ 開發模式 Mock 使用者
const DEV_MOCK_USERDOC: UserDoc = {
  uid: 'dev-uid-001',
  email: 'dev@example.com',
  displayName: '開發測試員',
  role: 'examinee',
  createdAt: new Date('2026-01-01'),
  lastLoginAt: new Date(),
}

// 歷史與分數統計（潔淨狀態）
const MOCK_ESSAY_HISTORY: any[] = []

const THIS_MONTH = '2026-08' // 模擬當月（待換為真實邏輯）
const HAS_SUBMITTED_THIS_MONTH = false // 模擬本月是否已提交（待換為真實邏輯）

const ESSAY_RULES = [
  { icon: '📝', label: '題型', value: '申論題，共 10 題' },
  { icon: '⏱️', label: '計時', value: '每題 10 分鐘倒數，超時自動換題' },
  { icon: '🎯', label: '評分方式', value: '主管逐題批改（每題 0–10 分，滿分 100）' },
  { icon: '🔔', label: '批改通知', value: '主管批改完成後系統推送通知' },
  { icon: '⚠️', label: '並行限制', value: '同時只能存在一場（含待批改中）' },
  { icon: '📅', label: '提交頻率', value: '每月至少提交一次，首頁顯示提醒' },
]
// ─────────────────────────────────────────────────────────────────

export default function EssayLobbyPage() {
  const { user, userDoc, loading, logout } = useAuth()
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [existingLock, setExistingLock] = useState<ReturnType<typeof getEssayLock>>(null)

  const isDev = process.env.NODE_ENV === 'development'
  const effectiveUserDoc = userDoc ?? (isDev && !loading ? DEV_MOCK_USERDOC : null)

  useEffect(() => {
    setExistingLock(getEssayLock())
  }, [])

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

  async function handleStart() {
    if (existingLock) return // 有未完成場次，不允許開始
    setIsStarting(true)

    // 假資料：建立一個假 examId 並上鎖
    await new Promise((r) => setTimeout(r, 800))
    const newExamId = `essay-mock-${Date.now()}`
    setEssayLock(newExamId)
    router.push(`/exam/essay/${newExamId}`)
  }

  // DEV 用：清除鎖定（方便反覆測試）
  function handleDevClearLock() {
    clearEssayLock()
    setExistingLock(null)
  }

  const hasSubmittedThisMonth = HAS_SUBMITTED_THIS_MONTH
  const monthDisplay = THIS_MONTH.replace('-', ' 年 ') + ' 月'

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
            {isDev && (
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
              {ESSAY_RULES.map((rule) => (
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
              className={`btn-pixel btn-secondary ${styles.startBtn} ${existingLock ? styles.startDisabled : ''}`}
              onClick={handleStart}
              disabled={isStarting || !!existingLock}
            >
              {isStarting ? (
                <span className={styles.startingText}>⏳ 準備中...</span>
              ) : existingLock ? (
                <>🔒 等待批改中（無法開始）</>
              ) : (
                <>📝 開始申論考試</>
              )}
            </button>

            {existingLock && (
              <p className={styles.lockHintSmall}>
                批改完成後你將收到系統通知，再回來開始新一場。
              </p>
            )}
          </section>

          {/* 右欄：歷史成績 */}
          <section className={`pixel-panel ${styles.historyPanel}`}>
            <h2 className={`pixel-title ${styles.panelTitle}`}>📊 歷次申論成績</h2>

            {MOCK_ESSAY_HISTORY.length === 0 ? (
              <div className={styles.emptyHistory}>
                <p>尚無申論記錄</p>
                <p className={styles.emptyHint}>完成第一次申論後記錄將顯示於此</p>
              </div>
            ) : (
              <div className={styles.historyList}>
                {MOCK_ESSAY_HISTORY.map((exam) => (
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
                      <span className={styles.historyDate}>{exam.date}</span>
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
                            {exam.totalScore}
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
