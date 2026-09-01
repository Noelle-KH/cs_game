'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './results.module.css'
import { useAuth } from '@/contexts/AuthContext'
import { getUserExamsFirestore, CloudExamDoc } from '@/lib/examStore'
import { getSystemSettings } from '@/lib/settingsStore'

export default function ProfileResultsPage() {
  const { user, userDoc } = useAuth()
  const [historyList, setHistoryList] = useState<CloudExamDoc[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sysSettings, setSysSettings] = useState({ quizPassThreshold: 90, essayPassThreshold: 90 })

  // 月份篩選機制
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr)
  const [availableMonths, setAvailableMonths] = useState<string[]>([currentMonthStr])

  useEffect(() => {
    async function loadCloudHistory() {
      if (user?.uid) {
        setLoadingHistory(true)
        const settings = await getSystemSettings()
        const qTh = settings.quizPassThreshold ?? settings.passThreshold ?? 90
        const eTh = settings.essayPassThreshold ?? settings.passThreshold ?? 90
        setSysSettings({ quizPassThreshold: qTh, essayPassThreshold: eTh })

        const cloudExams = await getUserExamsFirestore(user.uid)
        const monthSet = new Set<string>()
        monthSet.add(currentMonthStr)

        const updatedExams = cloudExams.map((e) => {
          const d = e.submittedAt ? new Date(e.submittedAt) : (e.startedAt ? new Date(e.startedAt) : null)
          const monthKey = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : ''
          if (monthKey) monthSet.add(monthKey)

          return {
            ...e,
            monthKey,
            passed: e.score >= (e.mode === 'quiz' ? qTh : eTh),
          }
        })

        const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a))
        setAvailableMonths(sortedMonths)

        setHistoryList(updatedExams)
        setLoadingHistory(false)
      } else {
        setLoadingHistory(false)
      }
    }
    loadCloudHistory()
  }, [user])

  const displayName = userDoc?.displayName || '客服勇者'

  // 按選定月份過濾考卷列表 (selectedMonth 為 'all' 包含全部)
  const filteredHistory = historyList.filter((item: any) => {
    if (selectedMonth === 'all') return true
    return item.monthKey === selectedMonth
  })

  // 統計數據計算 (連動過濾結果)
  const totalExams = filteredHistory.length
  const passedExams = filteredHistory.filter((h) => h.passed).length
  const passRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0
  const maxScore = filteredHistory.reduce((max, h) => Math.max(max, h.score), 0)

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <span style={{ fontSize: '2.2rem' }}>📊</span>
          <div>
            <h1 className={styles.titleText}>{displayName} 的歷次成績與錯題記錄</h1>
            <p className={styles.subtitle}>
              回顧個人的客服冒險軌跡，檢視個人考試表現與能力成長
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.9rem', color: '#f4a24a', fontWeight: 'bold' }}>📅 統計月份：</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#1e293b',
                border: '2px solid #f4a24a',
                color: '#f8fafc',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                borderRadius: 4,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '2px 2px 0px #000',
              }}
            >
              {availableMonths.map((m) => {
                const isCurrent = m === currentMonthStr
                const [y, mm] = m.split('-')
                return (
                  <option key={m} value={m}>
                    {y} 年 {parseInt(mm, 10)} 月 {isCurrent ? '(當月)' : ''}
                  </option>
                )
              })}
              <option value="all">🌐 全部歷史紀錄</option>
            </select>
          </div>

          <Link href="/" className={styles.navBtn}>
            🏠 回首頁
          </Link>
        </div>
      </header>

      {/* 統計摘要 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>總累計參考場數</div>
          <div className={styles.statNumber}>{totalExams} 場</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>通過場數</div>
          <div className={styles.statNumber} style={{ color: '#4ade80' }}>
            {passedExams} 場
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>綜合通過率</div>
          <div className={styles.statNumber} style={{ color: '#38bdf8' }}>
            {passRate}%
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>歷史最高得分</div>
          <div className={styles.statNumber} style={{ color: '#facc15' }}>
            {maxScore} 分
          </div>
        </div>
      </div>

      {/* 歷次紀錄表格 */}
      <div className={styles.tableContainer}>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>測驗項目</th>
              <th>模式</th>
              <th>得分 / 滿分</th>
              <th>結果判定</th>
              <th>狀態</th>
              <th>測驗日期時間</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loadingHistory ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  ⏳ 正在載入雲端個人考卷紀錄...
                </td>
              </tr>
            ) : filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                  尚無任何當月歷史考試記錄
                </td>
              </tr>
            ) : (
              filteredHistory.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                    {item.mode === 'quiz' ? '客服綜合能力隨用抽考' : '客服實務情境申論特訓'}
                  </td>
                  <td>{item.mode === 'quiz' ? '⚔️ 綜合' : '📝 申論'}</td>
                  <td style={{ fontWeight: 'bold', color: '#4ade80', fontSize: '1.05rem' }}>
                    {item.score} / {item.totalPossibleScore || 100}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        borderRadius: 2,
                        backgroundColor: item.passed ? '#15803d' : '#b91c1c',
                        color: '#fff',
                      }}
                    >
                      {item.status === 'submitted' ? '⏳ 審核中' : item.passed ? 'PASS 通過' : 'FAIL 未通過'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      {item.status === 'graded' ? '已完成評分' : item.status === 'submitted' ? '待主管審核' : '作答中'}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    {item.startedAt?.toLocaleDateString ? item.startedAt.toLocaleDateString() : '最近測驗'}
                  </td>
                  <td>
                    {item.mode === 'quiz' ? (
                      <Link
                        href={`/exam/quiz/${item.id}/review`}
                        className={styles.navBtn}
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        🔍 查看錯題解析
                      </Link>
                    ) : (
                      <Link
                        href={`/exam/essay/${item.id}/result`}
                        className={styles.navBtn}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', backgroundColor: '#3b82f6' }}
                      >
                        📄 查看卷面評語
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
