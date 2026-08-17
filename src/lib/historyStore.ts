// ── Exam History Store — 本地歷次成績與排行榜資料庫（模擬 Firestore） ──────────
import { ExamSession, EssayExamSession } from './examSession'

export interface ExamHistoryItem {
  id: string
  mode: 'quiz' | 'essay'
  displayName: string
  score: number          // 得分 (0-100)
  maxScore: number       // 100
  passed: boolean        // score >= 90
  status: 'submitted' | 'graded'
  date: string           // YYYY-MM-DD HH:mm
  details?: ExamSession | EssayExamSession
}

const HISTORY_STORAGE_KEY = 'cs_game_history_list'

// 預設歷史紀錄（潔淨狀態，無假資料）
const DEFAULT_MOCK_HISTORY: ExamHistoryItem[] = []

/**
 * 取得全部歷史成績列表
 */
export function getStoredHistory(): ExamHistoryItem[] {
  if (typeof window === 'undefined') return DEFAULT_MOCK_HISTORY
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_HISTORY))
      return DEFAULT_MOCK_HISTORY
    }
    return JSON.parse(raw) as ExamHistoryItem[]
  } catch {
    return DEFAULT_MOCK_HISTORY
  }
}

/**
 * 新增一筆考試歷史紀錄 (自動去重比對 ID)
 */
export function addHistoryRecord(item: ExamHistoryItem): ExamHistoryItem[] {
  const current = getStoredHistory()
  const filtered = current.filter(h => h.id !== item.id)
  const updated = [item, ...filtered]
  if (typeof window !== 'undefined') {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated))
  }
  return updated
}

/**
 * 取得排行榜（綜合模式最高分 Top 10）
 * 方案 A：僅採計已完成主管批改 (status === 'graded') 的考卷
 */
export function getQuizLeaderboard(): ExamHistoryItem[] {
  const history = getStoredHistory()
  const quizItems = history.filter(h => h.mode === 'quiz' && h.status === 'graded')
  return quizItems.sort((a, b) => b.score - a.score).slice(0, 10)
}

/**
 * 取得排行榜（申論模式最高分/通過者 Top 10）
 */
export function getEssayLeaderboard(): ExamHistoryItem[] {
  const history = getStoredHistory()
  const essayItems = history.filter(h => h.mode === 'essay' && h.status === 'graded')
  return essayItems.sort((a, b) => b.score - a.score).slice(0, 10)
}
