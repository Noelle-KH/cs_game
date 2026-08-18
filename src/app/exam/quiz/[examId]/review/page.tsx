'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadExamSession, ExamSession, ExamSessionAnswer } from '@/lib/examSession'
import { getExamByIdFirestore } from '@/lib/examStore'
import { getFirestoreQuestions } from '@/lib/questionStore'
import { QuestionDoc } from '@/types'
import styles from './page.module.css'

const IS_DEV = process.env.NODE_ENV === 'development'

type ReviewFilter = 'all' | 'wrong' | 'expired'

export default function ReviewPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = use(params)
  const router = useRouter()
  const [session, setSession] = useState<ExamSession | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [cloudQuestionsList, setCloudQuestionsList] = useState<QuestionDoc[]>([])
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    async function loadReviewData() {
      setLoadingSession(true)
      // 1. 優先試圖從 Firestore 加載
      const cloudExam = await getExamByIdFirestore(examId)
      if (cloudExam) {
        setSession({
          examId: cloudExam.id,
          mode: cloudExam.mode as 'quiz',
          displayName: cloudExam.displayName,
          status: cloudExam.status,
          score: cloudExam.score,
          choiceScore: cloudExam.choiceScore,
          maxScore: 100,
          passed: cloudExam.passed,
          correctCount: cloudExam.answers.filter(a => a.isCorrect === true).length,
          totalChoice: cloudExam.answers.filter(a => a.questionDoc?.type === 'choice').length,
          totalQa: cloudExam.answers.filter(a => a.questionDoc?.type === 'qa').length,
          expiredCount: 0,
          answeredCount: cloudExam.answers.length,
          answers: cloudExam.answers.map(a => ({
            questionId: a.questionId,
            userAnswer: a.userAnswer,
            isCorrect: a.isCorrect,
            score: a.score,
            comment: a.feedback,
            timeExpired: false,
            questionDoc: a.questionDoc,
          })),
          submittedAt: cloudExam.submittedAt?.toISOString ? cloudExam.submittedAt.toISOString() : new Date().toISOString(),
        })
      } else {
        // Fallback: 嘗試讀取本地 sessionStorage
        const localData = loadExamSession(examId)
        if (localData) {
          setSession(localData)
        }
      }

      // 加載雲端題庫集合供備案比對
      const allCloudQs = await getFirestoreQuestions()
      setCloudQuestionsList(allCloudQs)
      setLoadingSession(false)
    }

    loadReviewData()
  }, [examId])

  if (loadingSession || !session) {
    return (
      <div className={styles.loading}>
        <p className="pixel-title animate-float">載入雲端考卷與錯題中...</p>
      </div>
    )
  }

  const cloudMap = new Map(cloudQuestionsList.map(q => [q.id, q]))

  // 組合：answer record + question doc（優先從 ans.questionDoc 讀取，次取 ID Match，再次取內容 Match）
  const reviewed = session.answers
    .map((ans, idx) => {
      let qDoc: QuestionDoc | undefined = ans.questionDoc
      if (!qDoc) {
        qDoc = cloudMap.get(ans.questionId) || cloudQuestionsList.find(q => q.content === ans.questionId) || cloudQuestionsList[idx]
      }
      return {
        ans,
        q: qDoc as QuestionDoc | undefined,
      }
    })
    .filter((item) => item.q !== undefined) as { ans: ExamSessionAnswer; q: QuestionDoc }[]

  // 篩選（包含選擇題答錯與問答題未獲滿分者）
  const filtered = reviewed.filter((item) => {
    if (filter === 'wrong') {
      // 只要不是答對 (isCorrect !== true) 或者是超時/答錯，均進入錯題
      return item.ans.isCorrect === false || (item.q.type === 'choice' && item.ans.isCorrect !== true)
    }
    if (filter === 'expired') return item.ans.timeExpired
    return true
  })

  const safeIdx = Math.min(selectedIdx, filtered.length - 1)
  const current = filtered[safeIdx]

  const isGraded = session.status === 'graded'

  function getStatusLabel(item: { ans: ExamSessionAnswer; q: QuestionDoc }) {
    if (item.ans.timeExpired) return { text: '⏱️ 超時', cls: styles.statusExpired }
    if (item.q.type === 'qa') {
      if (!isGraded && item.ans.score === undefined) {
        return { text: '⏳ 待主管審核', cls: styles.statusQa }
      }
      if (item.ans.score !== undefined && item.ans.score > 0) {
        return { text: '✅ 已評分', cls: styles.statusCorrect }
      }
      return { text: '✏️ 問答', cls: styles.statusQa }
    }
    if (item.ans.isCorrect === true) return { text: '✅ 答對', cls: styles.statusCorrect }
    if (item.ans.isCorrect === false) return { text: '❌ 答錯', cls: styles.statusWrong }
    return { text: '❌ 答錯', cls: styles.statusWrong }
  }

  return (
    <main className={`pixel-bg ${styles.main}`}>
      {/* 頂部 Navbar */}
      <nav className={styles.navbar}>
        <button
          id="btn-back-result"
          className={`btn-pixel btn-ghost ${styles.backBtn}`}
          onClick={() => router.push(`/exam/quiz/${examId}/result`)}
        >
          ← 返回成績
        </button>
        <span className={`pixel-title ${styles.navTitle}`}>🔍 錯題回顧</span>
        <div className={styles.filterGroup}>
          {(['all', 'wrong', 'expired'] as ReviewFilter[]).map((f) => (
            <button
              key={f}
              id={`btn-filter-${f}`}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => { setFilter(f); setSelectedIdx(0) }}
            >
              {f === 'all' ? `全部 (${reviewed.length})` : f === 'wrong' ? `答錯 (${reviewed.filter(i => i.ans.isCorrect === false).length})` : `超時 (${reviewed.filter(i => i.ans.timeExpired).length})`}
            </button>
          ))}
        </div>
      </nav>

      {filtered.length === 0 ? (
        <div className={styles.emptyWrap}>
          <p className="pixel-title">🎉 這個分類沒有記錄！</p>
          <p className={styles.emptyHint}>
            {filter === 'wrong' ? '選擇題全部答對，太厲害了！' : '沒有超時的題目。'}
          </p>
          <button className="btn-pixel btn-ghost" onClick={() => setFilter('all')}>
            查看全部
          </button>
        </div>
      ) : (
        <div className={styles.layout}>
          {/* 左欄：題目列表 */}
          <aside className={`pixel-panel ${styles.questionList}`}>
            <h2 className={`pixel-title ${styles.listTitle}`}>題目列表</h2>
            <div className={styles.listScroll}>
              {filtered.map((item, idx) => {
                const { text, cls } = getStatusLabel(item)
                const qNum = reviewed.indexOf(item) + 1
                return (
                  <button
                    key={item.q.id}
                    id={`btn-q-${idx}`}
                    className={`${styles.listItem} ${idx === safeIdx ? styles.listItemActive : ''}`}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    <span className={styles.listNum}>Q{qNum}</span>
                    <span className={styles.listPreview}>
                      {item.q.content.slice(0, 20)}...
                    </span>
                    <span className={`${styles.listStatus} ${cls}`}>{text}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* 右欄：題目詳情 */}
          {current && (
            <section className={styles.detailWrap}>
              <div className={`pixel-panel ${styles.detailCard}`}>
                {/* 情境 */}
                {current.q.context && (
                  <div className={styles.contextBox}>
                    <span className={styles.contextLabel}>📋 情境</span>
                    <p className={styles.contextText}>{current.q.context}</p>
                  </div>
                )}

                {/* 題目 */}
                <p className={styles.questionText}>{current.q.content}</p>

                {/* 選擇題：選項 */}
                {current.q.type === 'choice' && current.q.options && (
                  <div className={styles.choiceList}>
                    {(Object.entries(current.q.options) as [string, string][]).map(([key, text]) => {
                      const isUserAnswer = current.ans.userAnswer === key
                      const isCorrectAnswer = current.q.answer === key
                      return (
                        <div
                          key={key}
                          className={`${styles.choiceItem}
                            ${isCorrectAnswer ? styles.choiceCorrect : ''}
                            ${isUserAnswer && !isCorrectAnswer ? styles.choiceWrong : ''}
                          `}
                        >
                          <span className={styles.choiceKey}>{key}</span>
                          <span className={styles.choiceText}>{text}</span>
                          {isCorrectAnswer && <span className={styles.choiceMark}>✅ 正解</span>}
                          {isUserAnswer && !isCorrectAnswer && <span className={styles.choiceMark}>❌ 你的答案</span>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 問答題：我的作答 + 審核狀態 / 參考答案 & 評分 */}
                {current.q.type === 'qa' && (
                  <div className={styles.qaSection}>
                    <div className={styles.qaBlock}>
                      <span className={styles.qaBlockLabel}>✏️ 你的作答</span>
                      <p className={`${styles.qaContent} ${!current.ans.userAnswer ? styles.qaEmpty : ''}`}>
                        {current.ans.userAnswer || (current.ans.timeExpired ? '（超時未作答）' : '（未作答）')}
                      </p>
                    </div>

                    {!isGraded && current.ans.score === undefined ? (
                      <div className={styles.qaBlock} style={{ background: 'rgba(91, 164, 207, 0.08)', borderLeft: '4px solid #4a6fa5' }}>
                        <span className={styles.qaBlockLabel} style={{ color: '#63b3ed' }}>⏳ 主管審核狀態</span>
                        <p className={styles.qaContent} style={{ color: '#cbd5e0' }}>
                          問答題已提交，等待主管於後台審核與提供指導評語中。批改完成前暫不公開參考答案。
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className={`${styles.qaBlock} ${styles.qaRefBlock}`}>
                          <span className={styles.qaBlockLabel}>📖 參考答案</span>
                          <p className={styles.qaContent}>{current.q.answer || '（無參考標準答案）'}</p>
                        </div>

                        {current.ans.score !== undefined && (
                          <div className={styles.qaBlock} style={{ background: 'rgba(76, 175, 80, 0.08)', borderLeft: '4px solid var(--color-success)' }}>
                            <span className={styles.qaBlockLabel} style={{ color: 'var(--color-success)' }}>
                              🎯 主管評分：{current.ans.score} 分
                            </span>
                            {current.ans.comment && (
                              <p className={styles.qaContent} style={{ marginTop: 6, color: '#e2e8f0' }}>
                                💬 指導評語：{current.ans.comment}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 解析 */}
                {current.q.explanation && (
                  <div className={styles.explanationBox}>
                    <span className={styles.explanationLabel}>💡 解析</span>
                    <p className={styles.explanationText}>{current.q.explanation}</p>
                  </div>
                )}
              </div>

              {/* 前後翻頁 */}
              <div className={styles.navBtns}>
                <button
                  id="btn-prev-q"
                  className="btn-pixel btn-ghost"
                  disabled={safeIdx === 0}
                  onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
                >
                  ← 上一題
                </button>
                <span className={styles.navCount}>
                  {safeIdx + 1} / {filtered.length}
                </span>
                <button
                  id="btn-next-q"
                  className="btn-pixel btn-ghost"
                  disabled={safeIdx >= filtered.length - 1}
                  onClick={() => setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1))}
                >
                  下一題 →
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

// ── DEV fallback session ─────────────────────────────────────────
function MOCK_REVIEW_SESSION(examId: string): ExamSession {
  return {
    examId,
    mode: 'quiz',
    displayName: '開發測試員',
    status: 'submitted',
    score: 72,
    choiceScore: 60,
    maxScore: 100,
    passed: false,
    correctCount: 4,
    totalChoice: 5,
    totalQa: 3,
    expiredCount: 1,
    answeredCount: 7,
    answers: [
      { questionId: 'q-001', userAnswer: 'B', isCorrect: true,  timeExpired: false },
      { questionId: 'q-002', userAnswer: 'A', isCorrect: false, timeExpired: false },
      { questionId: 'q-003', userAnswer: 'C', isCorrect: true,  timeExpired: false },
      { questionId: 'q-004', userAnswer: '應先同理客戶，承諾回覆時間，並記錄案件細節。', isCorrect: undefined, timeExpired: false },
      { questionId: 'q-005', userAnswer: 'B', isCorrect: true,  timeExpired: false },
      { questionId: 'q-006', userAnswer: '',  isCorrect: undefined, timeExpired: true  },
      { questionId: 'q-007', userAnswer: 'B', isCorrect: true,  timeExpired: false },
      { questionId: 'q-008', userAnswer: '應評估案件能否暫停，分流客戶並主動告知等待時間。', isCorrect: undefined, timeExpired: false },
    ],
    submittedAt: new Date().toISOString(),
  }
}
