import { QuestionDoc } from '@/types'
import { MOCK_QUESTIONS, MOCK_ESSAY_QUESTIONS } from '@/lib/mockData'

const QUESTIONS_STORAGE_KEY = 'cs_game_admin_questions'

// 預設 Demo 題庫（供測試與未上傳 Excel 前備用）
const DEMO_QUESTIONS: QuestionDoc[] = [
  {
    id: 'q-demo-01',
    type: 'choice',
    difficulty: 'basic',
    context: '客戶進線詢問帳號登入問題',
    content: '當客戶忘記密碼且無法存取註冊 Email 時，標準驗證流程為何？',
    options: {
      A: '請客戶提供身分證字號與最後一次消費紀錄',
      B: '直接協助客戶變更 Email',
      C: '告知客戶無法處理並掛斷',
      D: '將密碼發送到任一指定手機號碼',
    },
    answer: 'A',
    explanation: '基於資安規範，需通過第二因子個人資料與交易紀錄雙重核對。',
    enabled: true,
    sourceId: 'demo-01',
    syncedAt: new Date(),
  },
  {
    id: 'q-demo-02',
    type: 'choice',
    difficulty: 'medium',
    context: '線上刷卡失敗情境',
    content: '客戶反映刷卡失敗顯示錯誤碼 E3001，主要可能原因為何？',
    options: {
      A: '伺服器維護中',
      B: '發卡銀行拒絕交易（額度不足或跨國交易未開通）',
      C: '網路斷線',
      D: '系統格式錯誤',
    },
    answer: 'B',
    explanation: 'E3001 為發卡行拒絕交易代碼。',
    enabled: true,
    sourceId: 'demo-02',
    syncedAt: new Date(),
  },
  {
    id: 'q-demo-03',
    type: 'qa',
    difficulty: 'medium',
    context: '退費政策應對情境',
    content: '請簡述當客戶購買產品超過 7 天鑑賞期，但因特殊理由堅持要求全額退費時的標準處置應對原則。',
    answer: '先同理客戶心情，說明公司規範政策，並嘗試爭取替代補償方案（如延期或點數回饋）。',
    explanation: '著重於客戶情緒安撫、條款說明與彈性補償。',
    enabled: true,
    sourceId: 'demo-03',
    syncedAt: new Date(),
  },
  {
    id: 'eq-demo-01',
    type: 'essay',
    difficulty: 'advanced',
    context: '遭遇客訴與重大系統異常通報處理',
    content: '假設今日平台遭遇重大系統連線中斷，導致大量客戶進線質疑與抱怨。請撰寫一份客服標準應答指南與通報 SOP。',
    answer: '包含同理心應答、現況告知、工程團隊通報流程與進度關懷追蹤。',
    explanation: '評估客服綜合同理心、緊急應變與SOP遵循能力。',
    enabled: true,
    sourceId: 'demo-eq-01',
    syncedAt: new Date(),
  },
]

const DEFAULT_QUESTIONS: QuestionDoc[] = [...MOCK_QUESTIONS, ...MOCK_ESSAY_QUESTIONS, ...DEMO_QUESTIONS]

/**
 * 取得目前所有的題目列表 (SessionStorage + fallback mock)
 */
export function getStoredQuestions(): QuestionDoc[] {
  if (typeof window === 'undefined') return DEFAULT_QUESTIONS
  try {
    const raw = sessionStorage.getItem(QUESTIONS_STORAGE_KEY)
    if (!raw) {
      sessionStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(DEFAULT_QUESTIONS))
      return DEFAULT_QUESTIONS
    }
    const parsed = JSON.parse(raw)
    return parsed.map((q: any) => ({
      ...q,
      syncedAt: q.syncedAt ? new Date(q.syncedAt) : new Date()
    }))
  } catch (e) {
    console.error('Failed to load questions from sessionStorage', e)
    return DEFAULT_QUESTIONS
  }
}

/**
 * 儲存題目列表
 */
export function saveStoredQuestions(questions: QuestionDoc[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(questions))
  } catch (e) {
    console.error('Failed to save questions to sessionStorage', e)
  }
}

/**
 * 切換單一題目的啟用/停用 (Toggle enabled)
 */
export function toggleQuestionEnabled(id: string): QuestionDoc[] {
  const list = getStoredQuestions()
  const updated = list.map(q => q.id === id ? { ...q, enabled: !q.enabled } : q)
  saveStoredQuestions(updated)
  return updated
}

/**
 * 新增或修改單一題目 (Upsert)
 */
export function saveSingleQuestion(question: QuestionDoc): QuestionDoc[] {
  const list = getStoredQuestions()
  const index = list.findIndex(q => q.id === question.id)
  let updated: QuestionDoc[]
  if (index >= 0) {
    updated = [...list]
    updated[index] = { ...question, syncedAt: new Date() }
  } else {
    updated = [{ ...question, syncedAt: new Date() }, ...list]
  }
  saveStoredQuestions(updated)
  return updated
}

