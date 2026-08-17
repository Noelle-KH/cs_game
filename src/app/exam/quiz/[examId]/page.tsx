'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getFirestoreQuestions } from '@/lib/questionStore'
import { saveExamSession, ExamSessionAnswer } from '@/lib/examSession'
import TimerBar from '@/components/TimerBar'
import ConfirmModal from '@/components/ConfirmModal'
import styles from './page.module.css'

const TIME_PER_QUESTION = 300
const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_MOCK_DISPLAY_NAME = '開發測試員'

export default function ExamPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = use(params)
  const { userDoc, loading } = useAuth()
  const router = useRouter()

  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(IS_DEV ? 30 : TIME_PER_QUESTION)
  const [phase, setPhase] = useState<'exam' | 'saving'>('exam')
  const [expiredSet, setExpiredSet] = useState<Set<string>>(new Set())
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedRef = useRef(false)

  // ── 永遠指向最新 state 的 ref（避免 stale closure）─────────────
  const answersRef = useRef(answers)
  const expiredSetRef = useRef(expiredSet)
  const currentIdxRef = useRef(currentIdx)
  answersRef.current = answers
  expiredSetRef.current = expiredSet
  currentIdxRef.current = currentIdx

  useEffect(() => {
    async function loadQuizQuestions() {
      const allStored = await getFirestoreQuestions()
      const validQs = allStored.filter(q => q.enabled && (q.type === 'choice' || q.type === 'qa'))
      // Fisher-Yates 隨機洗牌
      const shuffled = [...validQs].sort(() => Math.random() - 0.5)
      // 限制最多 20 題
      setQuestions(shuffled.slice(0, 20))
    }
    loadQuizQuestions()
  }, [])

  const currentQ = questions[currentIdx]
  const displayName = userDoc?.displayName ?? (IS_DEV && !loading ? DEV_MOCK_DISPLAY_NAME : '')

  // ── phase === 'saving' 時儲存並導頁（正確的 side-effect 位置）─
  useEffect(() => {
    if (phase !== 'saving' || savedRef.current) return
    savedRef.current = true

    const finalAnswers = answersRef.current
    const finalExpired = expiredSetRef.current

    const totalQs = questions.length
    let correctCount = 0
    let totalScore = 0

    if (totalQs > 0) {
      const perQuestionScore = 100 / totalQs

      questions.forEach((q) => {
        const userAns = (finalAnswers[q.id] ?? '').trim()

        if (q.type === 'choice') {
          if (userAns === q.answer) {
            correctCount++
            totalScore += perQuestionScore
          }
        }
      })
    }

    const choiceScore = Math.round(totalScore)
    const choiceQs = questions.filter((q) => q.type === 'choice')
    const qaQs = questions.filter((q) => q.type === 'qa')

    // 若有問答題，狀態為 submitted（待主管審核）；若全為選擇題，狀態為 graded
    const status = qaQs.length > 0 ? 'submitted' : 'graded'
    const finalScore = status === 'graded' ? choiceScore : choiceScore
    const passed = status === 'graded' ? finalScore >= 90 : false

    const sessionAnswers: ExamSessionAnswer[] = questions.map((q) => {
      const userAns = (finalAnswers[q.id] ?? '').trim()
      let isCorrect: boolean | undefined = undefined

      if (q.type === 'choice') {
        isCorrect = userAns === q.answer
      }
      // 問答題 isCorrect 保持 undefined，待主管批改

      return {
        questionId: q.id,
        userAnswer: userAns,
        isCorrect,
        timeExpired: finalExpired.has(q.id),
        questionDoc: q,
      }
    })

    saveExamSession({
      examId,
      mode: 'quiz',
      displayName: displayName || DEV_MOCK_DISPLAY_NAME,
      status,
      score: finalScore,
      choiceScore,
      maxScore: 100,
      passed,
      correctCount,
      totalChoice: choiceQs.length,
      totalQa: qaQs.length,
      expiredCount: finalExpired.size,
      answeredCount: Object.values(finalAnswers).filter((v) => v.trim().length > 0).length,
      answers: sessionAnswers,
      submittedAt: new Date().toISOString(),
    })

    router.push(`/exam/quiz/${examId}/result`)
  }, [phase, examId, displayName, questions, router])

  // ── 計時器：只做 setTimeLeft(-1)，不在 setter 內呼叫其他函式 ──
  useEffect(() => {
    if (phase !== 'exam') return

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentIdx, phase])

  // ── 超時偵測：獨立 effect，不在 setter 內做 side effect ────────
  useEffect(() => {
    if (phase !== 'exam' || timeLeft > 0) return

    if (timerRef.current) clearInterval(timerRef.current)

    const expiredId = questions[currentIdxRef.current]?.id
    if (expiredId) {
      setExpiredSet((prev) => {
        const next = new Set(prev)
        next.add(expiredId)
        return next
      })
    }

    const nextIdx = currentIdxRef.current + 1
    if (nextIdx >= questions.length) {
      setPhase('saving')
    } else {
      setCurrentIdx(nextIdx)
      setTimeLeft(IS_DEV ? 30 : TIME_PER_QUESTION)
    }
  }, [timeLeft, phase, questions])

  // ── 手動作答提交 ────────────────────────────────────────────────
  function handleSubmitAnswer() {
    if (timerRef.current) clearInterval(timerRef.current)

    const nextIdx = currentIdx + 1
    if (nextIdx >= questions.length) {
      setPhase('saving')
    } else {
      setCurrentIdx(nextIdx)
      setTimeLeft(IS_DEV ? 30 : TIME_PER_QUESTION)
    }
  }

  function handleSelectChoice(optionKey: string) {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: optionKey }))
  }

  function handleQaInput(value: string) {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }))
  }

  // ── Loading / Saving / 無題目 畫面 ──────────────────────────────
  if ((loading && !IS_DEV) || questions.length === 0) {
    if (questions.length === 0) {
      return (
        <div className={styles.loading} style={{ flexDirection: 'column', gap: 16 }}>
          <p className="pixel-title">⚠️ 目前題庫中尚無可用的選擇/問答題</p>
          <p style={{ color: '#ccc', fontSize: '0.9rem' }}>請請主管至後台（/admin/questions）匯入或啟用題目後再進行考試。</p>
          <button className="btn-pixel btn-primary" onClick={() => router.push('/exam/quiz/lobby')}>
            ← 返回考試大廳
          </button>
        </div>
      )
    }

    return (
      <div className={styles.loading}>
        <p className="pixel-title">載入考試中...</p>
      </div>
    )
  }

  if (phase === 'saving') {
    return (
      <div className={styles.loading}>
        <p className="pixel-title animate-float">📝 計算成績中...</p>
      </div>
    )
  }

  // ── 考試主畫面 ──────────────────────────────────────────────────
  const currentAnswer = answers[currentQ.id] ?? ''
  const hasAnswer = currentAnswer.trim().length > 0
  const isLastQuestion = currentIdx === questions.length - 1

  return (
    <main className={`pixel-bg ${styles.main}`}>
      {/* 自訂像素離開確認彈窗 */}
      <ConfirmModal
        isOpen={showExitConfirm}
        title="⚠️ 離開綜合模式考場確認"
        message="確定要離開考試嗎？未提交的作答進度與成績將不會被記錄。"
        confirmText="🚪 確定離開"
        cancelText="⚔️ 繼續挑戰"
        onConfirm={() => router.push('/exam/quiz/lobby')}
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
          <span className={`pixel-title ${styles.navMode}`}>⚔️ 綜合模式</span>
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
        <span className={`${styles.questionType} ${currentQ.type === 'choice' ? styles.typeChoice : styles.typeQa}`}>
          {currentQ.type === 'choice' ? '選擇題' : '問答題'}
        </span>
        <span className={styles.questionDiff}>
          {currentQ.difficulty === 'basic' ? '⭐ 基礎' : currentQ.difficulty === 'medium' ? '⭐⭐ 中階' : '⭐⭐⭐ 進階'}
        </span>
      </div>

      <div className={`container ${styles.content}`}>
        <div className={styles.layout}>
          {/* 左欄：題目 */}
          <section className={`pixel-panel ${styles.questionPanel}`}>
            {currentQ.context && (
              <div className={styles.contextBox}>
                <span className={styles.contextLabel}>📋 情境</span>
                <p className={styles.contextText}>{currentQ.context}</p>
              </div>
            )}
            <div className={styles.questionContent}>
              <p className={styles.questionText}>{currentQ.content}</p>
            </div>
          </section>

          {/* 右欄：作答區 */}
          <section className={`pixel-panel ${styles.answerPanel}`}>
            <h2 className={`pixel-title ${styles.answerTitle}`}>
              {currentQ.type === 'choice' ? '🎯 選擇答案' : '✏️ 填寫答案'}
            </h2>

            {currentQ.type === 'choice' && currentQ.options ? (
              <div className={styles.choiceList}>
                {(Object.entries(currentQ.options) as [string, string][]).map(([key, text]) => (
                  <button
                    key={key}
                    id={`btn-choice-${key}`}
                    className={`${styles.choiceBtn} ${currentAnswer === key ? styles.choiceSelected : ''}`}
                    onClick={() => handleSelectChoice(key)}
                  >
                    <span className={styles.choiceKey}>{key}</span>
                    <span className={styles.choiceText}>{text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.qaWrap}>
                <textarea
                  id="textarea-qa"
                  className={styles.qaTextarea}
                  placeholder="請輸入你的回答..."
                  value={currentAnswer}
                  onChange={(e) => handleQaInput(e.target.value)}
                  rows={8}
                />
                <div className={styles.qaWordCount}>
                  {currentAnswer.length} 字
                </div>
              </div>
            )}

            <button
              id="btn-submit-answer"
              className={`btn-pixel btn-primary ${styles.submitBtn} ${!hasAnswer ? styles.submitDisabled : ''}`}
              onClick={handleSubmitAnswer}
              disabled={!hasAnswer}
            >
              {isLastQuestion ? '🏁 完成作答' : '確認作答 →'}
            </button>

            {!hasAnswer && (
              <p className={styles.hintText}>
                {currentQ.type === 'choice' ? '請選擇一個選項' : '請輸入至少一個字'}
              </p>
            )}
          </section>
        </div>

        {/* 底部 Timer */}
        <div className={styles.timerWrap}>
          <TimerBar
            timeLeft={timeLeft}
            totalTime={IS_DEV ? 30 : TIME_PER_QUESTION}
            showLabel
          />
          {IS_DEV && (
            <p className={styles.devBadge}>⚠️ DEV MODE：每題 30 秒</p>
          )}
        </div>
      </div>
    </main>
  )
}
