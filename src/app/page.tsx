'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import styles from './page.module.css'
import { getEssayLock } from '@/lib/examSession'

export default function HomePage() {
  const { user, userDoc, loading, logout } = useAuth()
  const router = useRouter()

  // 模擬狀態
  const [currentRole, setCurrentRole] = useState<'examinee' | 'supervisor'>('examinee')
  const [hasEssayLock, setHasEssayLock] = useState<boolean>(false)

  // 檢查是否登入與是否填寫顯示名稱
  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!userDoc?.displayName) router.replace('/setup')
    }
  }, [loading, user, userDoc, router])

  // 檢查申論題未完成狀態
  useEffect(() => {
    const lock = getEssayLock()
    setHasEssayLock(!!lock)
  }, [])

  if (loading || !userDoc) return (
    <div className={styles.loading}>
      <p className="pixel-title">載入中...</p>
    </div>
  )

  const displayName = userDoc.displayName || '客服勇者'

  return (
    <main className={styles.main}>
      {/* 頂部導覽列 */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <span className={`pixel-title ${styles.navTitle}`}>🍁 客服考核大廳</span>
          {/* 角色切換選單（方便體驗主管與考生視角） */}
          <div className={styles.roleToggleGroup}>
            <span className={styles.roleLabel}>🎭 體驗視角：</span>
            <button
              className={`${styles.roleBtn} ${currentRole === 'examinee' ? styles.roleActive : ''}`}
              onClick={() => setCurrentRole('examinee')}
            >
              考生
            </button>
            <button
              className={`${styles.roleBtn} ${currentRole === 'supervisor' ? styles.roleActive : ''}`}
              onClick={() => setCurrentRole('supervisor')}
            >
              👑 主管
            </button>
          </div>
        </div>

        <div className={styles.navRight}>
          <span className={styles.playerName}>
            👤 {displayName} ({currentRole === 'supervisor' ? '主管權限' : '客服新人'})
          </span>
          <button
            id="btn-logout"
            className={`btn-pixel btn-ghost ${styles.logoutBtn}`}
            onClick={logout}
          >
            登出
          </button>
        </div>
      </nav>

      {/* 主內容容器 */}
      <div className={`container ${styles.content}`}>
        {/* 楓之谷風格 NPC 冒險對話頭像區 */}
        <section className={styles.npcBanner}>
          <div className={styles.npcAvatarBox}>
            <span className={styles.npcPixelArt}>🧙‍♂️</span>
            <span className={styles.npcName}>教官 皮卡丘</span>
          </div>
          <div className={styles.dialogBox}>
            <div className={styles.dialogHeader}>【考核特訓營大廳】</div>
            <p className={styles.dialogText}>
              {currentRole === 'examinee'
                ? `歡迎來到星光冒險營！${displayName}，今天的客服考核準備好了嗎？完成綜合與申論模式提升你的實戰能力吧！`
                : `歡迎主管！在此您可以批改考生的申論題、追蹤考試記錄與管理團隊實力。`}
            </p>
          </div>
        </section>

        {/* 月度任務提示條（僅考生視角且有未完成/審核中申論時顯示） */}
        {currentRole === 'examinee' && (
          <section className={styles.noticeBanner}>
            <div className={styles.noticeIcon}>📢</div>
            <div className={styles.noticeContent}>
              <strong>【本月任務提醒】</strong> 
              {hasEssayLock 
                ? ' 您有一場申論考試已提交，目前正等待主管審核評分中！'
                : ' 依據規範，客服新人每個月至少需提交一次「申論模式」情境考核。'}
            </div>
            <button
              className="btn-pixel btn-secondary"
              onClick={() => router.push('/exam/essay/lobby')}
            >
              {hasEssayLock ? '查看進度' : '前往申論考場'}
            </button>
          </section>
        )}

        {/* 模式選擇卡片區域 */}
        <section className={styles.modeSection}>
          <h2 className={`pixel-title ${styles.sectionTitle}`}>⚔️ 冒險考核模式</h2>
          <div className={styles.modeGrid}>
            {/* 綜合模式卡片 */}
            <div className={`pixel-panel ${styles.modeCard}`}>
              <div className={styles.modeBadge}>無限刷題</div>
              <div className={styles.modeIcon}>⚔️</div>
              <h3 className={`pixel-title ${styles.modeName}`}>綜合模式</h3>
              <p className={styles.modeDesc}>
                選擇題 + 問答題混合出題<br />
                20 題 · 每題 5 分鐘 · 即時評分
              </p>
              <ul className={styles.modeFeatures}>
                <li>✅ 交卷後立即試算出總分</li>
                <li>✅ 附帶詳細錯題解析對照</li>
                <li>✅ 可多次刷題，排行榜採最高分</li>
              </ul>
              <button
                id="btn-start-quiz"
                className={`btn-pixel btn-primary ${styles.startBtn}`}
                onClick={() => router.push('/exam/quiz/lobby')}
              >
                進入綜合大廳 →
              </button>
            </div>

            {/* 申論模式卡片 */}
            <div className={`pixel-panel ${styles.modeCard}`}>
              <div className={styles.modeBadgeBlue}>月度必考</div>
              <div className={styles.modeIcon}>📝</div>
              <h3 className={`pixel-title ${styles.modeName}`}>申論模式</h3>
              <p className={styles.modeDesc}>
                模擬實務客服真實情境<br />
                10 題 · 每題 10 分鐘 · 主管人工審核
              </p>
              <ul className={styles.modeFeatures}>
                <li>📋 主管針對應答進行評分與評語</li>
                <li>🔒 一次只能進行一場申論考試</li>
                <li>📅 批改完成後解鎖並通知成果</li>
              </ul>
              <button
                id="btn-start-essay"
                className={`btn-pixel btn-secondary ${styles.startBtn}`}
                onClick={() => router.push('/exam/essay/lobby')}
              >
                {hasEssayLock ? '查看申論狀況 →' : '進入申論考場 →'}
              </button>
            </div>
          </div>
        </section>

        {/* 功能入口及主管專屬區域 */}
        <section className={styles.portalSection}>
          <h2 className={`pixel-title ${styles.sectionTitle}`}>
            {currentRole === 'supervisor' ? '👑 主管管理選單' : '📊 冒險成就與統計'}
          </h2>
          <div className={styles.quickLinks}>
            {/* 全員功能 */}
            <button
              id="btn-leaderboard"
              className={`btn-pixel btn-ghost ${styles.quickBtn}`}
              onClick={() => router.push('/leaderboard')}
            >
              🏆 冒險排行榜
            </button>
            <button
              id="btn-my-results"
              className={`btn-pixel btn-ghost ${styles.quickBtn}`}
              onClick={() => router.push('/profile/results')}
            >
              📊 我的歷次成績與錯題
            </button>

            {/* 主管視角下高亮顯示批改入口 */}
            {currentRole === 'supervisor' && (
              <button
                id="btn-admin-grade"
                className={`btn-pixel btn-primary ${styles.adminBtn}`}
                onClick={() => router.push('/admin/grade')}
              >
                👑 審核與批改申論題 (Grade)
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