/**
 * 刪除題目 (軟刪除：設定 enabled=false)
 */
export function deleteQuestionSoft(id: string): QuestionDoc[] {
  const list = getStoredQuestions()
  const updated = list.map(q => q.id === id ? { ...q, enabled: false } : q)
  saveStoredQuestions(updated)
  return updated
}

/**
 * 批量匯入 Excel 解析出的資料
 * @param parsedRows 解析後的 JSON 列
 * @param mode 'append' (追加) | 'upsert' (更新既有/覆蓋)
 */
export function importQuestionsFromExcel(
  parsedRows: any[],
  mode: 'append' | 'upsert'
): { updatedList: QuestionDoc[]; addedCount: number; updatedCount: number; errorCount: number } {
  const currentList = getStoredQuestions()
  // 建立以 ID 以及以 (content + type) 為 key 的比對 Map
  const existingIdMap = new Map(currentList.map(q => [q.id, q]))
  const existingContentMap = new Map(currentList.map(q => [`${q.type}__${q.content.trim()}`, q]))

  let addedCount = 0
  let updatedCount = 0
  let errorCount = 0

  const newQuestions: QuestionDoc[] = []

  parsedRows.forEach((row, idx) => {
    // 相容中文與英文欄位名
    const rawType = (row['題型 (type)'] || row['type'] || '').toString().toLowerCase().trim()
    const rawDiff = (row['難易度 (difficulty)'] || row['difficulty'] || '').toString().toLowerCase().trim()
    const context = (row['情境描述 (context)'] || row['context'] || '').toString().trim()
    const content = (row['題目主文 (content)'] || row['content'] || '').toString().trim()
    const optionA = (row['選項A (optionA)'] || row['optionA'] || '').toString().trim()
    const optionB = (row['選項B (optionB)'] || row['optionB'] || '').toString().trim()
    const optionC = (row['選項C (optionC)'] || row['optionC'] || '').toString().trim()
    const optionD = (row['選項D (optionD)'] || row['optionD'] || '').toString().trim()
    const answer = (row['答案 (answer)'] || row['answer'] || '').toString().trim()
    const explanation = (row['解析 (explanation)'] || row['explanation'] || '').toString().trim()
    const rawEnabled = (row['是否啟用 (enabled)'] || row['enabled'] || 'Y').toString().toUpperCase().trim()
    const existingId = (row['id'] || row['questionId'] || row['sourceId'] || '').toString().trim()

    // 基本校驗
    if (!content || !['choice', 'qa', 'essay'].includes(rawType)) {
      errorCount++
      return
    }

    const type = rawType as QuestionDoc['type']
    const difficulty = (['basic', 'medium', 'advanced'].includes(rawDiff) ? rawDiff : 'medium') as QuestionDoc['difficulty']
    const enabled = rawEnabled !== 'N' && rawEnabled !== 'FALSE'

    let targetId = ''
    let isUpdate = false

    // 優先以 ID 比對；無 ID 時若為 Upsert 模式，則以「題型__題目內容」嘗試比對舊題
    const contentKey = `${type}__${content}`
    if (mode === 'upsert') {
      if (existingId && existingIdMap.has(existingId)) {
        targetId = existingId
        isUpdate = true
      } else if (existingContentMap.has(contentKey)) {
        targetId = existingContentMap.get(contentKey)!.id
        isUpdate = true
      }
    }

    if (!targetId) {
      targetId = `q-imp-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`
    }

    const qDoc: QuestionDoc = {
      id: targetId,
      type,
      difficulty,
      context,
      content,
      enabled,
      sourceId: existingId || targetId,
      syncedAt: new Date(),
      answer,
      explanation,
    }

    if (type === 'choice') {
      qDoc.options = {
        A: optionA || 'A',
        B: optionB || 'B',
        C: optionC || 'C',
        D: optionD || 'D',
      }
    }

    if (isUpdate) {
      existingIdMap.set(targetId, qDoc)
      updatedCount++
    } else {
      newQuestions.push(qDoc)
      addedCount++
    }
  })

  let finalList: QuestionDoc[] = []
  if (mode === 'upsert') {
    finalList = Array.from(existingIdMap.values())
    if (newQuestions.length > 0) {
      finalList = [...newQuestions, ...finalList]
    }
  } else {
    finalList = [...newQuestions, ...currentList]
  }

  saveStoredQuestions(finalList)
  return { updatedList: finalList, addedCount, updatedCount, errorCount }
}

/**
 * 重設回預設假題庫
 */
export function resetQuestionsToDefault(): QuestionDoc[] {
  saveStoredQuestions(DEFAULT_QUESTIONS)
  return DEFAULT_QUESTIONS
}
