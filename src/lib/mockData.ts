// ── 共用題庫（已清空假資料，準備導入出版真實題庫） ──────────────────────────
import { QuestionDoc } from '@/types'

export const MOCK_QUESTIONS: QuestionDoc[] = []

export const MOCK_QUESTIONS_MAP = Object.fromEntries(
  MOCK_QUESTIONS.map((q) => [q.id, q])
)

// ── 申論模式題庫（已清空假資料，準備導入出版真實題庫） ────────────────────────
export const MOCK_ESSAY_QUESTIONS: QuestionDoc[] = []

export const MOCK_ESSAY_QUESTIONS_MAP = Object.fromEntries(
  MOCK_ESSAY_QUESTIONS.map((q) => [q.id, q])
)

