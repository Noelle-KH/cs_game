'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import styles from './page.module.css'

export default function LoginPage() {
  const { user, userDoc, loading, signInWithGoogle, devBypassLogin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      // 已登入且有顯示名稱 → 進首頁
      if (userDoc?.displayName) {
        router.replace('/')
      } else {
        // 已登入但無顯示名稱 → 設定頁
        router.replace('/setup')
      }
    }
  }, [loading, user, userDoc, router])

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <p className="pixel-title">載入中...</p>
      </div>
    )
  }

  return (
    <main className={styles.main}>
      {/* 背景裝飾星星 */}
      <div className={styles.stars} aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i} className={styles.star} style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            width: `${Math.random() > 0.7 ? 4 : 2}px`,
            height: `${Math.random() > 0.7 ? 4 : 2}px`,
          }} />
        ))}
      </div>

      {/* 登入卡片 */}
      <div className={`pixel-panel ${styles.card}`}>
        {/* Logo / 標題 */}
        <div className={styles.logoArea}>
          <div className={`${styles.logoIcon} animate-float`} aria-hidden="true">
            🍁
          </div>
          <h1 className={`pixel-title ${styles.title}`}>客服考核遊戲</h1>
          <p className={styles.subtitle}>CS Quiz Adventure</p>
        </div>

        {/* 分隔線 */}
        <div className={styles.divider} />

        {/* 說明文字 */}
        <p className={styles.desc}>
          使用 Google 帳號登入，開始你的考核冒險！
        </p>

        {/* Google 登入按鈕 */}
        <button
          id="btn-google-login"
          className={`btn-pixel btn-primary ${styles.googleBtn}`}
          onClick={signInWithGoogle}
        >
          <GoogleIcon />
          以 Google 帳號登入
        </button>

        {/* 快速模擬登入按鈕（開發測試免登入） */}
        <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '12px' }}>
          <button
            id="btn-dev-bypass-examinee"
            className={`btn-pixel btn-secondary ${styles.devBypassBtn}`}
            style={{ flex: 1, fontSize: '0.8rem' }}
            onClick={() => devBypassLogin('examinee')}
          >
            🚀 [DEV] 免登入 (考生)
          </button>
          <button
            id="btn-dev-bypass-admin"
            className={`btn-pixel btn-secondary ${styles.devBypassBtn}`}
            style={{ flex: 1, fontSize: '0.8rem', borderColor: '#f39c12', color: '#f39c12' }}
            onClick={() => devBypassLogin('admin')}
          >
            👑 [DEV] 免登入 (主管)
          </button>
        </div>

        {/* 版本標記 */}
        <p className={styles.version}>v1.0 · Phase 1</p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#fff" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"/>
      <path fill="#fff" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96a4.3 4.3 0 0 1-1.84 2.81l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.51z"/>
      <path fill="#fff" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"/>
      <path fill="#fff" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.78.53-1.79.85-3.12.85-2.38 0-4.4-1.57-5.12-3.74L.88 12.99C2.36 15.98 5.48 18 9 18z"/>
    </svg>
  )
}
