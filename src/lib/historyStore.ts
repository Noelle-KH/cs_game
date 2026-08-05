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

// 預設模擬排行榜歷史紀錄（當使用者尚未有任何考試時展示）
const DEFAULT_MOCK_HISTORY: ExamHistoryItem[] = [
  {
    id: 'hist-001',
    mode: 'quiz',
    displayName: '客服大師 艾倫',
    score: 95,
    maxScore: 100,
    passed: true,
    status: 'graded',
    date: '2026-08-04 14:20',
  },
  {
    id: 'hist-002',
    mode: 'quiz',
    displayName: '資深客服 貝蒂',
    score: 90,
    maxScore: 100,
    passed: true,
    status: 'graded',
    date: '2026-08-04 11:15',
  },
  {
    id: 'hist-003',
    mode: 'essay',
    displayName: '冒險勇者 查理',
    score: 92,
    maxScore: 100,
    passed: true,
    status: 'graded',
    date: '2026-08-03 16:45',
  },
  {
    id: 'hist-004',
    mode: 'quiz',
    displayName: '新人客服 戴安娜',
    score: 85,
    maxScore: 100,
    passed: false,
    status: 'graded',
    date: '2026-08-03 09:30',
  },
  {
    id: 'hist-005',
    mode: 'essay',
    displayName: '客服戰士 查理',
    score: 88,
    maxScore: 100,
    passed: false,
    status: 'graded',
    date: '2026-08-02 18:10',
  },
]

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
 */
export function getQuizLeaderboard(): ExamHistoryItem[] {
  const history = getStoredHistory()
  const quizItems = history.filter(h => h.mode === 'quiz')
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
