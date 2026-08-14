// ── Exam Session — 模擬 Firestore 的 sessionStorage 讀寫 ──────────
// 待接真實 Firebase 後，將這些函式替換為 Firestore 呼叫即可

export interface ExamSessionAnswer {
  questionId: string
  userAnswer: string   // 選擇題: 'A'/'B'/'C'/'D'；問答題: 文字內容
  isCorrect?: boolean  // 選擇題自動判定；問答題 undefined（待主管批改）
  timeExpired: boolean
  questionDoc?: any    // 儲存當時作答的完整題目資訊
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

// ────────────────────────────────────────────────────────────────
// 申論模式 Session
// ────────────────────────────────────────────────────────────────

export interface EssayExamSession {
  examId: string
  mode: 'essay'
  displayName: string
  status: 'submitted' | 'graded'  // 申論不即時評分，預設 submitted
  submittedAt: string             // ISO string
  answers: {
    questionId: string
    userAnswer: string   // 申論文字
    timeExpired: boolean
    // 主管批改後由後端寫入，目前假資料直接留空
    score?: number       // 0-10，申論每題满分 10
    comment?: string     // 主管評語
  }[]
}

const ESSAY_SESSION_KEY = 'cs_essay_session'

/** 模擬㌀同時只能一場申論㌁的鎖（localStorage 保存，關頁簽不會消失） */
const ESSAY_LOCK_KEY = 'cs_essay_lock'

export interface EssayLock {
  examId: string
  startedAt: string
}

/** 檢查是否有進行中的申論時場 */
export function getEssayLock(): EssayLock | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(ESSAY_LOCK_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as EssayLock } catch { return null }
}

/** 鎖住申論時場（開始考試時呼叫） */
export function setEssayLock(examId: string): void {
  if (typeof window === 'undefined') return
  const lock: EssayLock = { examId, startedAt: new Date().toISOString() }
  localStorage.setItem(ESSAY_LOCK_KEY, JSON.stringify(lock))
}

/** 解除鎖定（對應「主管完成批改」後才能再考，模擬用） */
export function clearEssayLock(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ESSAY_LOCK_KEY)
}

/** 儲存申論考試結果 */
export function saveEssaySession(session: EssayExamSession): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(ESSAY_SESSION_KEY, JSON.stringify(session))
}

/** 讀取申論考試結果 */
export function loadEssaySession(examId: string): EssayExamSession | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(ESSAY_SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as EssayExamSession
    if (session.examId !== examId) return null
    return session
  } catch { return null }
}

/** 清除申論考試結果 */
export function clearEssaySession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ESSAY_SESSION_KEY)
}
