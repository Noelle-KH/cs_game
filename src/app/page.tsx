'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import styles from './page.module.css'
import { getEssayLock } from '@/lib/examSession'
import { getUserExamsFirestore } from '@/lib/examStore'
import { getSystemSettings } from '@/lib/settingsStore'
import { SettingsDoc } from '@/types'

export default function HomePage() {
  const { user, userDoc, userDocLoaded, loading, logout } = useAuth()
  const router = useRouter()

  const [hasEssayLock, setHasEssayLock] = useState<boolean>(false)
  const [hasSubmittedThisMonth, setHasSubmittedThisMonth] = useState<boolean>(false)
  const [isStatusLoaded, setIsStatusLoaded] = useState<boolean>(false)
  const [sysSettings, setSysSettings] = useState<SettingsDoc>({
    sheetsIdQuestions: '',
    sheetsIdResults: '',
    passThreshold: 90,
    quizQuestionCount: 20,
    essayQuestionCount: 10,
    quizTimePerQuestion: 300,
    essayTimePerQuestion: 600,
  })

  // 檢查是否登入與是否填寫顯示名稱
  useEffect(() => {
    if (!loading && userDocLoaded) {
      if (!user) router.replace('/login')
      else if (!userDoc?.displayName) router.replace('/setup')
    }
  }, [loading, userDocLoaded, user, userDoc, router])

  // 實時查詢雲端考卷與系統參數
  useEffect(() => {
    if (!userDoc?.uid) return
    const currentUid = userDoc.uid
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    async function checkCloudStatus() {
      try {
        const settings = await getSystemSettings()
        setSysSettings(settings)

        const lock = getEssayLock()
        let isLocked = !!lock

        const userExams = await getUserExamsFirestore(currentUid)
        const essayExams = userExams.filter((e) => e.mode === 'essay')

        // 檢查雲端是否有本月提交/已批改的申論考卷
        const submittedThisMonth = essayExams.some((e) => {
          if (!e.submittedAt) return false
          const d = new Date(e.submittedAt)
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          return ym === currentYM
        })
        setHasSubmittedThisMonth(submittedThisMonth)

        // 若有待批改中的雲端申論考卷，同步呈現審核中狀態
        const pendingExam = essayExams.find((e) => e.status === 'submitted')
        if (pendingExam) {
          isLocked = true
        }
        setHasEssayLock(isLocked)
      } finally {
        setIsStatusLoaded(true)
      }
    }

    checkCloudStatus()
  }, [userDoc?.uid])

  // 格式化秒數為易讀字串（如不足 60 秒顯示 X 秒，剛好整分鐘顯示 X 分鐘，包含餘數顯示 X 分 Y 秒）
  function formatTimeText(seconds: number): string {
    if (!seconds || seconds <= 0) return '0 秒'
    if (seconds < 60) return `${seconds} 秒`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins} 分 ${secs} 秒` : `${mins} 分鐘`
  }

  if (loading || !userDoc || !isStatusLoaded) return (
    <div className={styles.loading}>
      <p className="pixel-title">載入中...</p>
    </div>
  )

  const displayName = userDoc.displayName || '客服勇者'
  const isSupervisorOrAdmin = userDoc.role === 'supervisor' || userDoc.role === 'admin'
  const isExaminee = !isSupervisorOrAdmin
  const showExamineeContent = isExaminee || userDoc.role === 'admin' // 管理員具備全視角存取權限

  return (
    <main className={styles.main}>
      {/* 頂部導覽列 */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <span className={`pixel-title ${styles.navTitle}`}>🍁 客服考核大廳</span>
        </div>

        <div className={styles.navRight}>
          <span className={styles.playerName}>
            👤 {displayName} ({
              userDoc.role === 'admin' 
                ? '系統管理員' 
                : userDoc.role === 'supervisor' 
                ? '主管權限' 
                : '客服新人'
            })
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
              {userDoc.role === 'admin'
                ? `歡迎系統管理員 ${displayName}！您擁有完整權限，可體驗考核模式、進行試卷批改、查看進度與設定系統參數。`
                : userDoc.role === 'supervisor'
                ? `歡迎主管 ${displayName}！在此您可以批改考生的申論題、追蹤全體考生的考核進度與維護系統題庫。`
                : `歡迎來到星光冒險營！${displayName}，今天的客服考核準備好了嗎？完成綜合與申論模式提升你的實戰能力吧！`}
            </p>
          </div>
        </section>

        {/* 月度任務提示條 */}
        {showExamineeContent && (
          <section className={`${styles.noticeBanner} ${hasSubmittedThisMonth && !hasEssayLock ? styles.noticeSuccess : ''}`}>
            <div className={styles.noticeIcon}>
              {hasEssayLock ? '⏳' : hasSubmittedThisMonth ? '✅' : '📢'}
            </div>
            <div className={styles.noticeContent}>
              <strong>【本月申論任務】</strong> 
              {hasEssayLock 
                ? ' 您有一場申論考試已提交，目前正等待主管審核評分中！'
                : hasSubmittedThisMonth
                ? ' 讚！您本月已順利完成申論模式考核任務！'
                : ' 依據規範，客服新人每個月至少需提交一次「申論模式」情境考核。'}
            </div>
            <button
              className="btn-pixel btn-secondary"
              onClick={() => router.push('/exam/essay/lobby')}
            >
              {hasEssayLock ? '查看進度' : hasSubmittedThisMonth ? '檢視紀錄 / 考場' : '前往申論考場'}
            </button>
          </section>
        )}

        {/* 模式選擇卡片區域（考生與管理員均可查看） */}
        {showExamineeContent && (
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
                  {sysSettings.quizQuestionCount} 題 · 每題 {formatTimeText(sysSettings.quizTimePerQuestion)} · 選擇自動/問答人工審核
                </p>
                <ul className={styles.modeFeatures}>
                  <li>✅ 交卷即試算選擇題得分，問答題由主管審核</li>
                  <li>✅ 附帶詳細錯題與正解解析對照</li>
                  <li>✅ 可多次刷題，完成審核後登錄最高分榜</li>
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
                  {sysSettings.essayQuestionCount} 題 · 每題 {formatTimeText(sysSettings.essayTimePerQuestion)} · 主管人工審核
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
        )}

        {/* 功能入口及主管專屬區域 */}
        <section className={styles.portalSection}>
          <h2 className={`pixel-title ${styles.sectionTitle}`}>
            {isSupervisorOrAdmin ? '👑 管理與統計控制台' : '📊 冒險成就與統計'}
          </h2>
          <div className={styles.quickLinks}>
            {/* 全員共通：查看排行榜 */}
            <button
              id="btn-leaderboard"
              className={`btn-pixel btn-ghost ${styles.quickBtn}`}
              onClick={() => router.push('/leaderboard')}
            >
              🏆 冒險排行榜
            </button>

            {/* 考生與管理員顯示：我的歷次成績與錯題 */}
            {showExamineeContent && (
              <button
                id="btn-my-results"
                className={`btn-pixel btn-ghost ${styles.quickBtn}`}
                onClick={() => router.push('/profile/results')}
              >
                📊 我的歷次成績與錯題
              </button>
            )}

            {/* 主管視角與管理員專屬 */}
            {isSupervisorOrAdmin && (
              <>
                <button
                  id="btn-admin-grade"
                  className={`btn-pixel btn-primary ${styles.adminBtn}`}
                  onClick={() => router.push('/admin/grade')}
                >
                  👑 審核與批改考卷
                </button>
                <button
                  id="btn-admin-users"
                  className={`btn-pixel btn-secondary ${styles.adminBtn}`}
                  onClick={() => router.push('/admin/users')}
                >
                  👥 團隊考核狀況與進度總覽
                </button>
                <button
                  id="btn-admin-questions"
                  className={`btn-pixel btn-ghost ${styles.adminBtn}`}
                  onClick={() => router.push('/admin/questions')}
                >
                  📚 題庫管理與 Excel 匯入
                </button>
              </>
            )}

            {/* 系統管理員 (Admin) 專屬：權限與參數設定 */}
            {userDoc.role === 'admin' && (
              <button
                id="btn-admin-settings"
                className={`btn-pixel ${styles.adminBtn}`}
                style={{
                  backgroundColor: '#3182ce',
                  borderColor: '#63b3ed',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(49, 130, 206, 0.4)'
                }}
                onClick={() => router.push('/admin/settings')}
              >
                ⚙️ 系統權限與參數管理
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
