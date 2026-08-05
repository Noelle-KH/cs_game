'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './users.module.css'
import { getStoredHistory, ExamHistoryItem } from '@/lib/historyStore'

interface ExamineeOverview {
  name: string
  totalQuizExams: number
  totalEssayExams: number
  thisMonthEssayStatus: 'completed' | 'pending' | 'none'
  highestScore: number
  lastActiveDate: string
}

export default function AdminUsersOverviewPage() {
  const [examineeList, setExamineeList] = useState<ExamineeOverview[]>([])

  useEffect(() => {
    const history = getStoredHistory()
    
    // 依據歷史數據統計模擬考生狀況
    const examineeMap = new Map<string, ExamineeOverview>()

    // 預設模擬考生清單
    const defaultUsers = ['客服新人 查理', '客服大師 艾倫', '資深客服 貝蒂', '新人客服 戴安娜', '客服測試員']
    defaultUsers.forEach(name => {
      examineeMap.set(name, {
        name,
        totalQuizExams: 0,
        totalEssayExams: 0,
        thisMonthEssayStatus: 'none',
        highestScore: 0,
        lastActiveDate: '2026-08-01',
      })
    })

    history.forEach(item => {
      const name = item.displayName || '未知考生'
      const existing = examineeMap.get(name) || {
        name,
        totalQuizExams: 0,
        totalEssayExams: 0,
        thisMonthEssayStatus: 'none',
        highestScore: 0,
        lastActiveDate: item.date,
      }

      if (item.mode === 'quiz') {
        existing.totalQuizExams += 1
      } else if (item.mode === 'essay') {
        existing.totalEssayExams += 1
        if (item.status === 'graded') {
          existing.thisMonthEssayStatus = 'completed'
        } else if (item.status === 'submitted') {
          if (existing.thisMonthEssayStatus !== 'completed') {
            existing.thisMonthEssayStatus = 'pending'
          }
        }
      }

      existing.highestScore = Math.max(existing.highestScore, item.score)
      existing.lastActiveDate = item.date
      examineeMap.set(name, existing)
    })

    setExamineeList(Array.from(examineeMap.values()))
  }, [])

  // 彙整統計
  const totalExaminees = examineeList.length
  const completedEssayCount = examineeList.filter(u => u.thisMonthEssayStatus === 'completed').length
  const pendingEssayCount = examineeList.filter(u => u.thisMonthEssayStatus === 'pending').length
  const missingEssayCount = examineeList.filter(u => u.thisMonthEssayStatus === 'none').length

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <span style={{ fontSize: '2.2rem' }}>👥</span>
          <div>
            <h1 className={styles.titleText}>團隊考生考核狀況總覽</h1>
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
                  👤 {u.name}
                </td>
                <td style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 'bold' }}>
                  {u.totalQuizExams} 次
                </td>
                <td style={{ textAlign: 'center', color: '#f0abfc', fontWeight: 'bold' }}>
                  {u.totalEssayExams} 次
                </td>
                <td style={{ textAlign: 'center' }}>
                  {u.thisMonthEssayStatus === 'completed' && (
                    <span className={styles.badgeDone}>✅ 已通過/已評分</span>
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
