// Firestore 資料型別定義
export type UserRole = 'examinee' | 'supervisor' | 'admin'
export type ExamMode = 'quiz' | 'essay'
export type ExamStatus = 'in-progress' | 'submitted' | 'graded'
export type QuestionType = 'choice' | 'qa' | 'essay'
export type Difficulty = 'basic' | 'medium' | 'advanced'

// ── users collection ──────────────────────────────────────────
export interface UserDoc {
  uid: string
  email: string
  displayName: string
  role: UserRole
  createdAt: Date
  lastLoginAt: Date
}

// ── questions collection ───────────────────────────────────────
export interface QuestionDoc {
  id: string
  type: QuestionType
  difficulty: Difficulty
  context: string
  content: string
  options?: {
    A: string
    B: string
    C: string
    D: string
  }
  answer?: string        // 選擇題: A/B/C/D；問答題: 標準答案
  explanation?: string
  enabled: boolean
  sourceId: string
  syncedAt: Date
}

// ── exams collection ──────────────────────────────────────────
export interface AnswerRecord {
  questionId: string
  userAnswer: string
  isCorrect?: boolean     // 選擇 / 問答用
  score?: number          // 申論用（主管評分，0-10）
  comment?: string        // 申論用（主管評語）
  timeExpired: boolean    // 是否因倒數結束自動提交
}

export interface ExamDoc {
  id: string
  uid: string
  mode: ExamMode
  status: ExamStatus
  startedAt: Date
  submittedAt?: Date
  gradedAt?: Date
  totalScore: number
  maxScore: number        // 固定 100
  passed: boolean         // totalScore >= 90
  answers: AnswerRecord[]
}

// ── notifications collection ───────────────────────────────────
export interface NotificationDoc {
  id: string
  uid: string
  type: 'graded'
  examId: string
  read: boolean
  createdAt: Date
}

// ── settings (singleton) ───────────────────────────────────────
export interface SettingsDoc {
  sheetsIdQuestions: string
  sheetsIdResults: string
  passThreshold: number           // 90
  quizQuestionCount: number       // 20
  essayQuestionCount: number      // 10
  quizTimePerQuestion: number     // 300 秒
  essayTimePerQuestion: number    // 600 秒
}
