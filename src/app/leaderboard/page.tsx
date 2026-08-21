'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './leaderboard.module.css'
import { getQuizLeaderboard, getEssayLeaderboard, ExamHistoryItem } from '@/lib/historyStore'
import { getSystemSettings } from '@/lib/settingsStore'

import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'quiz' | 'essay'>('quiz')
  const [quizList, setQuizList] = useState<ExamHistoryItem[]>([])
  const [essayList, setEssayList] = useState<ExamHistoryItem[]>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)

  useEffect(() => {
    async function fetchCloudLeaderboard() {
      setLoadingLeaderboard(true)
      try {
        const q = query(collection(db, 'exams'), where('status', '==', 'graded'))
        const snap = await getDocs(q)
        const allExams: any[] = []
        snap.forEach((docSnap) => {
          const d = docSnap.data()
          allExams.push({
            id: d.id,
            displayName: d.displayName || '客服勇者',
            mode: d.mode,
            score: d.score || 0,
            date: d.submittedAt?.toDate ? d.submittedAt.toDate().toLocaleDateString() : '最近測驗',
            passed: d.passed || false,
          })
        })

        const settings = await getSystemSettings()
        const quizTh = settings.quizPassThreshold ?? settings.passThreshold ?? 90
        const essayTh = settings.essayPassThreshold ?? settings.passThreshold ?? 90

        const quizSorted = allExams
          .filter((e) => e.mode === 'quiz')
          .map((e) => ({ ...e, passed: e.score >= quizTh }))
          .sort((a, b) => b.score - a.score)
        const essaySorted = allExams
          .filter((e) => e.mode === 'essay')
          .map((e) => ({ ...e, passed: e.score >= essayTh }))
          .sort((a, b) => b.score - a.score)

        setQuizList(quizSorted)
        setEssayList(essaySorted)
      } catch (e) {
        console.error('Failed to fetch leaderboard from Firestore:', e)
      } finally {
        setLoadingLeaderboard(false)
      }
    }
    fetchCloudLeaderboard()
  }, [])

  const currentList = activeTab === 'quiz' ? quizList : essayList

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <span style={{ fontSize: '2.2rem' }}>🏆</span>
          <div>
            <h1 className={styles.titleText}>冒險排行榜 (Leaderboard)</h1>
            <p className={styles.subtitle}>
              展現頂尖客服勇者的實力，記錄綜合刷題與申論特訓的最高榮譽
            </p>
          </div>
        </div>

        <Link href="/" className={styles.navBtn}>
          🏠 回首頁
        </Link>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'quiz' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          ⚔️ 綜合模式高分榜
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'essay' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('essay')}
        >
          📝 申論特訓榮譽榜
        </button>
      </div>

      {loadingLeaderboard ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <p className="pixel-title">載入排行榜資料中...</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {currentList.length >= 3 && (
            <div className={styles.podiumSection}>
              {/* 第二名 */}
              <div className={styles.podiumCard}>
                <div className={styles.rankBadge}>🥈</div>
                <div className={styles.playerName}>{currentList[1]?.displayName}</div>
                <div className={styles.scoreText}>{currentList[1]?.score} 分</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                  {currentList[1]?.date}
                </div>
              </div>

              {/* 第一名 */}
              <div className={`${styles.podiumCard} ${styles.podiumCardRank1}`}>
                <div className={styles.rankBadge}>👑 🥇</div>
                <div className={styles.playerName} style={{ fontSize: '1.3rem', color: '#f59e0b' }}>
                  {currentList[0]?.displayName}
                </div>
                <div className={styles.scoreText} style={{ fontSize: '1.8rem', color: '#facc15' }}>
                  {currentList[0]?.score} 分
                </div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: 4 }}>
                  {currentList[0]?.date}
                </div>
              </div>

              {/* 第三名 */}
              <div className={styles.podiumCard}>
                <div className={styles.rankBadge}>🥉</div>
                <div className={styles.playerName}>{currentList[2]?.displayName}</div>
                <div className={styles.scoreText}>{currentList[2]?.score} 分</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                  {currentList[2]?.date}
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div className={styles.tableContainer}>
            <table className={styles.leaderboardTable}>
              <thead>
                <tr>
                  <th style={{ width: 80, textAlign: 'center' }}>排名</th>
                  <th>勇者名稱</th>
                  <th>模式</th>
                  <th style={{ width: 120 }}>最高得分</th>
                  <th style={{ width: 120 }}>判定結果</th>
                  <th style={{ width: 160 }}>達成時間</th>
                </tr>
              </thead>
              <tbody>
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                      尚無榜單紀錄
                    </td>
                  </tr>
                ) : (
                  currentList.map((item, index) => (
                    <tr key={`${item.id}_${index}`}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : index + 1}
                      </td>
                      <td style={{ fontWeight: 'bold', color: '#f8fafc' }}>{item.displayName}</td>
                      <td>{item.mode === 'quiz' ? '⚔️ 綜合' : '📝 申論'}</td>
                      <td style={{ fontWeight: 'bold', color: '#4ade80', fontSize: '1.05rem' }}>
                        {item.score} 分
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
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{item.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
