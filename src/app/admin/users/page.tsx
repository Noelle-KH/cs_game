'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './users.module.css'
import { getAllExamsFirestore, CloudExamDoc } from '@/lib/examStore'

interface ExamineeOverview {
  name: string
  email: string
  totalQuizExams: number
  totalEssayExams: number
  thisMonthEssayStatus: 'passed' | 'failed' | 'pending' | 'none'
  highestScore: number
  lastActiveDate: string
}

export default function AdminUsersOverviewPage() {
  const [examineeList, setExamineeList] = useState<ExamineeOverview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTeamData() {
      setLoading(true)
      const now = new Date()
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const allExams = await getAllExamsFirestore()
      const examineeMap = new Map<string, ExamineeOverview>()

      allExams.forEach((item: CloudExamDoc) => {
        const key = item.uid || item.userEmail || item.displayName
        const name = item.displayName || '客服新人'
        const email = item.userEmail || ''
        
        const dateStr = item.submittedAt
          ? new Date(item.submittedAt).toLocaleDateString('zh-TW')
          : item.startedAt
          ? new Date(item.startedAt).toLocaleDateString('zh-TW')
          : '未知'

        const existing = examineeMap.get(key) || {
          name,
          email,
          totalQuizExams: 0,
          totalEssayExams: 0,
          thisMonthEssayStatus: 'none',
          highestScore: 0,
          lastActiveDate: dateStr,
        }

        if (item.mode === 'quiz') {
          existing.totalQuizExams += 1
        } else if (item.mode === 'essay') {
          existing.totalEssayExams += 1
          
          // 檢查是否屬當月
          const examDate = item.submittedAt ? new Date(item.submittedAt) : new Date(item.startedAt)
          const examYM = `${examDate.getFullYear()}-${String(examDate.getMonth() + 1).padStart(2, '0')}`
          
          if (examYM === currentYM) {
            if (item.status === 'graded') {
              if (item.passed) {
                existing.thisMonthEssayStatus = 'passed'
              } else if (existing.thisMonthEssayStatus !== 'passed') {
                existing.thisMonthEssayStatus = 'failed'
              }
            } else if (item.status === 'submitted') {
              if (existing.thisMonthEssayStatus !== 'passed' && existing.thisMonthEssayStatus !== 'failed') {
                existing.thisMonthEssayStatus = 'pending'
              }
            }
          }
        }

        existing.highestScore = Math.max(existing.highestScore, item.score || 0)
        existing.lastActiveDate = dateStr
        examineeMap.set(key, existing)
      })

      setExamineeList(Array.from(examineeMap.values()))
      setLoading(false)
    }

    loadTeamData()
  }, [])

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <p className="pixel-title">載入團隊考核數據中...</p>
        </div>
      </div>
    )
  }

  // 彙整統計
  const totalExaminees = examineeList.length
  const completedEssayCount = examineeList.filter(u => u.thisMonthEssayStatus === 'passed' || u.thisMonthEssayStatus === 'failed').length
  const pendingEssayCount = examineeList.filter(u => u.thisMonthEssayStatus === 'pending').length
  const missingEssayCount = examineeList.filter(u => u.thisMonthEssayStatus === 'none').length

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <span style={{ fontSize: '2.2rem' }}>👥</span>
          <div>
            <h1 className={styles.titleText}>團隊考核狀況與進度總覽</h1>
            <p className={styles.subtitle}>
              掌握團隊成員的考核參與次數、當月申論完成狀態與實力表現
            </p>
          </div>
        </div>

        <Link href="/" className={styles.navBtn}>
          🏠 回首頁
        </Link>
      </header>

      {/* 統計摘要卡片 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>團隊考生總數</div>
          <div className={styles.statNumber}>{totalExaminees} 人</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>本月申論已完成</div>
          <div className={styles.statNumber} style={{ color: '#4ade80' }}>
            {completedEssayCount} 人
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>本月申論待批改</div>
          <div className={styles.statNumber} style={{ color: '#fbbf24' }}>
            {pendingEssayCount} 人
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>本月申論未提交</div>
          <div className={styles.statNumber} style={{ color: '#f87171' }}>
            {missingEssayCount} 人
          </div>
        </div>
      </div>

      {/* 考生考核表格 */}
      <div className={styles.tableContainer}>
        <table className={styles.usersTable}>
          <thead>
            <tr>
              <th>考生姓名 / 帳號</th>
              <th style={{ textAlign: 'center' }}>綜合刷題次數</th>
              <th style={{ textAlign: 'center' }}>申論考核次數</th>
              <th style={{ textAlign: 'center' }}>本月申論狀態</th>
              <th style={{ textAlign: 'center' }}>最高得分紀錄</th>
              <th>最近活動時間</th>
            </tr>
          </thead>
          <tbody>
            {examineeList.map((u, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                  👤 {u.name} {u.email && <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>({u.email})</span>}
                </td>
                <td style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 'bold' }}>
                  {u.totalQuizExams} 次
                </td>
                <td style={{ textAlign: 'center', color: '#f0abfc', fontWeight: 'bold' }}>
                  {u.totalEssayExams} 次
                </td>
                <td style={{ textAlign: 'center' }}>
                  {u.thisMonthEssayStatus === 'passed' && (
                    <span className={styles.badgeDone}>✅ PASS 通過</span>
                  )}
                  {u.thisMonthEssayStatus === 'failed' && (
                    <span className={styles.badgeNone}>❌ 未通過 / 已評分</span>
                  )}
                  {u.thisMonthEssayStatus === 'pending' && (
                    <span className={styles.badgePending}>⏳ 待主管閱卷</span>
                  )}
                  {u.thisMonthEssayStatus === 'none' && (
                    <span className={styles.badgeNone}>⚠️ 本月未提交</span>
                  )}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#4ade80' }}>
                  {u.highestScore > 0 ? `${u.highestScore} 分` : '—'}
                </td>
                <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  {u.lastActiveDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
