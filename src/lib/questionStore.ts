import { QuestionDoc } from '@/types'
import { MOCK_QUESTIONS, MOCK_ESSAY_QUESTIONS } from '@/lib/mockData'

const QUESTIONS_STORAGE_KEY = 'cs_game_admin_questions'

// 預設題庫
const DEFAULT_QUESTIONS: QuestionDoc[] = [...MOCK_QUESTIONS, ...MOCK_ESSAY_QUESTIONS]

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
