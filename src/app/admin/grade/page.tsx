'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './grade.module.css'
import {
  MOCK_ESSAY_QUESTIONS_MAP,
  MOCK_ESSAY_QUESTIONS
} from '@/lib/mockData'
import {
  loadEssaySession,
  loadExamSession,
  clearEssayLock,
  EssayExamSession,
  ExamSession,
  saveExamSession
} from '@/lib/examSession'
import { useAuth } from '@/contexts/AuthContext'
import { getPendingExamsFirestore, gradeExamFirestore, getUserExamsFirestore, getAllExamsFirestore, updateExamStatusFirestore, subscribePendingExams, CloudExamDoc } from '@/lib/examStore'
import { addHistoryRecord } from '@/lib/historyStore'
import { getSystemSettings } from '@/lib/settingsStore'

import ConfirmModal from '@/components/ConfirmModal'

import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

// 定義通用後台考卷型別（包含申論與綜合模式）
export interface PendingExamItem {
  examId: string
  mode: 'quiz' | 'essay'
  uid: string
  displayName: string
  email: string
  submittedAt: string
  status: 'submitted' | 'graded' | 'shelved' | 'in_progress'
  totalScore?: number  // 0-100（若已批改）
  choiceScore?: number // 綜合模式專用：選擇題得分
  passed?: boolean     // 是否通過
  answers: {
    questionId: string
    userAnswer: string
    isCorrect?: boolean
    timeExpired: boolean
    score?: number     // 申論: 0-10；綜合問答題: 得分
    comment?: string
    questionDoc?: any
  }[]
}

// 預設考卷資料（潔淨狀態，無假資料）
const INITIAL_MOCK_PENDING_EXAMS: PendingExamItem[] = []

export default function AdminGradePage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '20px', color: '#fff' }}>載入批改頁面中...</div>}>
      <AdminGradeContent />
    </React.Suspense>
  )
}

