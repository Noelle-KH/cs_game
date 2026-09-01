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

  // 考生狀態管理 state
  const [examinees, setExaminees] = useState<any[]>([])
  const [editingExaminee, setEditingExaminee] = useState<any | null>(null)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState<'active' | 'resigned'>('active')
  const [editResignedMonth, setEditResignedMonth] = useState('')
  const [isSavingExaminee, setIsSavingExaminee] = useState(false)

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isSyncingSheets, setIsSyncingSheets] = useState(false)

  const fetchExaminees = async () => {
    try {
      const usersRef = collection(db, 'users')
      const snap = await getDocs(usersRef)
      const list: any[] = []
      snap.forEach((uDoc) => {
        const d = uDoc.data()
        // 僅列出非 admin 且非 supervisor 的一般客服考生
        if (!d.role || d.role === 'examinee') {
          list.push({
            id: uDoc.id,
            displayName: d.displayName || '客服勇者',
            email: d.email || '',
            role: d.role || 'examinee',
            status: d.status || 'active',
            resignedMonth: d.resignedMonth || '',
          })
        }
      })
      setExaminees(list)
    } catch (err) {
      console.error('Failed to fetch examinees list:', err)
    }
  }

  useEffect(() => {
    // 權限檢查：若非 admin 則無權造訪此頁面
    if (!loading && role && role !== 'admin') {
      router.replace('/')
    }

    // 載入預設的 Admin / Supervisor Emails 並從 Firestore users 實時同步
    const envAdmin = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
    const envSupervisor = (process.env.NEXT_PUBLIC_SUPERVISOR_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)

    async function loadRolesAndSettings() {
      let localAdmin: string[] = []
      let localSupervisor: string[] = []

      if (typeof window !== 'undefined') {
        const storedAdmin = localStorage.getItem('cs_admin_emails')
        const storedSupervisor = localStorage.getItem('cs_supervisor_emails')
        if (storedAdmin) {
          try { localAdmin = (JSON.parse(storedAdmin) as string[]).map(e => e.toLowerCase()) } catch {}
        }
        if (storedSupervisor) {
          try { localSupervisor = (JSON.parse(storedSupervisor) as string[]).map(e => e.toLowerCase()) } catch {}
        }
      }

      // 從 Firestore users 集合中即時查詢所有 role === 'admin' 和 role === 'supervisor' 的帳號 Email
      let cloudAdminEmails: string[] = []
      let cloudSupervisorEmails: string[] = []

      try {
        const adminQ = query(collection(db, 'users'), where('role', '==', 'admin'))
        const adminSnap = await getDocs(adminQ)
        cloudAdminEmails = adminSnap.docs.map(doc => doc.data().email).filter(Boolean).map(e => e.toLowerCase())

        const supervisorQ = query(collection(db, 'users'), where('role', '==', 'supervisor'))
        const supervisorSnap = await getDocs(supervisorQ)
        cloudSupervisorEmails = supervisorSnap.docs.map(doc => doc.data().email).filter(Boolean).map(e => e.toLowerCase())
      } catch (e) {
        console.error('Failed to fetch cloud roles from Firestore:', e)
      }

      const mergedAdmin = Array.from(new Set([...envAdmin, ...localAdmin, ...cloudAdminEmails]))
      const mergedSupervisor = Array.from(new Set([...envSupervisor, ...localSupervisor, ...cloudSupervisorEmails]))

      setAdminEmails(mergedAdmin)
      setSupervisorEmails(mergedSupervisor)

      // 載入雲端/本地系統參數設定
      const s = await getSystemSettings()
      setQuizPassThreshold(s.quizPassThreshold ?? 90)
      setEssayPassThreshold(s.essayPassThreshold ?? 90)
      setQuizQuestionCount(s.quizQuestionCount ?? 20)
      setEssayQuestionCount(s.essayQuestionCount ?? 10)
      setChoiceTimePerQuestion(s.choiceTimePerQuestion ?? 120)
      setQaTimePerQuestion(s.qaTimePerQuestion ?? 300)
      setEssayTimePerQuestion(s.essayTimePerQuestion ?? 600)

      // 載入考生清單
      await fetchExaminees()
    }

    loadRolesAndSettings()
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

  const handleOpenEditExaminee = (ex: any) => {
    setEditingExaminee(ex)
    setEditName(ex.displayName || '')
    setEditStatus(ex.status === 'resigned' ? 'resigned' : 'active')
    const currentYM = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    setEditResignedMonth(ex.resignedMonth || currentYM)
  }

  const handleSaveExamineeInfo = async () => {
    if (!editingExaminee || isSavingExaminee) return
    setIsSavingExaminee(true)
    try {
      const userRef = doc(db, 'users', editingExaminee.id)
      await updateDoc(userRef, {
        displayName: editName.trim() || '客服勇者',
        status: editStatus,
        resignedMonth: editStatus === 'resigned' ? editResignedMonth : '',
      })

      showToast(`✅ 考生【${editName}】狀態與姓名已成功更新！`)
      setEditingExaminee(null)
      await fetchExaminees()
    } catch (err: any) {
      console.error('Failed to update examinee info:', err)
      alert(`⚠️ 更新失敗：${err?.message || '網路異常'}`)
    } finally {
      setIsSavingExaminee(false)
    }
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

          <div style={{ marginTop: 24, borderTop: '1px dashed #4a6fa5', paddingTop: 16 }}>
            <h2 className={styles.panelTitle} style={{ fontSize: '1.1rem' }}>👥 客服考生帳號狀態與資料管理</h2>
            <p className={styles.panelSub}>
              檢視系統現有考生名單，可修訂顯示姓名或將離職員工標示為離職並設定生效月份。
            </p>

            <div className={styles.emailList}>
              {examinees.length === 0 ? (
                <p className={styles.emptyText}>雲端資料庫尚無一般客服考生紀錄</p>
              ) : (
                examinees.map((ex) => (
                  <div key={ex.id} className={styles.emailItem} style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <span className={styles.emailText} style={{ fontWeight: 'bold' }}>
                        👤 {ex.displayName}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>({ex.email || '無Email'})</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: 3,
                          backgroundColor: ex.status === 'resigned' ? '#b91c1c' : '#15803d',
                          color: '#fff',
                          fontWeight: 'bold',
                        }}
                      >
                        {ex.status === 'resigned' ? `🔴 已離職 (${ex.resignedMonth || '未設月份'})` : '🟢 在職'}
                      </span>
                    </div>

                    <button
                      className="btn-pixel"
                      style={{
                        padding: '3px 10px',
                        fontSize: '0.8rem',
                        backgroundColor: '#38bdf8',
                        color: '#000',
                        border: '1px solid #0284c7',
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                      onClick={() => handleOpenEditExaminee(ex)}
                    >
                      ✏️ 編輯狀態
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

      {/* 編輯考生資訊與狀態 Modal */}
      {editingExaminee && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setEditingExaminee(null)}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '3px solid #f4a24a',
              borderRadius: 8,
              maxWidth: 500,
              width: '100%',
              padding: 24,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 16,
                fontSize: '1.2rem',
                color: '#f4a24a',
                fontFamily: 'var(--font-pixel)',
                borderBottom: '2px solid #334155',
                paddingBottom: 10,
              }}
            >
              ✏️ 編輯考生狀態與資料
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 4 }}>
                  帳號 Email (不可變更)：
                </label>
                <input
                  type="text"
                  disabled
                  value={editingExaminee.email || '無 Email'}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#64748b',
                    borderRadius: 4,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#f8fafc', fontWeight: 'bold', marginBottom: 4 }}>
                  👤 客服顯示姓名：
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="請輸入顯示姓名"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0f172a',
                    border: '2px solid #38bdf8',
                    color: '#f8fafc',
                    fontSize: '0.95rem',
                    borderRadius: 4,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#f8fafc', fontWeight: 'bold', marginBottom: 4 }}>
                  📌 在職狀態：
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'resigned')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0f172a',
                    border: '2px solid #f4a24a',
                    color: '#f8fafc',
                    fontSize: '0.95rem',
                    borderRadius: 4,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="active">🟢 在職 (正常參與考核)</option>
                  <option value="resigned">🔴 已離職 (停止計算新月份考核)</option>
                </select>
              </div>

              {editStatus === 'resigned' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: '#f87171', fontWeight: 'bold', marginBottom: 4 }}>
                    📅 離職生效月份 (YYYY-MM)：
                  </label>
                  <input
                    type="month"
                    value={editResignedMonth}
                    onChange={(e) => setEditResignedMonth(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#0f172a',
                      border: '2px solid #f87171',
                      color: '#f8fafc',
                      fontSize: '0.95rem',
                      borderRadius: 4,
                      outline: 'none',
                    }}
                  />
                  <small style={{ color: '#94a3b8', marginTop: 4, display: 'block' }}>
                    說明：在此月份（含）及之後的團隊考核表中將會自動隱藏該成員。
                  </small>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setEditingExaminee(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#475569',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                取消
              </button>
              <button
                onClick={handleSaveExamineeInfo}
                disabled={isSavingExaminee}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#f4a24a',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-pixel)',
                }}
              >
                {isSavingExaminee ? '💾 儲存中...' : '💾 儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
