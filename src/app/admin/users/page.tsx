'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './users.module.css'
import { getAllExamsFirestore, CloudExamDoc } from '@/lib/examStore'

import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

interface ExamineeOverview {
  uidKey: string
  name: string
  email: string
  totalQuizExams: number
  totalEssayExams: number
  thisMonthEssayStatus: 'passed' | 'failed' | 'pending' | 'none'
  highestQuizScore: number
  highestEssayScore: number
  lastActiveDate: string
  recentExams: CloudExamDoc[] // 存放該考生近半年紀錄
}

export default function AdminUsersOverviewPage() {
  const [examineeList, setExamineeList] = useState<ExamineeOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExaminee, setSelectedExaminee] = useState<ExamineeOverview | null>(null)

  useEffect(() => {
    async function loadTeamData() {
      setLoading(true)
      const now = new Date()
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      // 計算半年前時間切點
      const halfYearAgo = new Date()
      halfYearAgo.setMonth(halfYearAgo.getMonth() - 6)

      // 1. 讀取 Firestore `users` 集合中所有身分為考生的帳號
      const examineeMap = new Map<string, ExamineeOverview>()
      const nonExamineeKeys = new Set<string>()

      try {
        const usersRef = collection(db, 'users')
        const usersSnap = await getDocs(usersRef)
        usersSnap.forEach((uDoc) => {
          const uData = uDoc.data()
          const uid = uDoc.id
          const email = (uData.email || '').toLowerCase()

          // 收集管理員與主管帳號，確保後續不會被誤建立為考生條目
          if (uData.role === 'admin' || uData.role === 'supervisor') {
            if (uid) nonExamineeKeys.add(uid)
            if (email) nonExamineeKeys.add(email)
            if (uData.displayName) nonExamineeKeys.add(uData.displayName)
            return
          }

          // 若無 role 預設或 role === 'examinee'
          if (!uData.role || uData.role === 'examinee') {
            const name = uData.displayName || '客服勇者'
            examineeMap.set(uid, {
              uidKey: uid,
              name,
              email: uData.email || '',
              totalQuizExams: 0,
              totalEssayExams: 0,
              thisMonthEssayStatus: 'none',
              highestQuizScore: 0,
              highestEssayScore: 0,
              lastActiveDate: '尚未開始考試',
              recentExams: [],
            })
          }
        })
      } catch (err) {
        console.warn('Failed to fetch users from Firestore, fallback to exam records:', err)
      }

      // 2. 讀取 Firestore `exams` 考卷紀錄並比對
      const allExams = await getAllExamsFirestore()

      allExams.forEach((item: CloudExamDoc) => {
        const key = item.uid || item.userEmail || item.displayName
        const itemEmail = (item.userEmail || '').toLowerCase()

        // 排除系統管理員與主管的測驗紀錄
        if (nonExamineeKeys.has(item.uid) || nonExamineeKeys.has(itemEmail) || nonExamineeKeys.has(item.displayName)) {
          return
        }
        const name = item.displayName || '客服新人'
        const email = item.userEmail || ''
        
        const dateObj = item.submittedAt ? new Date(item.submittedAt) : (item.startedAt ? new Date(item.startedAt) : new Date())
        const dateStr = dateObj ? dateObj.toLocaleDateString('zh-TW') : '未知'

        const existing = examineeMap.get(key) || {
          uidKey: key,
          name,
          email,
          totalQuizExams: 0,
          totalEssayExams: 0,
          thisMonthEssayStatus: 'none',
          highestQuizScore: 0,
          highestEssayScore: 0,
          lastActiveDate: dateStr,
          recentExams: [],
        }

        // 近半年考試篩選收集
        if (dateObj >= halfYearAgo) {
          existing.recentExams.push(item)
        }

        if (item.mode === 'quiz') {
          existing.totalQuizExams += 1
          existing.highestQuizScore = Math.max(existing.highestQuizScore, item.score || 0)
        } else if (item.mode === 'essay') {
          existing.totalEssayExams += 1
          existing.highestEssayScore = Math.max(existing.highestEssayScore, item.score || 0)
          
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

        if (existing.lastActiveDate === '尚未開始考試' || dateStr !== '未知') {
          existing.lastActiveDate = dateStr
        }
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
              掌握團隊成員的考核參與次數、當月申論完成狀態與實力表現（點擊姓名可查閱近半年考核評分）
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
              <th>考生姓名 / 帳號 (點擊查看近半年評分)</th>
              <th style={{ textAlign: 'center' }}>綜合刷題次數</th>
              <th style={{ textAlign: 'center' }}>申論考核次數</th>
              <th style={{ textAlign: 'center' }}>本月申論狀態</th>
              <th style={{ textAlign: 'center' }}>綜合最高分</th>
              <th style={{ textAlign: 'center' }}>申論最高分</th>
              <th>最近活動時間</th>
            </tr>
          </thead>
          <tbody>
            {examineeList.map((u, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 'bold' }}>
                  <button
                    onClick={() => setSelectedExaminee(u)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      textAlign: 'left',
                      padding: 0
                    }}
                  >
                    👤 {u.name} {u.email && <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>({u.email})</span>}
                  </button>
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
                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#38bdf8' }}>
                  {u.highestQuizScore > 0 ? `${u.highestQuizScore} 分` : '—'}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#f0abfc' }}>
                  {u.highestEssayScore > 0 ? `${u.highestEssayScore} 分` : '—'}
                </td>
                <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  {u.lastActiveDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 近半年評分紀錄彈窗 Modal */}
      {selectedExaminee && (
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
            padding: 16
          }}
          onClick={() => setSelectedExaminee(null)}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '3px solid #f4a24a',
              borderRadius: 8,
              maxWidth: 750,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              color: '#f8fafc'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#f4a24a', fontFamily: 'var(--font-pixel)' }}>
                📜 【{selectedExaminee.name}】近半年考試與評分紀錄
              </h2>
              <button
                onClick={() => setSelectedExaminee(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✖
              </button>
            </div>

            {selectedExaminee.recentExams.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>近半年內尚無完成的考試紀錄</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedExaminee.recentExams.map((ex) => {
                  const examDate = ex.submittedAt ? new Date(ex.submittedAt) : (ex.startedAt ? new Date(ex.startedAt) : null)
                  const dateString = examDate ? examDate.toLocaleString('zh-TW', { hour12: false }) : '未知時間'

                  return (
                    <div
                      key={ex.id}
                      style={{
                        backgroundColor: '#0f172a',
                        border: `2px solid ${ex.mode === 'quiz' ? '#38bdf8' : '#f0abfc'}`,
                        borderRadius: 6,
                        padding: 14
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 'bold', color: ex.mode === 'quiz' ? '#38bdf8' : '#f0abfc', fontSize: '0.95rem' }}>
                          {ex.mode === 'quiz' ? '🎯 綜合模式測驗' : '📜 申論模式考核'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {dateString}
                          </span>
                          <Link
                            href={`/admin/grade?examId=${ex.id}`}
                            className="btn-pixel"
                            style={{
                              backgroundColor: '#f4a24a',
                              color: '#000',
                              border: '1px solid #d97706',
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              textDecoration: 'none',
                              borderRadius: 4
                            }}
                          >
                            🔍 前往閱卷頁面
                          </Link>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: '0.9rem' }}>
                        <div>狀態：
                          <span style={{ fontWeight: 'bold', color: ex.status === 'graded' ? '#4ade80' : ex.status === 'submitted' ? '#fbbf24' : '#a855f7' }}>
                            {ex.status === 'graded' ? `✅ 已批改 (${ex.score}分 / ${ex.passed ? '通過' : '未通過'})` : ex.status === 'submitted' ? '⏳ 待主管批改' : '📦 已擱置'}
                          </span>
                        </div>
                        {ex.mode === 'quiz' && (
                          <div style={{ color: '#cbd5e1' }}>選擇題得分：{ex.choiceScore ?? 0} 分</div>
                        )}
                        {ex.gradedBy && (
                          <div style={{ color: '#94a3b8' }}>閱卷主管：{ex.gradedBy}</div>
                        )}
                      </div>

                      {/* 題目與評語細節 */}
                      {ex.answers && ex.answers.some(a => a.feedback || a.score !== undefined) && (
                        <div style={{ background: '#1e293b', padding: 10, borderRadius: 4, marginTop: 8, fontSize: '0.85rem' }}>
                          <strong style={{ color: '#f4a24a', display: 'block', marginBottom: 6 }}>📝 主管評語與給分詳情：</strong>
                          {ex.answers.map((a, i) => {
                            if (!a.feedback && a.score === undefined) return null
                            return (
                              <div key={i} style={{ borderBottom: '1px solid #334155', paddingBottom: 4, marginBottom: 4 }}>
                                <span>第 {i + 1} 題：</span>
                                <span style={{ color: '#4ade80', fontWeight: 'bold', marginRight: 8 }}>[{a.score ?? 0}分]</span>
                                <span style={{ color: '#e2e8f0' }}>{a.feedback || '（無評語）'}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                onClick={() => setSelectedExaminee(null)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#f4a24a',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-pixel)'
                }}
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