function AdminGradeContent() {
  const { userDoc } = useAuth()
  const searchParams = useSearchParams()
  const targetExamId = searchParams.get('examId')

  const [exams, setExams] = useState<PendingExamItem[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [selectedExamId, setSelectedExamId] = useState<string | null>(targetExamId)
  const [filterMode, setFilterMode] = useState<'all' | 'quiz' | 'essay'>('all')
  const [statusTab, setStatusTab] = useState<'submitted' | 'graded' | 'shelved'>('submitted')
  const [passThresholds, setPassThresholds] = useState({ quiz: 90, essay: 90 })

  // 正在批改的分數與評語暫存 state (key: questionId)
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({})
  const [gradingComments, setGradingComments] = useState<Record<string, string>>({})
  
  // Toast 或成功訊息通知
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 從 Firestore 實時載入待批改/已批改/已擱置考卷
  const fetchPendingExams = async () => {
    setLoadingPending(true)
    const cloudList = await getAllExamsFirestore()
    const formatted: PendingExamItem[] = cloudList.map((e) => {
      return {
        examId: e.id,
        mode: e.mode,
        uid: e.uid,
        displayName: e.displayName,
        email: e.userEmail,
        submittedAt: e.submittedAt?.toISOString ? e.submittedAt.toISOString() : (e.submittedAt instanceof Date ? e.submittedAt.toISOString() : (e.submittedAt ? String(e.submittedAt) : '')),
        status: e.status || 'submitted',
        totalScore: e.score || 0,
        choiceScore: e.choiceScore || 0,
        passed: e.passed,
        answers: e.answers.map((a) => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          timeExpired: false,
          score: a.score || 0,
          comment: a.feedback || '',
          questionDoc: a.questionDoc,
        })),
      }
    })
    setExams(formatted)

    // 若 URL 帶有 targetExamId，自動切換相對應的 statusTab 與 selectedExamId
    if (targetExamId) {
      const matchExam = formatted.find(e => e.examId === targetExamId)
      if (matchExam) {
        if (matchExam.status === 'graded' || matchExam.status === 'shelved' || matchExam.status === 'submitted') {
          setStatusTab(matchExam.status)
        }
        setSelectedExamId(matchExam.examId)
      }
    }

    setLoadingPending(false)
  }

  useEffect(() => {
    fetchPendingExams()
    async function loadSettings() {
      const s = await getSystemSettings()
      setPassThresholds({
        quiz: s.quizPassThreshold ?? s.passThreshold ?? 90,
        essay: s.essayPassThreshold ?? s.passThreshold ?? 90,
      })
    }
    loadSettings()

    // 實時監聽待批改考卷變動，有新交卷時自動刷新列表
    const unsubscribe = subscribePendingExams(() => {
      fetchPendingExams()
    })

    return () => unsubscribe()
  }, [])

  // 根據 mode 與 statusTab 篩選考卷
  const filteredExams = exams.filter(e => {
    const matchMode = filterMode === 'all' || e.mode === filterMode
    const matchStatus = e.status === statusTab
    return matchMode && matchStatus
  })

  // 用於控制詳細內頁區域滾動置頂
  const detailSectionRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const scrollToTop = () => {
    if (detailSectionRef.current) {
      detailSectionRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handleWinScroll = () => {
      const winY = window.scrollY || document.documentElement.scrollTop
      const sectionY = detailSectionRef.current?.scrollTop || 0
      setShowScrollTop(winY > 100 || sectionY > 100)
    }

    window.addEventListener('scroll', handleWinScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleWinScroll)
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const sectionY = e.currentTarget.scrollTop
    const winY = window.scrollY || document.documentElement.scrollTop
    setShowScrollTop(winY > 100 || sectionY > 100)
  }

  // 紀錄主管是否手動取消選擇，避免每次 exams/statusTab 更新時又自動跳選第一張
  const isManuallyClearedRef = useRef(false)

  // 自動為切換 tab 選擇第一張考卷（若有 URL 定位 targetExamId 且符合目前 tab 則優先保留）
  useEffect(() => {
    if (isManuallyClearedRef.current) {
      return
    }
    if (filteredExams.length > 0) {
      if (!filteredExams.some(e => e.examId === selectedExamId)) {
        setSelectedExamId(filteredExams[0].examId)
      }
    } else {
      setSelectedExamId(null)
    }
  }, [statusTab, filterMode, exams])

  // 當主管手動切換狀態 Tab 時，重置手動清除標記
  const handleStatusTabChange = (tab: 'submitted' | 'graded' | 'shelved') => {
    isManuallyClearedRef.current = false
    setStatusTab(tab)
  }

  const currentExam = exams.find(e => e.examId === selectedExamId)

  // 當切換選取的考卷 ID 時才重置打分與評語（避免背景實時同步考卷列表時把主管寫到一半的內容蓋掉）
  useEffect(() => {
    if (!currentExam) return
    const initialScores: Record<string, number> = {}
    const initialComments: Record<string, string> = {}

    currentExam.answers.forEach(ans => {
      initialScores[ans.questionId] = ans.score !== undefined ? ans.score : (currentExam.mode === 'quiz' ? 5 : 8)
      initialComments[ans.questionId] = ans.comment || ''
    })

    setGradingScores(initialScores)
    setGradingComments(initialComments)
  }, [selectedExamId])

  const handleScoreChange = (qId: string, val: number) => {
    const maxVal = currentExam?.mode === 'quiz' ? 5 : 10
    const clamped = Math.max(0, Math.min(maxVal, val))
    setGradingScores(prev => ({ ...prev, [qId]: clamped }))
  }

  const handleCommentChange = (qId: string, text: string) => {
    setGradingComments(prev => ({ ...prev, [qId]: text }))
  }

  const handleQuickCorrectToggle = (qId: string, checked: boolean) => {
    const maxScore = currentExam?.mode === 'quiz' ? 5 : 10
    if (checked) {
      setGradingComments(prev => ({ ...prev, [qId]: '正確' }))
      setGradingScores(prev => ({ ...prev, [qId]: maxScore }))
    } else {
      if (gradingComments[qId] === '正確') {
        setGradingComments(prev => ({ ...prev, [qId]: '' }))
      }
    }
  }

  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false)
  const [showGradeConfirmModal, setShowGradeConfirmModal] = useState(false)
  const [pendingTotalScore, setPendingTotalScore] = useState(0)

  const [showWarningModal, setShowWarningModal] = useState(false)
  const [warningMessage, setWarningMessage] = useState('')

  // 暫時不批改/擱置考卷功能
  const handleShelveExam = async () => {
    if (!currentExam || isSubmittingGrade) return
    setIsSubmittingGrade(true)
    try {
      await updateExamStatusFirestore(currentExam.examId, 'shelved')
      showToast(`📦 考卷（${currentExam.displayName}）已暫時擱置，不顯示在待批改列表。`)
      await fetchPendingExams()
    } catch (e: any) {
      console.error('Failed to shelve exam:', e)
      alert(`⚠️ 擱置失敗：${e?.message || '網路異常'}`)
    } finally {
      setIsSubmittingGrade(false)
    }
  }

  // 從已擱置或已批改恢復至待批改
  const handleUnshelveExam = async () => {
    if (!currentExam || isSubmittingGrade) return
    setIsSubmittingGrade(true)
    try {
      await updateExamStatusFirestore(currentExam.examId, 'submitted')
      showToast(`🔄 考卷（${currentExam.displayName}）已移回待批改清單。`)
      await fetchPendingExams()
    } catch (e: any) {
      console.error('Failed to unshelve exam:', e)
      alert(`⚠️ 移回失敗：${e?.message || '網路異常'}`)
    } finally {
      setIsSubmittingGrade(false)
    }
  }

  const handleOpenGradeConfirm = () => {
    if (!currentExam) return

    // 1. 檢查評語防呆：問答題/申論題若未填評語阻擋送出
    const targetAnswers = currentExam.answers.filter(
      a => currentExam.mode === 'essay' || a.questionDoc?.type === 'qa' || (!a.questionDoc && a.questionId.includes('qa'))
    )

    for (let i = 0; i < targetAnswers.length; i++) {
      const qId = targetAnswers[i].questionId
      const cText = (gradingComments[qId] ?? '').trim()
      if (!cText) {
        setWarningMessage(`⚠️ 評語填寫不完整！\n\n第 ${i + 1} 題（ID: ${qId}）尚未填寫評語與指導建議。\n為維護考核品質，請補齊所有題目評語或勾選快捷「正確」後再送出批改！`)
        setShowWarningModal(true)
        return
      }
    }

    // 2. 計算試算總分
    let essaySum = 0
    targetAnswers.forEach(ans => {
      essaySum += gradingScores[ans.questionId] || 0
    })

    const calculatedTotal = (currentExam.choiceScore || 0) + essaySum
    setPendingTotalScore(calculatedTotal)
    setShowGradeConfirmModal(true)
  }

  const handleSubmitGrading = async () => {
    if (!currentExam || isSubmittingGrade) return
    setIsSubmittingGrade(true)
    setShowGradeConfirmModal(false)

    let essayScoreSum = 0
    const updatedAnswers = currentExam.answers.map((ans) => {
      const awarded = gradingScores[ans.questionId] || 0
      essayScoreSum += awarded
      return {
        questionId: ans.questionId,
        userAnswer: ans.userAnswer,
        isCorrect: ans.isCorrect,
        score: awarded,
        feedback: gradingComments[ans.questionId] || '',
        questionDoc: ans.questionDoc,
      }
    })

    try {
      const totalScore = await gradeExamFirestore({
        examId: currentExam.examId,
        answers: updatedAnswers,
        essayScore: essayScoreSum,
        choiceScore: currentExam.choiceScore || 0,
        gradedBy: userDoc?.displayName || '管理者',
      })

      const isPassed = totalScore >= 90

      // 取得該考生此模式歷史考次
      const userExams = await getUserExamsFirestore(currentExam.uid)
      const attemptCount = userExams.filter((e: CloudExamDoc) => e.mode === currentExam.mode).length || 1

      // 自動寫入 / 匯出至 Google Sheets
      fetch('/api/export-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentExam.email || 'examinee@example.com',
          displayName: currentExam.displayName || '客服勇者',
          date: new Date().toLocaleString('zh-TW', { hour12: false }),
          mode: currentExam.mode,
          score: totalScore,
          maxScore: 100,
          passed: isPassed,
          attemptCount: attemptCount,
        }),
      }).catch((err) => console.error('📊 [Score Sheet Sync Error]', err))

      if (currentExam.mode === 'essay') {
        clearEssayLock()
      }

      showToast(`✅ 批改完成！總得分：${totalScore} 分 (${isPassed ? '通過' : '未通過'})。紀錄已更新至雲端與 Google Sheets！`)

      await fetchPendingExams()
    } catch (e: any) {
      console.error('Failed to submit grade to Firestore:', e)
      alert(`⚠️ 批改失敗：${e?.message || '請確認網路連線'}`)
    } finally {
      setIsSubmittingGrade(false)
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
      {/* 頂部導航 header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.backBtn}>
            ⬅️ 返回大廳
          </Link>
          <h1 className={styles.title}>👑 主管批改後台 (綜合 / 申論)</h1>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.roleBadge}>Role: Supervisor / Admin</span>
        </div>
      </header>

      {/* Toast 提示框 */}
      {toastMessage && (
        <div className={styles.toast}>
          {toastMessage}
        </div>
      )}

      {/* 主內容區：左側考卷清單，右側作答詳情與評分 */}
      <div className={styles.mainLayout}>
        {/* 左側考卷列表 */}
        <aside className={styles.sidebar}>
          {/* 頂部 Tab 切換：待批改 / 已批改 / 已擱置 */}
          <div className={styles.tabGroup} style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button
              className={`${styles.tabBtn} ${statusTab === 'submitted' ? styles.tabBtnActive : ''}`}
              onClick={() => setStatusTab('submitted')}
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: 12,
                cursor: 'pointer',
                background: statusTab === 'submitted' ? '#f4a24a' : '#1e293b',
                color: statusTab === 'submitted' ? '#000' : '#fff',
                border: '1px solid #f4a24a',
                fontWeight: 'bold',
                borderRadius: 4
              }}
            >
              ⏳ 待批改 ({exams.filter(e => e.status === 'submitted' && (filterMode === 'all' || e.mode === filterMode)).length})
            </button>
            <button
              className={`${styles.tabBtn} ${statusTab === 'graded' ? styles.tabBtnActive : ''}`}
              onClick={() => setStatusTab('graded')}
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: 12,
                cursor: 'pointer',
                background: statusTab === 'graded' ? '#4ade80' : '#1e293b',
                color: statusTab === 'graded' ? '#000' : '#fff',
                border: '1px solid #4ade80',
                fontWeight: 'bold',
                borderRadius: 4
              }}
            >
              ✅ 已批改 ({exams.filter(e => e.status === 'graded' && (filterMode === 'all' || e.mode === filterMode)).length})
            </button>
            <button
              className={`${styles.tabBtn} ${statusTab === 'shelved' ? styles.tabBtnActive : ''}`}
              onClick={() => setStatusTab('shelved')}
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: 12,
                cursor: 'pointer',
                background: statusTab === 'shelved' ? '#a855f7' : '#1e293b',
                color: statusTab === 'shelved' ? '#fff' : '#fff',
                border: '1px solid #a855f7',
                fontWeight: 'bold',
                borderRadius: 4
              }}
            >
              📦 已擱置 ({exams.filter(e => e.status === 'shelved' && (filterMode === 'all' || e.mode === filterMode)).length})
            </button>
          </div>

          <div className={styles.sidebarTitleRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className={styles.sidebarTitle} style={{ margin: 0, fontSize: '0.95rem' }}>
              {statusTab === 'submitted' ? '📋 待批改考卷' : statusTab === 'graded' ? '查閱已批改考卷' : '📦 已擱置考卷'}
            </h2>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              style={{ background: '#1c2237', color: '#fff', border: '1px solid #4a6fa5', padding: '4px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
            >
              <option value="all">全部模式</option>
              <option value="quiz">綜合模式</option>
              <option value="essay">申論模式</option>
            </select>
          </div>

          <div className={styles.examList}>
            {loadingPending ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 20 }}>載入雲端考卷中...</p>
            ) : filteredExams.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 20 }}>
                {statusTab === 'submitted' ? '無待批改考卷' : statusTab === 'graded' ? '無已批改紀錄' : '無擱置中的考卷'}
              </p>
            ) : (
              filteredExams.map(exam => {
                const isSelected = exam.examId === selectedExamId
                return (
                  <button
                    key={exam.examId}
                    className={`${styles.examCard} ${isSelected ? styles.examCardActive : ''}`}
                    onClick={() => setSelectedExamId(exam.examId)}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.examineeName}>
                        {exam.mode === 'quiz' ? '🎯 [綜合] ' : '📜 [申論] '}
                        {exam.displayName}
                      </span>
                      <span className={`${styles.statusBadge} ${styles[exam.status]}`}>
                        {exam.status === 'submitted' ? '⏳ 待批改' : exam.status === 'graded' ? '✅ 已批改' : '📦 擱置'}
                      </span>
                    </div>
                    <div className={styles.cardMeta}>
                      <span>提交時間：{exam.submittedAt && !isNaN(new Date(exam.submittedAt).getTime()) ? new Date(exam.submittedAt).toLocaleString('zh-TW', { hour12: false }) : '最近提交'}</span>
                      {exam.mode === 'quiz' && (
                        <span style={{ display: 'block', fontSize: 12, color: '#a0aec0', marginTop: 2 }}>
                          選擇題得分：{exam.choiceScore ?? 0} 分
                        </span>
                      )}
                      {exam.status === 'graded' && (
                        <span className={styles.scoreText}>總分：{exam.totalScore} 分</span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* 右側詳細作答與評分面板 */}
        <section ref={detailSectionRef} onScroll={handleScroll} className={styles.detailSection}>
          {!currentExam ? (
            <div className={styles.emptyState}>
              <p>請選擇左側的考卷進行查閱或批改</p>
            </div>
          ) : (
            <div className={styles.detailPanel}>
              {/* 考卷頭部資訊 */}
              <div className={styles.panelHeader}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 className={styles.examineeTitle} style={{ wordBreak: 'break-all' }}>
                    {currentExam.mode === 'quiz' ? '🎯 綜合模式考卷' : '📜 申論模式考卷'} — {currentExam.displayName} ({currentExam.email})
                  </h2>
                  <div className={styles.subDetail} style={{ marginTop: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#cbd5e1' }}>考卷 ID: {currentExam.examId}</span>
                    <span style={{ color: '#475569' }}>|</span>
                    <span style={{ color: '#cbd5e1' }}>
                      狀態：
                      <span className={`${styles.statusText} ${styles[currentExam.status]}`}>
                        {currentExam.status === 'submitted' ? '等待主管審核評分' : currentExam.status === 'graded' ? `已批改 (${currentExam.totalScore}分 / ${currentExam.passed ? '通過' : '未通過'})` : '📦 暫時擱置中'}
                      </span>
                    </span>
                    {currentExam.mode === 'quiz' && (
                      <>
                        <span style={{ color: '#475569' }}>|</span>
                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>
                          選擇題得分：{currentExam.choiceScore ?? 0} / 45 分
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 16, flexShrink: 0 }}>
                  {currentExam.status === 'submitted' && (
                    <button
                      className="btn-pixel"
                      style={{
                        background: '#7e22ce',
                        color: '#fff',
                        border: '2px solid #a855f7',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={handleShelveExam}
                      disabled={isSubmittingGrade}
                    >
                      📦 暫時擱置
                    </button>
                  )}
                  {(currentExam.status === 'shelved' || currentExam.status === 'graded') && (
                    <button
                      className="btn-pixel"
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        border: '2px solid #38bdf8',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={handleUnshelveExam}
                      disabled={isSubmittingGrade}
                    >
                      🔄 移回待批改
                    </button>
                  )}
                  <button
                    className="btn-pixel btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={handleOpenGradeConfirm}
                    disabled={isSubmittingGrade}
                  >
                    {isSubmittingGrade ? '🚀 批改儲存中...' : currentExam.status === 'submitted' ? '💾 送出評分與評語' : '💾 更新評分與評語'}
                  </button>
                </div>
              </div>

              {/* 每題作答詳情與評分輸入 */}
              <div className={styles.questionsContainer}>
                {currentExam.answers.map((ans, idx) => {
                  const qData = ans.questionDoc || MOCK_ESSAY_QUESTIONS_MAP[ans.questionId] || {
                    content: `題目 (ID: ${ans.questionId})`,
                    context: '',
                    difficulty: 'medium',
                    answer: ''
                  }

                  const isChoice = currentExam.mode === 'quiz' && qData && qData.type !== 'qa' && !ans.questionId.includes('qa')

                  // 選擇題卡片展示
                  if (isChoice) {
                    const isExpiredOrEmptyChoice = !ans.userAnswer || ans.userAnswer === '(未填寫)' || ans.userAnswer === '(超時未答)' || ans.timeExpired
                    return (
                      <div
                        key={ans.questionId}
                        className={styles.questionCard}
                        style={{ opacity: 0.95 }}
                      >
                        <div className={styles.qHeader}>
                          <span className={styles.qIndex}>第 {idx + 1} 題【選擇題 - 自動評分】</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, color: ans.isCorrect ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                              {ans.isCorrect ? '✅ 答對 (+得分)' : '❌ 答錯 (0分)'}
                            </span>
                          </div>
                        </div>

                        {qData.context && (
                          <div className={styles.qContext}>
                            <strong>📌 題目情境：</strong> {qData.context}
                          </div>
                        )}

                        <div className={styles.qContent}>
                          <strong>問：</strong>{qData.content}
                        </div>

                        {/* 選擇題選項清單 (A, B, C, D) */}
                        {qData.options && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, margin: '12px 0' }}>
                            {(Object.entries(qData.options) as [string, string][]).map(([key, text]) => {
                              const isUserOption = ans.userAnswer === key
                              const isCorrectOption = qData.answer === key
                              return (
                                <div
                                  key={key}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    border: isCorrectOption
                                      ? '2px solid #22c55e'
                                      : isUserOption
                                      ? '2px solid #ef4444'
                                      : '1px solid #334155',
                                    background: isCorrectOption
                                      ? 'rgba(34, 197, 94, 0.15)'
                                      : isUserOption
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : '#0f172a',
                                    color: isCorrectOption
                                      ? '#4ade80'
                                      : isUserOption
                                      ? '#f87171'
                                      : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                  }}
                                >
                                  <strong style={{ minWidth: 16 }}>{key}.</strong>
                                  <span style={{ flex: 1 }}>{text}</span>
                                  {isCorrectOption && <span style={{ fontSize: 11, background: '#15803d', color: '#fff', padding: '1px 5px', borderRadius: 2 }}>✅ 正解</span>}
                                  {isUserOption && !isCorrectOption && <span style={{ fontSize: 11, background: '#b91c1c', color: '#fff', padding: '1px 5px', borderRadius: 2 }}>❌ 考生選擇</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <div
                          className={styles.userAnswerBox}
                          style={{
                            border: isExpiredOrEmptyChoice ? '1px solid #ef4444' : '1px solid #1e293b',
                            background: isExpiredOrEmptyChoice ? 'rgba(239, 68, 68, 0.08)' : '#111827',
                            marginTop: 8
                          }}
                        >
                          <div className={styles.answerBoxLabel} style={{ color: isExpiredOrEmptyChoice ? '#f87171' : '#9ca3af' }}>
                            考生選擇答案：
                          </div>
                          <div className={styles.userAnswerText} style={{ color: isExpiredOrEmptyChoice ? '#f87171' : '#e5e7eb' }}>
                            {isExpiredOrEmptyChoice ? (
                              <span style={{ color: '#f87171' }}>作答超時未選擇答案</span>
                            ) : (
                              `${ans.userAnswer}${qData.options?.[ans.userAnswer as 'A'|'B'|'C'|'D'] ? ` (${qData.options[ans.userAnswer as 'A'|'B'|'C'|'D']})` : ''}`
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const maxScorePerQ = currentExam.mode === 'quiz' ? 5 : 10
                  const score = gradingScores[ans.questionId] ?? (currentExam.mode === 'quiz' ? 5 : 8)
                  const comment = gradingComments[ans.questionId] ?? ''
                  const isQuickCorrect = comment.trim() === '正確' && score === maxScorePerQ

                  return (
                    <div key={ans.questionId} className={styles.questionCard}>
                      <div className={styles.qHeader}>
                        <span className={styles.qIndex}>第 {idx + 1} 題 ({currentExam.mode === 'quiz' ? '問答題' : '申論題'})</span>
                        <span className={styles.qDifficulty}>難度：{qData.difficulty}</span>
                        {ans.timeExpired && (
                          <span className={styles.expiredBadge}>⏱️ 此題因作答超時自動關閉</span>
                        )}
                      </div>

                      {/* 題目情境與內文 */}
                      {qData.context && (
                        <div className={styles.qContext}>
                          <strong>📌 題目情境：</strong> {qData.context}
                        </div>
                      )}
                      <div className={styles.qContent}>
                        <strong>問：</strong>{qData.content}
                      </div>

                      {/* 參考標準答案（如果有） */}
                      {qData.answer && (
                        <div className={styles.qContext} style={{ backgroundColor: '#2d3748', borderLeftColor: '#4299e1', marginTop: 8 }}>
                          <strong>💡 參考答案/關鍵字：</strong> {qData.answer}
                        </div>
                      )}

                      {/* 考生答案 */}
                      {(() => {
                        const isExpiredOrEmpty = !ans.userAnswer || ans.userAnswer === '(超時未答)' || ans.timeExpired
                        return (
                          <div
                            className={styles.userAnswerBox}
                            style={{
                              border: isExpiredOrEmpty ? '1px solid #ef4444' : undefined,
                              background: isExpiredOrEmpty ? 'rgba(239, 68, 68, 0.08)' : undefined
                            }}
                          >
                            <div className={styles.answerBoxLabel} style={{ color: isExpiredOrEmpty ? '#f87171' : undefined }}>
                              考生作答內容：
                            </div>
                            <div className={styles.userAnswerText}>
                              {isExpiredOrEmpty ? (
                                <span style={{ color: '#f87171' }}>作答超時未填寫答案</span>
                              ) : (
                                ans.userAnswer
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* 主管評分與評語輸入區 */}
                      <div className={styles.gradingBox}>
                        {/* 快捷勾選選項 */}
                        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(74, 222, 128, 0.1)', padding: '6px 12px', border: '1px solid rgba(74, 222, 128, 0.3)', borderRadius: 4 }}>
                          <input
                            type="checkbox"
                            id={`quick-correct-${ans.questionId}`}
                            checked={isQuickCorrect}
                            onChange={(e) => handleQuickCorrectToggle(ans.questionId, e.target.checked)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <label htmlFor={`quick-correct-${ans.questionId}`} style={{ color: '#4ade80', fontWeight: 'bold', fontSize: 14, cursor: 'pointer' }}>
                            ⚡ 快捷選項：評語填寫「正確」並給予滿分 ({maxScorePerQ}分)
                          </label>
                        </div>

                        <div className={styles.scoreRow}>
                          <label className={styles.scoreLabel}>
                            🎯 主管給分 (0 - {maxScorePerQ} 分)：
                          </label>
                          <div className={styles.scoreInputGroup}>
                            <input
                              type="number"
                              min={0}
                              max={maxScorePerQ}
                              value={score}
                              onChange={(e) => {
                                const raw = parseInt(e.target.value)
                                handleScoreChange(ans.questionId, isNaN(raw) ? 0 : raw)
                              }}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value)
                                const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(maxScorePerQ, val))
                                handleScoreChange(ans.questionId, clamped)
                              }}
                              className={styles.scoreInput}
                            />
                            <span className={styles.scoreMax}>/ {maxScorePerQ} 分</span>
                          </div>
                        </div>

                        <div className={styles.commentRow}>
                          <label className={styles.commentLabel}>
                            📝 評語與指導建議：
                          </label>
                          <textarea
                            rows={3}
                            placeholder="請針對此題作答邏輯、同理心表現給予文字指導..."
                            value={comment}
                            onChange={(e) => handleCommentChange(ans.questionId, e.target.value)}
                            className={styles.commentTextarea}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 底部按鈕 */}
              <div className={styles.panelFooter}>
                <button
                  className="btn-pixel btn-primary"
                  onClick={handleOpenGradeConfirm}
                  disabled={isSubmittingGrade}
                >
                  {isSubmittingGrade ? '🚀 批改儲存中...' : currentExam.status === 'submitted' ? '🚀 確認完成批改並寫入成績' : '💾 更新批改與成績'}
                </button>
              </div>

              {/* 批改二次確認彈窗 */}
              <ConfirmModal
                isOpen={showGradeConfirmModal}
                title="📋 確認送出主管批改評分"
                message={`確定要送出對【${currentExam.displayName}】的考卷評分嗎？

• 模式：${currentExam.mode === 'quiz' ? '綜合模式' : '申論模式'}
• 選擇題得分：${currentExam.choiceScore || 0} 分
• 問答/申論評分：${pendingTotalScore - (currentExam.choiceScore || 0)} 分
• 試算最終總得分：${pendingTotalScore} 分 (${pendingTotalScore >= (currentExam.mode === 'quiz' ? passThresholds.quiz : passThresholds.essay) ? '✅ 合格通過' : `❌ 未達 ${currentExam.mode === 'quiz' ? passThresholds.quiz : passThresholds.essay} 分門檻`})

送出後成績將即時更新至雲端與 Google Sheets。`}
                confirmText="🚀 確認送出批改"
                cancelText="✏️ 返回繼續檢查"
                onConfirm={handleSubmitGrading}
                onCancel={() => setShowGradeConfirmModal(false)}
              />

              {/* 評言未填寫防呆提醒彈窗 */}
              <ConfirmModal
                isOpen={showWarningModal}
                title="⚠️ 評語未填寫完整"
                message={warningMessage}
                confirmText="✏️ 我知道了，前往補齊"
                cancelText="關閉"
                onConfirm={() => setShowWarningModal(false)}
                onCancel={() => setShowWarningModal(false)}
              />
            </div>
          )}
        </section>

        {/* 右下角 Top 回頂部懸浮按鈕 */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className={styles.scrollTopBtn}
            title="回到頂部"
          >
            ⬆️ 頂部
          </button>
        )}
      </div>
    </div>
  )
}

