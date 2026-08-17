'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase/client'
import styles from './page.module.css'

export default function SetupPage() {
  const { user, userDoc, loading, refreshUserDoc } = useAuth()
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login')
      } else if (userDoc?.displayName) {
        // 已設定顯示名稱，不需要再設定
        router.replace('/')
      }
    }
  }, [loading, user, userDoc, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setError('請輸入顯示名稱')
      return
    }
    if (trimmed.length < 2) {
      setError('名稱至少需要 2 個字元')
      return
    }
    if (!user) return

    setSubmitting(true)
    setError('')

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email,
          displayName: trimmed,
          role: userDoc?.role || 'examinee',
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      )
      await refreshUserDoc()
      router.replace('/')
    } catch (err) {
      console.error(err)
      setError('建立帳號失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <main className={styles.main}>
      <div className={`pixel-panel ${styles.card}`}>
        {/* 頭像區 */}
        <div className={styles.avatarArea}>
          <div className={`${styles.avatar} animate-float`} aria-hidden="true">
            🧑‍💼
          </div>
          <h1 className={`pixel-title ${styles.title}`}>建立你的角色</h1>
          <p className={styles.subtitle}>Create Your Character</p>
        </div>

        <div className={styles.divider} />

        {/* 說明 */}
        <p className={styles.desc}>
          請輸入你的顯示名稱（真實姓名），<br />
          這將會顯示在排行榜與成績紀錄中。
        </p>

        {/* 表單 */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="input-display-name" className={styles.label}>
              顯示名稱
            </label>
            <input
              id="input-display-name"
              type="text"
              className={styles.input}
              placeholder="例如：王小明"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={20}
              disabled={submitting}
              autoFocus
            />
            {error && (
              <p className={styles.errorMsg} role="alert">{error}</p>
            )}
            <p className={styles.hint}>
              {displayName.trim().length} / 20 字元
            </p>
          </div>

          <button
            id="btn-setup-submit"
            type="submit"
            className={`btn-pixel btn-primary ${styles.submitBtn}`}
            disabled={submitting || !displayName.trim()}
          >
            {submitting ? '建立中...' : '開始冒險！'}
          </button>
        </form>

        {/* Google 帳號提示 */}
        {user && (
          <p className={styles.accountHint}>
            登入帳號：{user.email}
          </p>
        )}
      </div>
    </main>
  )
}
