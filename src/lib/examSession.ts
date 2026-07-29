// ── Exam Session — 模擬 Firestore 的 sessionStorage 讀寫 ──────────
// 待接真實 Firebase 後，將這些函式替換為 Firestore 呼叫即可

export interface ExamSessionAnswer {
  questionId: string
  userAnswer: string   // 選擇題: 'A'/'B'/'C'/'D'；問答題: 文字內容
  isCorrect?: boolean  // 選擇題自動判定；問答題 undefined（待主管批改）
  timeExpired: boolean
}

export interface ExamSession {
  examId: string
  mode: 'quiz' | 'essay'
  displayName: string
  score: number         // 自動計算分數（問答題按比例估算）
  maxScore: number      // 100
  passed: boolean       // score >= 90
  correctCount: number  // 選擇題答對題數
  totalChoice: number   // 選擇題總題數
  totalQa: number       // 問答題總題數
  expiredCount: number  // 超時題數
  answeredCount: number // 已作答題數
  answers: ExamSessionAnswer[]
  submittedAt: string   // ISO string
}

const SESSION_KEY = 'cs_exam_session'

/** 儲存考試結果（模擬 Firestore write） */
export function saveExamSession(session: ExamSession): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/** 讀取考試結果（模擬 Firestore read） */
export function loadExamSession(examId: string): ExamSession | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as ExamSession
    // 若 examId 不符（例如直接進結果頁），回傳 null
    if (session.examId !== examId) return null
    return session
  } catch {
    return null
  }
}

/** 清除考試結果 */
export function clearExamSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}
