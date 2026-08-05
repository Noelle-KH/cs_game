'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './results.module.css'
import { useAuth } from '@/contexts/AuthContext'
import { getStoredHistory, ExamHistoryItem } from '@/lib/historyStore'

export default function ProfileResultsPage() {
  const { userDoc } = useAuth()
  const [historyList, setHistoryList] = useState<ExamHistoryItem[]>([])

  useEffect(() => {
    setHistoryList(getStoredHistory())
  }, [])

  const displayName = userDoc?.displayName || '客服勇者'

  // 統計數據計算
  const totalExams = historyList.length
  const passedExams = historyList.filter((h) => h.passed).length
  const passRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0
  const maxScore = historyList.reduce((max, h) => Math.max(max, h.score), 0)

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

        <Link href="/" className={styles.navBtn}>
          🏠 回首頁
        </Link>
      </header>

      {/* 統計摘要 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>總累計參考場數</div>
          <div className={styles.statNumber}>{totalExams} 場</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statTitle}>通過場數 (≥90分)</div>
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
            {historyList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                  尚無任何歷史考試記錄
                </td>
              </tr>
            ) : (
              historyList.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                    {item.mode === 'quiz' ? '客服綜合能力隨機抽考' : '客服實務情境申論特訓'}
                  </td>
                  <td>{item.mode === 'quiz' ? '⚔️ 綜合' : '📝 申論'}</td>
                  <td style={{ fontWeight: 'bold', color: '#4ade80', fontSize: '1.05rem' }}>
                    {item.score} / {item.maxScore}
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
                      {item.passed ? 'PASS 通過' : 'FAIL 未通過'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      {item.status === 'graded' ? '已完成評分' : '待主管審核'}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{item.date}</td>
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
                        style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: '#38bdf8', color: '#38bdf8' }}
                      >
                        📝 檢視閱卷評語
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
