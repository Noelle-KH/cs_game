import { QuestionDoc } from '@/types'
import { db } from '@/lib/firebase/client'
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'

const QUESTIONS_STORAGE_KEY = 'cs_game_admin_questions'
const QUESTIONS_COLLECTION = 'questions'

/**
 * 從 Firestore 雲端讀取所有題目列表（同步更新 sessionStorage 快照）
 */
export async function getFirestoreQuestions(): Promise<QuestionDoc[]> {
  try {
    const qSnap = await getDocs(collection(db, QUESTIONS_COLLECTION))
    const list: QuestionDoc[] = []
    qSnap.forEach(dSnap => {
      const data = dSnap.data()
      list.push({
        id: dSnap.id,
        type: data.type,
        difficulty: data.difficulty,
        context: data.context || '',
        content: data.content || '',
        options: data.options,
        answer: data.answer || '',
        explanation: data.explanation || '',
        enabled: data.enabled ?? true,
        sourceId: data.sourceId || dSnap.id,
        syncedAt: data.syncedAt?.toDate ? data.syncedAt.toDate() : new Date(),
      })
    })
    // 寫入本機 SessionStorage 快照
    saveStoredQuestions(list)
    return list
  } catch (e: any) {
    console.error('❌ Firestore 雲端讀取失敗 (請檢查網絡與 Firebase Security Rules 權限):', e)
    return getStoredQuestions()
  }
}

/**
 * 取得本機快照題目列表（同步備用）
 */
export function getStoredQuestions(): QuestionDoc[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(QUESTIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed.map((q: any) => ({
      ...q,
      syncedAt: q.syncedAt ? new Date(q.syncedAt) : new Date()
    }))
  } catch (e) {
    return []
  }
}

/**
 * 儲存題目列表至本機 SessionStorage 快照
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
 * 於 Firestore 雲端新增或更新單一題目 (Upsert)
 */
export async function saveSingleQuestionFirestore(question: QuestionDoc): Promise<QuestionDoc[]> {
  try {
    const ref = doc(db, QUESTIONS_COLLECTION, question.id)
    await setDoc(ref, {
      ...question,
      syncedAt: serverTimestamp()
    }, { merge: true })
  } catch (e) {
    console.error('Failed to save question to Firestore:', e)
  }
  // 更新本機與回傳最新清單
  return getFirestoreQuestions()
}

/**
 * 切換單一題目的啟用/停用 (Firestore 雲端與本機同步)
 */
export async function toggleQuestionEnabledFirestore(id: string, currentEnabled: boolean): Promise<QuestionDoc[]> {
  try {
    const ref = doc(db, QUESTIONS_COLLECTION, id)
    await updateDoc(ref, {
      enabled: !currentEnabled,
      syncedAt: serverTimestamp()
    })
  } catch (e) {
    console.error('Failed to toggle question enabled state in Firestore:', e)
  }
  return getFirestoreQuestions()
}

/**
 * 徹底硬刪除題目 (從 Firestore collection 中直接刪除 document)
 */
export async function deleteQuestionHardFirestore(id: string): Promise<QuestionDoc[]> {
  try {
    const ref = doc(db, QUESTIONS_COLLECTION, id)
    await deleteDoc(ref)
  } catch (e) {
    console.error('Failed to delete question from Firestore:', e)
  }
  return getFirestoreQuestions()
}

/**
 * 批量將 Excel 解析的資料分批寫入 Firestore 雲端（單次限制 200 筆避免卡住，並提供進度回饋）
 */
export async function importQuestionsToFirestore(
  parsedRows: any[],
  mode: 'append' | 'upsert',
  onProgress?: (current: number, total: number) => void
): Promise<{ updatedList: QuestionDoc[]; addedCount: number; updatedCount: number; errorCount: number }> {
  const currentList = await getFirestoreQuestions()
  const existingIdMap = new Map(currentList.map(q => [q.id, q]))
  const existingContentMap = new Map(currentList.map(q => [`${q.type}__${q.content.trim()}`, q]))

  let addedCount = 0
  let updatedCount = 0
  let errorCount = 0

  const preparedDocs: { ref: any; data: any; isUpdate: boolean; doc: QuestionDoc }[] = []

  parsedRows.forEach((row, idx) => {
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

    if (!content || !['choice', 'qa', 'essay'].includes(rawType)) {
      errorCount++
      return
    }

    const type = rawType as QuestionDoc['type']
    const difficulty = (['basic', 'medium', 'advanced'].includes(rawDiff) ? rawDiff : 'medium') as QuestionDoc['difficulty']
    const enabled = rawEnabled !== 'N' && rawEnabled !== 'FALSE'

    let targetId = ''
    let isUpdate = false

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
      targetId = existingId || `q-cloud-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`
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

    const docRef = doc(db, QUESTIONS_COLLECTION, targetId)
    preparedDocs.push({
      ref: docRef,
      data: { ...qDoc, syncedAt: serverTimestamp() },
      isUpdate,
      doc: qDoc
    })

    if (isUpdate) updatedCount++
    else addedCount++
  })

  // 每一批次上傳 200 筆 (Firestore Batch 限制最多 500 筆)
  const BATCH_SIZE = 200
  const totalDocs = preparedDocs.length

  for (let i = 0; i < totalDocs; i += BATCH_SIZE) {
    const chunk = preparedDocs.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    chunk.forEach(item => {
      batch.set(item.ref, item.data, { merge: true })
    })

    await batch.commit()
    const currentProgress = Math.min(i + BATCH_SIZE, totalDocs)
    if (onProgress) onProgress(currentProgress, totalDocs)
    console.log(`🚀 已寫入 Firestore 進度: ${currentProgress} / ${totalDocs}`)
  }

  const finalList = await getFirestoreQuestions()
  return { updatedList: finalList, addedCount, updatedCount, errorCount }
}
