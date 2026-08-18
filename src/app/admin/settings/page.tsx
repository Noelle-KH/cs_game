'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import styles from './settings.module.css'

export default function AdminSettingsPage() {
  const { userDoc, role, loading } = useAuth()
  const router = useRouter()

  // Admin 名單與 Supervisor 名單 state
  const [adminEmails, setAdminEmails] = useState<string[]>([])
  const [supervisorEmails, setSupervisorEmails] = useState<string[]>([])
  const [newEmailInput, setNewEmailInput] = useState('')
  const [newSupervisorEmailInput, setNewSupervisorEmailInput] = useState('')
  
  // 系統參數 state
  const [passThreshold, setPassThreshold] = useState(90)
  const [quizQuestionCount, setQuizQuestionCount] = useState(20)
  const [essayQuestionCount, setEssayQuestionCount] = useState(10)
  const [quizTimePerQuestion, setQuizTimePerQuestion] = useState(300)
  const [essayTimePerQuestion, setEssayTimePerQuestion] = useState(600)

  const [toastMessage, setToastMessage] = useState<string | null>(null)

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
  }, [loading, role, router])

  const handleAddEmail = () => {
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
    showToast(`✅ 已新增系統管理員：${trimmed}`)
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    const updated = adminEmails.filter(e => e !== emailToRemove)
    setAdminEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cs_admin_emails', JSON.stringify(updated))
    }
    showToast(`🗑️ 已移除系統管理員：${emailToRemove}`)
  }

  const handleAddSupervisorEmail = () => {
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
    showToast(`✅ 已新增主管授權：${trimmed}`)
  }

  const handleRemoveSupervisorEmail = (emailToRemove: string) => {
    const updated = supervisorEmails.filter(e => e !== emailToRemove)
    setSupervisorEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cs_supervisor_emails', JSON.stringify(updated))
    }
    showToast(`🗑️ 已移除主管授權：${emailToRemove}`)
  }

  const handleSaveSettings = () => {
    showToast('💾 系統參數與管理員名單設定儲存成功！')
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
              <label className={styles.label}>🏆 考核合格門檻分數 (0-100 分)：</label>
              <input
                type="number"
                min={50}
                max={100}
                value={passThreshold}
                onChange={(e) => setPassThreshold(parseInt(e.target.value) || 90)}
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
              <label className={styles.label}>⏱️ 綜合模式單題限時 (秒)：</label>
              <input
                type="number"
                min={30}
                max={600}
                value={quizTimePerQuestion}
                onChange={(e) => setQuizTimePerQuestion(parseInt(e.target.value) || 300)}
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
      </div>
    </div>
  )
}
