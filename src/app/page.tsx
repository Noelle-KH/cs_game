'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import styles from './page.module.css'

export default function HomePage() {
  const { user, userDoc, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!userDoc?.displayName) router.replace('/setup')
    }
  }, [loading, user, userDoc, router])

  if (loading || !userDoc) return (
    <div className={styles.loading}>
      <p className="pixel-title">載入中...</p>
    </div>
  )

  return (
    <main className={styles.main}>
      {/* 頂部導覽列 */}
      <nav className={styles.navbar}>
        <span className={`pixel-title ${styles.navTitle}`}>🍁 客服考核遊戲</span>
        <div className={styles.navRight}>
          <span className={styles.playerName}>👤 {userDoc.displayName}</span>
          <button
            id="btn-logout"
            className={`btn-pixel btn-ghost ${styles.logoutBtn}`}
            onClick={logout}
          >
            登出
          </button>
        </div>
      </nav>

      {/* 主內容 */}
      <div className={`container ${styles.content}`}>
        {/* 歡迎標語 */}
        <section className={styles.heroSection}>
          <h1 className={`pixel-title ${styles.heroTitle}`}>
            歡迎回來，{userDoc.displayName}！
          </h1>
          <p className={styles.heroSub}>選擇你的挑戰模式，開始今天的考核冒險</p>
        </section>

        {/* 模式選擇卡片 */}
        <section className={styles.modeGrid}>
          {/* 綜合模式 */}
          <div className={`pixel-panel ${styles.modeCard}`}>
            <div className={styles.modeIcon}>⚔️</div>
            <h2 className={`pixel-title ${styles.modeName}`}>綜合模式</h2>
            <p className={styles.modeDesc}>
              選擇題 + 問答題混合出題<br />
              20 題 · 每題 5 分鐘 · 即時評分
            </p>
            <ul className={styles.modeFeatures}>
              <li>✅ 交卷後立即看分數</li>
              <li>✅ 錯題解析一目瞭然</li>
              <li>✅ 可無限刷題衝高分</li>
            </ul>
            <button
              id="btn-start-quiz"
              className={`btn-pixel btn-primary ${styles.startBtn}`}
              onClick={() => router.push('/exam/quiz/lobby')}
            >
              開始挑戰 →
            </button>
          </div>

          {/* 申論模式 */}
          <div className={`pixel-panel ${styles.modeCard}`}>
            <div className={styles.modeIcon}>📝</div>
            <h2 className={`pixel-title ${styles.modeName}`}>申論模式</h2>
            <p className={styles.modeDesc}>
              情境申論題<br />
              10 題 · 每題 10 分鐘 · 主管評分
            </p>
            <ul className={styles.modeFeatures}>
              <li>📋 主管逐題批改評語</li>
              <li>🔔 批改完成系統通知</li>
              <li>📅 每月至少提交一次</li>
            </ul>
            <button
              id="btn-start-essay"
              className={`btn-pixel btn-secondary ${styles.startBtn}`}
              onClick={() => router.push('/exam/essay/lobby')}
            >
              開始申論 →
            </button>
          </div>
        </section>

        {/* 快捷連結 */}
        <section className={styles.quickLinks}>
          <button
            id="btn-leaderboard"
            className={`btn-pixel btn-ghost ${styles.quickBtn}`}
            onClick={() => router.push('/leaderboard')}
          >
            🏆 排行榜
          </button>
          <button
            id="btn-my-results"
            className={`btn-pixel btn-ghost ${styles.quickBtn}`}
            onClick={() => router.push('/profile/results')}
          >
            📊 我的成績
          </button>
        </section>
      </div>
    </main>
  )
}
