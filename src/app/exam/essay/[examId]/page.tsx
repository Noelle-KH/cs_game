'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getFirestoreQuestions } from '@/lib/questionStore'
import { getSystemSettings } from '@/lib/settingsStore'
import {
  setEssayLock,
  getEssayLock,
} from '@/lib/examSession'
import { submitExamFirestore, deleteExamFirestore } from '@/lib/examStore'
import TimerBar from '@/components/TimerBar'
import ConfirmModal from '@/components/ConfirmModal'
import styles from './page.module.css'

const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_MOCK_DISPLAY_NAME = '開發測試員'

export default function EssayExamPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = use(params)
  const { userDoc, loading } = useAuth()
  const router = useRouter()

  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timePerQuestion, setTimePerQuestion] = useState(600)
  const [timeLeft, setTimeLeft] = useState(600)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const [phase, setPhase] = useState<'exam' | 'saving'>('exam')
  const [expiredSet, setExpiredSet] = useState<Set<string>>(new Set())
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [isQuestionsLoaded, setIsQuestionsLoaded] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedRef = useRef(false)

  // 永遠指向最新 state 的 ref（避免 stale closure）
  const answersRef = useRef(answers)
  const expiredSetRef = useRef(expiredSet)
  const currentIdxRef = useRef(currentIdx)
  answersRef.current = answers
  expiredSetRef.current = expiredSet
  currentIdxRef.current = currentIdx

  useEffect(() => {
    async function loadEssayQuestions() {
      try {
        const sysSettings = await getSystemSettings()
        const timeLimit = sysSettings.essayTimePerQuestion || 600
        const countLimit = sysSettings.essayQuestionCount || 10

        setTimePerQuestion(timeLimit)
        setTimeLeft(timeLimit)

        const allStored = await getFirestoreQuestions()
        
        // 去除重複題目
        const uniqueMap = new Map<string, any>()
        allStored.forEach((q) => {
          if (q.enabled && q.type === 'essay') {
            const key = q.id || q.content.trim()
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, q)
            }
          }
        })
        const validQs = Array.from(uniqueMap.values())

        // Fisher-Yates 嚴謹隨機洗牌
        for (let i = validQs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[validQs[i], validQs[j]] = [validQs[j], validQs[i]]
        }

        setQuestions(validQs.slice(0, countLimit))
      } finally {
        setIsQuestionsLoaded(true)
      }
    }
    loadEssayQuestions()
  }, [])

  const currentQ = questions[currentIdx]
  const displayName = userDoc?.displayName ?? (IS_DEV && !loading ? DEV_MOCK_DISPLAY_NAME : '')

  // ── phase === 'saving' 時儲存並導頁 ──────────────────────────
  useEffect(() => {
    if (phase !== 'saving' || savedRef.current) return
    savedRef.current = true

    const finalAnswers = answersRef.current
    const finalExpired = expiredSetRef.current

    async function handleCloudSubmit() {
      const cloudAnswers = questions.map((q) => ({
        questionId: q.id,
        userAnswer: finalAnswers[q.id] ?? '',
        timeExpired: finalExpired.has(q.id),
        questionDoc: q,
      }))

      try {
        await submitExamFirestore({
          examId,
          answers: cloudAnswers,
          choiceScore: 0,
          essayScore: 0,
          isFullyAutoGraded: false,
        })
      } catch (e) {
        console.error('Failed to submit essay exam to Firestore:', e)
      }

      // 保持 Local Lock (鎖定場次)
      setEssayLock(examId)

      router.push(`/exam/essay/${examId}/result`)
    }

    handleCloudSubmit()
  }, [phase, examId, questions, router])

  // ── 計時器 ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam' || isTimedOut) return

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentIdx, phase, isTimedOut])

  // ── 超時偵測 ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam' || timeLeft > 0 || isTimedOut) return

    if (timerRef.current) clearInterval(timerRef.current)

    setIsTimedOut(true)
    const expiredId = questions[currentIdxRef.current]?.id
    if (expiredId) {
      setExpiredSet((prev) => {
        const next = new Set(prev)
        next.add(expiredId)
        return next
      })
    }
  }, [timeLeft, phase, questions, isTimedOut])

  // ── 手動作答提交 ──────────────────────────────────────────────
  function handleSubmitAnswer() {
    if (timerRef.current) clearInterval(timerRef.current)

    const nextIdx = currentIdx + 1
    if (nextIdx >= questions.length) {
      setPhase('saving')
    } else {
      setCurrentIdx(nextIdx)
      setTimeLeft(timePerQuestion)
      setIsTimedOut(false)
    }
  }

  function handleAnswerInput(value: string) {
    if (isTimedOut) return
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }))
  }

  // ── Loading / Saving / 無題目 畫面 ─────────────────────────────
  if (loading || !isQuestionsLoaded) {
    return (
      <div className={styles.loading}>
        <p className="pixel-title animate-float">🚀 載入題庫與考場中...</p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className={styles.loading} style={{ flexDirection: 'column', gap: 16 }}>
        <p className="pixel-title">⚠️ 目前題庫中尚無可用的申論題</p>
        <p style={{ color: '#ccc', fontSize: '0.9rem' }}>請主管至後台（/admin/questions）匯入或啟用申論題後再進行考試。</p>
        <button className="btn-pixel btn-primary" onClick={() => router.push('/exam/essay/lobby')}>
          ← 返回申論大廳
        </button>
      </div>
    )
  }

  if (phase === 'saving') {
    return (
      <div className={styles.loading}>
        <p className="pixel-title animate-float">📨 提交中，請稍候...</p>
      </div>
    )
  }

  // ── 考試主畫面 ────────────────────────────────────────────────
  const currentAnswer = answers[currentQ.id] ?? ''
  const hasAnswer = currentAnswer.trim().length > 0
  const isLastQuestion = currentIdx === questions.length - 1
  const wordCount = currentAnswer.length
  const timeTotal = timePerQuestion

  return (
    <main className={`pixel-bg ${styles.main}`}>
      {/* 自訂像素離開確認彈窗 */}
      <ConfirmModal
        isOpen={showExitConfirm}
        title="⚠️ 離開申論特訓考場確認"
        message="確定要放棄並離開申論考試嗎？未提交的內容將不會被記錄。"
        confirmText="🚪 確定放棄離開"
        cancelText="📝 繼續申論作答"
        onConfirm={() => {
          deleteExamFirestore(examId)
          router.push('/exam/essay/lobby')
        }}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* 頂部 Navbar */}
      <nav className={styles.navbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn-pixel btn-ghost"
            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            onClick={() => setShowExitConfirm(true)}
          >
            🚪 離開考試
          </button>
          <span className={`pixel-title ${styles.navMode}`}>📝 申論模式</span>
        </div>
        <div className={styles.navProgress}>
          {questions.map((_, i) => (
            <div
              key={i}
              className={`${styles.progressDot} ${
                i < currentIdx ? styles.dotDone :
                i === currentIdx ? styles.dotCurrent :
                styles.dotPending
              }`}
            />
          ))}
        </div>
        <span className={styles.navPlayer}>👤 {displayName}</span>
      </nav>

      {/* 題號 Banner */}
      <div className={styles.questionBanner}>
        <span className={styles.questionNum}>
          第 <strong>{currentIdx + 1}</strong> 題
          <span className={styles.questionTotal}> / {questions.length}</span>
        </span>
        <span className={styles.questionType}>申論題</span>
        <span className={styles.questionDiff}>
          {currentQ.difficulty === 'basic' ? '⭐ 基礎' : currentQ.difficulty === 'medium' ? '⭐⭐ 中階' : '⭐⭐⭐ 進階'}
        </span>
      </div>

      <div className={`container ${styles.content}`}>
        {/* 將計時條移至題目上方 */}
        <div className={styles.timerWrap} style={{ marginBottom: 16 }}>
          <TimerBar
            timeLeft={timeLeft}
            totalTime={timeTotal}
            showLabel
          />
        </div>

        {/* 超時提示 Banner */}
        {isTimedOut && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '2px solid #ef4444',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>⏱️ <strong>本題作答時間已到！</strong> 系統已幫您標記超時，請點擊右下方按鈕繼續下一題。</span>
            <button
              className="btn-pixel btn-secondary"
              style={{ padding: '4px 12px', fontSize: '0.85rem' }}
              onClick={handleSubmitAnswer}
            >
              {isLastQuestion ? '📨 提交考卷' : '前往下一題 →'}
            </button>
          </div>
        )}

        {/* 題目區塊 */}
        <section className={`pixel-panel ${styles.questionPanel}`}>
          <div className={styles.contextBox}>
            <span className={styles.contextLabel}>📋 情境</span>
            <p className={styles.contextText}>
              {currentQ.context && currentQ.context.trim() ? currentQ.context : '不限情境作答'}
            </p>
          </div>
          <div className={styles.questionContent}>
            <p className={styles.questionText}>{currentQ.content}</p>
          </div>
        </section>

        {/* 作答區塊 */}
        <section className={`pixel-panel ${styles.answerPanel}`}>
          <div className={styles.answerHeader}>
            <h2 className={`pixel-title ${styles.answerTitle}`}>✏️ 申論作答</h2>
            <div className={styles.answerHints}>
              <span className={styles.hintChip}>主管親自批改</span>
              <span className={styles.hintChip}>每題滿分 10 分</span>
            </div>
          </div>

          <div className={styles.textareaWrap}>
            <textarea
              id="textarea-essay"
              className={styles.essayTextarea}
              placeholder={isTimedOut ? '本題已超時，無法繼續編輯...' : '請輸入你的申論內容。建議包含：情況分析、處理步驟、溝通技巧與注意事項…'}
              value={currentAnswer}
              onChange={(e) => handleAnswerInput(e.target.value)}
              disabled={isTimedOut}
              rows={10}
            />
            <div className={styles.wordCountBar}>
              <span className={`${styles.wordCount} ${wordCount < 50 ? styles.wordCountLow : styles.wordCountOk}`}>
                {wordCount} 字
              </span>
              {wordCount < 50 && wordCount > 0 && !isTimedOut && (
                <span className={styles.wordHint}>建議至少 50 字以獲得更好評分</span>
              )}
              {wordCount === 0 && !isTimedOut && (
                <span className={styles.wordHint}>請輸入至少一個字後才能提交</span>
              )}
            </div>
          </div>

          <button
            id="btn-submit-answer"
            className={`btn-pixel btn-secondary ${styles.submitBtn} ${(!hasAnswer && !isTimedOut) ? styles.submitDisabled : ''}`}
            onClick={handleSubmitAnswer}
            disabled={!hasAnswer && !isTimedOut}
          >
            {isLastQuestion ? '📨 完成作答並提交' : '確認作答 →'}
          </button>

          <p className={styles.submitNote}>
            {isLastQuestion
              ? '⚠️ 提交後即進入等待批改狀態，完成前無法開始新場次'
              : '作答後點擊確認，計時器將重置至下一題'}
          </p>
        </section>
      </div>
    </main>
  )
}
