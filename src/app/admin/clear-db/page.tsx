'use client'

import { useState } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase/client'
import { collection, getDocs, writeBatch } from 'firebase/firestore'

export default function ClearDbPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isClearing, setIsClearing] = useState(false)

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg])
  }

  async function clearCollection(collName: string) {
    addLog(`🧹 開始清空集合 [${collName}]...`)
    const snap = await getDocs(collection(db, collName))
    addLog(`📊 找到 ${snap.size} 筆 Document`)

    if (snap.empty) {
      addLog(`✅ [${collName}] 無資料需刪除`)
      return
    }

    let batch = writeBatch(db)
    let count = 0
    let totalDeleted = 0

    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref)
      count++
      totalDeleted++

      if (count === 400) {
        await batch.commit()
        addLog(`   └ 已批次刪除 ${totalDeleted} 筆...`)
        batch = writeBatch(db)
        count = 0
      }
    }

    if (count > 0) {
      await batch.commit()
    }

    addLog(`🎉 成功清空 [${collName}]，共刪除 ${totalDeleted} 筆 Document！`)
  }

  async function handleClearAll() {
    if (!confirm('⚠️ 警告：這將徹底清空 Firestore 中的所有 exams 考卷與 questions 題庫紀錄，確定要繼續嗎？')) {
      return
    }
    setIsClearing(true)
    setLogs([])
    try {
      await clearCollection('exams')
      await clearCollection('questions')
      addLog('\n✨ 所有指定的集合 (exams, questions) 已徹底清空！')
    } catch (e: any) {
      addLog(`❌ 發生錯誤: ${e.message}`)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a2e', color: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
        <Link href="/admin/settings" style={{ padding: '6px 12px', background: '#334155', color: '#fff', textDecoration: 'none', border: '2px solid #64748b' }}>
          ⬅️ 返回系統權限管理
        </Link>
        <Link href="/" style={{ padding: '6px 12px', background: '#334155', color: '#fff', textDecoration: 'none', border: '2px solid #64748b' }}>
          🏠 返回首頁
        </Link>
      </div>

      <h1>🧹 Firestore 重置工具 (Exams & Questions)</h1>
      <p style={{ color: '#94a3b8', marginTop: 8 }}>點擊下方按鈕將徹底刪除雲端 `exams` 考卷紀錄與 `questions` 題庫列表。</p>
      
      <button
        onClick={handleClearAll}
        disabled={isClearing}
        style={{
          padding: '12px 24px',
          fontSize: '1rem',
          background: isClearing ? '#475569' : '#dc2626',
          color: '#fff',
          border: '2px solid #ef4444',
          cursor: isClearing ? 'not-allowed' : 'pointer',
          marginTop: 20,
          marginBottom: 20,
          fontWeight: 'bold',
        }}
      >
        {isClearing ? '⏳ 資料清空進行中...' : '🔥 一鍵徹底清空 exams 與 questions'}
      </button>

      <div style={{ background: '#0f172a', padding: 20, border: '2px solid #334155', minHeight: 220, whiteSpace: 'pre-wrap', borderRadius: 4 }}>
        {logs.length === 0 ? <div style={{ color: '#64748b' }}>點擊上方按鈕開始執行清空程序...</div> : logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  )
}
