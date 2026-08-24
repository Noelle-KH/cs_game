'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import styles from './settings.module.css'

import { getDocs, collection, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { getSystemSettings, saveSystemSettings } from '@/lib/settingsStore'

export default function AdminSettingsPage() {
  const { userDoc, role, loading, refreshUserDoc } = useAuth()
  const router = useRouter()

  // Admin 名單與 Supervisor 名單 state
  const [adminEmails, setAdminEmails] = useState<string[]>([])
  const [supervisorEmails, setSupervisorEmails] = useState<string[]>([])
  const [newEmailInput, setNewEmailInput] = useState('')
  const [newSupervisorEmailInput, setNewSupervisorEmailInput] = useState('')
  
  // 系統參數 state
  const [quizPassThreshold, setQuizPassThreshold] = useState(90)
  const [essayPassThreshold, setEssayPassThreshold] = useState(90)
  const [quizQuestionCount, setQuizQuestionCount] = useState(20)
  const [essayQuestionCount, setEssayQuestionCount] = useState(10)
  const [choiceTimePerQuestion, setChoiceTimePerQuestion] = useState(120)
  const [qaTimePerQuestion, setQaTimePerQuestion] = useState(300)
  const [essayTimePerQuestion, setEssayTimePerQuestion] = useState(600)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isSyncingSheets, setIsSyncingSheets] = useState(false)

  useEffect(() => {
    // 權限檢查：若非 admin 則無權造訪此頁面
    if (!loading && role && role !== 'admin') {
      router.replace('/')
    }

    // 載入預設的 Admin / Supervisor Emails
    const envAdmin = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'admin@example.com')
      .split(',')
      .map(e => e.trim())
    const envSupervisor = (process.env.NEXT_PUBLIC_SUPERVISOR_EMAILS || 'supervisor@example.com,manager@example.com')
      .split(',')
      .map(e => e.trim())
    
    if (typeof window !== 'undefined') {
      const storedAdmin = localStorage.getItem('cs_admin_emails')
      const storedSupervisor = localStorage.getItem('cs_supervisor_emails')
      
      setAdminEmails(storedAdmin ? JSON.parse(storedAdmin) : envAdmin)
      setSupervisorEmails(storedSupervisor ? JSON.parse(storedSupervisor) : envSupervisor)
    }

    // 載入雲端/本地系統參數設定
    async function loadSettings() {
      const s = await getSystemSettings()
      setQuizPassThreshold(s.quizPassThreshold ?? 90)
      setEssayPassThreshold(s.essayPassThreshold ?? 90)
      setQuizQuestionCount(s.quizQuestionCount ?? 20)
      setEssayQuestionCount(s.essayQuestionCount ?? 10)
      setChoiceTimePerQuestion(s.choiceTimePerQuestion ?? 120)
      setQaTimePerQuestion(s.qaTimePerQuestion ?? 300)
      setEssayTimePerQuestion(s.essayTimePerQuestion ?? 600)
    }
    loadSettings()
  }, [loading, role, router])

  const handleAddEmail = async () => {
    const trimmed = newEmailInput.trim().toLowerCase()
    if (!trimmed) return
    if (!trimmed.includes('@')) {
      showToast('⚠️ 請輸入有效的 Email 格式！')
      return
    }
    if (adminEmails.includes(trimmed)) {
      showToast('⚠️ 該 Email 已存在於系統管理員清單中！')
      return
    }

    const updated = [...adminEmails, trimmed]
    setAdminEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cs_admin_emails', JSON.stringify(updated))
    }
    setNewEmailInput('')

    // 同步寫入 Firestore users 集合的 role
    try {
      const q = query(collection(db, 'users'), where('email', '==', trimmed))
      const snap = await getDocs(q)
      snap.forEach(async (uDoc) => {
        await updateDoc(doc(db, 'users', uDoc.id), { role: 'admin' })
      })
    } catch (e) {
      console.error('Failed to sync admin role to Firestore:', e)
    }

    refreshUserDoc()
    showToast(`✅ 已新增系統管理員並同步雲端身分：${trimmed}`)
  }

  const handleRemoveEmail = async (emailToRemove: string) => {
    const trimmed = emailToRemove.trim().toLowerCase()
    const updated = adminEmails.filter(e => e !== trimmed)
    setAdminEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cs_admin_emails', JSON.stringify(updated))
    }

    // 同步更新 Firestore users 集合
    try {
      const q = query(collection(db, 'users'), where('email', '==', trimmed))
      const snap = await getDocs(q)
      snap.forEach(async (uDoc) => {
        await updateDoc(doc(db, 'users', uDoc.id), { role: 'examinee' })
      })
    } catch (e) {
      console.error('Failed to revert admin role in Firestore:', e)
    }

    refreshUserDoc()
    showToast(`🗑️ 已移除系統管理員：${emailToRemove}`)
  }

  const handleAddSupervisorEmail = async () => {
    const trimmed = newSupervisorEmailInput.trim().toLowerCase()
    if (!trimmed) return
    if (!trimmed.includes('@')) {
      showToast('⚠️ 請輸入有效的 Email 格式！')
      return
    }
    if (supervisorEmails.includes(trimmed)) {
      showToast('⚠️ 該 Email 已存在於主管授權清單中！')
      return
    }

    const updated = [...supervisorEmails, trimmed]
    setSupervisorEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cs_supervisor_emails', JSON.stringify(updated))
    }
    setNewSupervisorEmailInput('')

    // 同步更新 Firestore 中該 Email 使用者的真實 role 為 supervisor
    try {
      const q = query(collection(db, 'users'), where('email', '==', trimmed))
      const snap = await getDocs(q)
      snap.forEach(async (uDoc) => {
        await updateDoc(doc(db, 'users', uDoc.id), { role: 'supervisor' })
      })
    } catch (e) {
      console.error('Failed to sync supervisor role to Firestore:', e)
    }

    refreshUserDoc()
    showToast(`✅ 已新增主管授權並同步雲端身分：${trimmed}`)
  }

  const handleRemoveSupervisorEmail = async (emailToRemove: string) => {
    const trimmed = emailToRemove.trim().toLowerCase()
    const updated = supervisorEmails.filter(e => e !== trimmed)
    setSupervisorEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cs_supervisor_emails', JSON.stringify(updated))
    }

    // 同步更新 Firestore 中該 Email 使用者的真實 role 為 examinee
    try {
      const q = query(collection(db, 'users'), where('email', '==', trimmed))
      const snap = await getDocs(q)
      snap.forEach(async (uDoc) => {
        // 若該用戶不是 admin，則將其降級恢復為 examinee
        const data = uDoc.data() as any
        if (data.role !== 'admin') {
          await updateDoc(doc(db, 'users', uDoc.id), { role: 'examinee' })
        }
      })
    } catch (e) {
      console.error('Failed to revert supervisor role in Firestore:', e)
    }

    refreshUserDoc()
    showToast(`🗑️ 已移除主管授權：${emailToRemove}`)
  }

  const handleSaveSettings = async () => {
    await saveSystemSettings({
      quizPassThreshold,
      essayPassThreshold,
      passThreshold: quizPassThreshold,
      quizQuestionCount,
      essayQuestionCount,
      choiceTimePerQuestion,
      qaTimePerQuestion,
      essayTimePerQuestion,
    })
    showToast('💾 系統參數與管理員名單設定儲存成功！')
  }

  const handleSyncGoogleSheets = async () => {
    setIsSyncingSheets(true)
    try {
      // 1. 從雲端 Firestore 拉取所有非 in_progress 的已完成/已提交試卷
      const snap = await getDocs(collection(db, 'exams'))
      const allExams: any[] = []
      snap.forEach((d) => {
        const data = d.data()
        if (data.status && data.status !== 'in_progress') {
          allExams.push({ id: d.id, ...data })
        }
      })

      if (allExams.length === 0) {
        showToast('ℹ️ 目前雲端尚無可同步的考卷紀錄。')
        return
      }

      // 2. 逐筆呼叫匯出 API 送往 Google Sheets
      let successCount = 0
      for (const exam of allExams) {
        const userAttemptCount = allExams.filter(
          (e) => e.uid === exam.uid && e.mode === exam.mode
        ).length || 1

        const dateObj = exam.submittedAt?.toDate ? exam.submittedAt.toDate() : new Date()

        await fetch('/api/export-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: exam.email || 'examinee@example.com',
            displayName: exam.displayName || '客服勇者',
            date: dateObj.toLocaleString('zh-TW', { hour12: false }),
            mode: exam.mode,
            score: exam.score || 0,
            maxScore: 100,
            passed: exam.passed || false,
            attemptCount: userAttemptCount,
          }),
        })
        successCount++
      }

      showToast(`✅ 手動同步完成！已成功對齊並觸發 ${successCount} 筆成績資料至 Google Sheets！`)
    } catch (err: any) {
      console.error('Manual Sheet Sync Error:', err)
      showToast(`⚠️ 手動同步失敗：${err?.message || '未知錯誤'}`)
    } finally {
      setIsSyncingSheets(false)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  return (
    <div className={styles.container}>
      {/* 頁面 Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.backBtn}>
            ⬅️ 返回大廳
          </Link>
          <h1 className={styles.title}>⚙️ 系統權限與參數管理後台</h1>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.roleBadge}>Role: System Admin</span>
        </div>
      </header>

      {/* Toast 提示 */}
      {toastMessage && (
        <div className={styles.toast}>
          {toastMessage}
        </div>
      )}

      <div className={styles.mainLayout}>
        {/* 1. 管理員 Email 名單與權限設定 */}
        <section className={`pixel-panel ${styles.panel}`}>
          <h2 className={styles.panelTitle}>👑 系統管理員 (Admin) 名單授權</h2>
          <p className={styles.panelSub}>
            具備最高權限：包含 `/admin/settings` 系統參數設定與主管批改權限。
          </p>

          <div className={styles.addInputGroup}>
            <input
              type="email"
              placeholder="請輸入欲授權的 Admin Email..."
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              className={styles.emailInput}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
            />
            <button className="btn-pixel btn-primary" onClick={handleAddEmail}>
              ➕ 新增 Admin
            </button>
          </div>

          <div className={styles.emailList}>
            {adminEmails.length === 0 ? (
              <p className={styles.emptyText}>目前尚無額外設定的 Admin Email</p>
            ) : (
              adminEmails.map((email) => (
                <div key={email} className={styles.emailItem}>
                  <span className={styles.emailText}>⚙️ {email}</span>
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemoveEmail(email)}
                    title="移除權限"
                  >
                    🗑️ 移除
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 24, borderTop: '1px dashed #4a6fa5', paddingTop: 16 }}>
            <h2 className={styles.panelTitle} style={{ fontSize: '1.1rem' }}>👔 主管 (Supervisor) 名單授權</h2>
            <p className={styles.panelSub}>
              具備審核批改、團隊總覽與題庫維護權限（無 `/admin/settings` 設定權限）。
            </p>

            <div className={styles.addInputGroup}>
              <input
                type="email"
                placeholder="請輸入欲授權的主管 Email..."
                value={newSupervisorEmailInput}
                onChange={(e) => setNewSupervisorEmailInput(e.target.value)}
                className={styles.emailInput}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSupervisorEmail()}
              />
              <button className="btn-pixel btn-secondary" onClick={handleAddSupervisorEmail}>
                ➕ 新增主管
              </button>
            </div>

            <div className={styles.emailList}>
              {supervisorEmails.length === 0 ? (
                <p className={styles.emptyText}>目前尚無額外設定的主管 Email</p>
              ) : (
                supervisorEmails.map((email) => (
                  <div key={email} className={styles.emailItem}>
                    <span className={styles.emailText}>👔 {email}</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemoveSupervisorEmail(email)}
                      title="移除權限"
                    >
                      🗑️ 移除
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 2. 系統考試參數設定 */}
        <section className={`pixel-panel ${styles.panel}`}>
          <h2 className={styles.panelTitle}>🎛️ 考核遊戲核心參數設定</h2>
          <p className={styles.panelSub}>
            調整綜合與申論模式的題數上限、作答限時與合格分數分數門檻。
          </p>

          <div className={styles.formGrid}>
            <div className={styles.formItem}>
              <label className={styles.label}>🏆 綜合模式合格門檻分數 (0-100 分)：</label>
              <input
                type="number"
                min={50}
                max={100}
                value={quizPassThreshold}
                onChange={(e) => setQuizPassThreshold(parseInt(e.target.value) || 90)}
                className={styles.numInput}
              />
            </div>

            <div className={styles.formItem}>
              <label className={styles.label}>🏆 申論模式合格門檻分數 (0-100 分)：</label>
              <input
                type="number"
                min={50}
                max={100}
                value={essayPassThreshold}
                onChange={(e) => setEssayPassThreshold(parseInt(e.target.value) || 90)}
                className={styles.numInput}
              />
            </div>

            <div className={styles.formItem}>
              <label className={styles.label}>🎯 綜合模式每場抽題上限 (題)：</label>
              <input
                type="number"
                min={5}
                max={50}
                value={quizQuestionCount}
                onChange={(e) => setQuizQuestionCount(parseInt(e.target.value) || 20)}
                className={styles.numInput}
              />
            </div>

            <div className={styles.formItem}>
              <label className={styles.label}>📜 申論模式每場題數 (題)：</label>
              <input
                type="number"
                min={1}
                max={20}
                value={essayQuestionCount}
                onChange={(e) => setEssayQuestionCount(parseInt(e.target.value) || 10)}
                className={styles.numInput}
              />
            </div>

            <div className={styles.formItem}>
              <label className={styles.label}>⏱️ 選擇題單題限時 (秒)：</label>
              <input
                type="number"
                min={30}
                max={600}
                value={choiceTimePerQuestion}
                onChange={(e) => setChoiceTimePerQuestion(parseInt(e.target.value) || 120)}
                className={styles.numInput}
              />
            </div>

            <div className={styles.formItem}>
              <label className={styles.label}>⏱️ 問答題單題限時 (秒)：</label>
              <input
                type="number"
                min={30}
                max={1200}
                value={qaTimePerQuestion}
                onChange={(e) => setQaTimePerQuestion(parseInt(e.target.value) || 300)}
                className={styles.numInput}
              />
            </div>

            <div className={styles.formItem}>
              <label className={styles.label}>⏱️ 申論模式單題限時 (秒)：</label>
              <input
                type="number"
                min={60}
                max={1800}
                value={essayTimePerQuestion}
                onChange={(e) => setEssayTimePerQuestion(parseInt(e.target.value) || 600)}
                className={styles.numInput}
              />
            </div>
          </div>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <button className="btn-pixel btn-primary" onClick={handleSaveSettings}>
              💾 儲存所有系統設定
            </button>
          </div>
        </section>

        {/* 3. 手動觸發 Google Sheets 成績資料備份與同步 */}
        <section className={`pixel-panel ${styles.panel}`} style={{ gridColumn: '1 / -1' }}>
          <h2 className={styles.panelTitle}>📊 Google Sheets 成績數據手動同步備份</h2>
          <p className={styles.panelSub}>
            若遇到網路波動未自動同步，或需要臨時將全站最新雲端成績匯出至 Google Sheets 時，可點擊此按鈕進行人工批次比對寫入。
          </p>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--color-gray-3)', fontSize: '0.85rem' }}>
              💡 備註：系統平常會在每筆考卷批改完成時自動寫入；手動同步可補發漏傳紀錄。
            </div>
            <button
              className="btn-pixel btn-secondary"
              onClick={handleSyncGoogleSheets}
              disabled={isSyncingSheets}
              style={{ backgroundColor: '#2b6cb0', borderColor: '#4299e1', color: '#ffffff' }}
            >
              {isSyncingSheets ? '🚀 正在同步寫入 Google Sheets...' : '🔄 立即補同步所有成績至 Google Sheets'}
            </button>
          </div>
        </section>

        {/* 4. 系統測試重置工具 (清空 exams 與 questions) */}
        <section className={`pixel-panel ${styles.panel}`} style={{ gridColumn: '1 / -1', borderColor: 'var(--color-maple-red)' }}>
          <h2 className={styles.panelTitle} style={{ color: 'var(--color-maple-red)' }}>🧹 系統測試重置工具 (清空 Exams & Questions)</h2>
          <p className={styles.panelSub}>
            如需重頭開始測試或重新匯入標準題庫，可點擊下方連結前往 Firestore 專用資料重置頁面。
          </p>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--color-gray-3)', fontSize: '0.85rem' }}>
              ⚠️ 注意：此操作將徹底刪除雲端 `exams`（考卷紀錄）與 `questions`（題庫資料）。
            </div>
            <Link
              href="/admin/clear-db"
              className="btn-pixel btn-primary"
              style={{ backgroundColor: '#b91c1c', borderColor: '#ef4444', color: '#ffffff' }}
            >
              🔥 前往資料庫重置頁面 →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
