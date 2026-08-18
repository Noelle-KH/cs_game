// Exam Store — Firestore exams 雲端考卷集合讀寫服務
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { QuestionDoc } from '@/types'

export interface CloudExamAnswer {
  questionId: string
  userAnswer: string
  isCorrect?: boolean
  score?: number
  feedback?: string
  questionDoc?: QuestionDoc
}

export interface CloudExamDoc {
  id: string
  uid: string
  userEmail: string
  displayName: string
  mode: 'quiz' | 'essay'
  status: 'in_progress' | 'submitted' | 'graded'
  score: number
  choiceScore: number
  essayScore: number
  totalPossibleScore: number
  passed: boolean
  answers: CloudExamAnswer[]
  startedAt: any
  submittedAt?: any
  gradedAt?: any
  gradedBy?: string
}

const EXAMS_COLLECTION = 'exams'

/**
 * 建立新考試 Session 於 Firestore exams 集合
 */
export async function createExamFirestore(params: {
  id: string
  uid: string
  userEmail: string
  displayName: string
  mode: 'quiz' | 'essay'
  answers: CloudExamAnswer[]
}): Promise<CloudExamDoc> {
  const ref = doc(db, EXAMS_COLLECTION, params.id)
  const newExam: Omit<CloudExamDoc, 'startedAt'> & { startedAt: any } = {
    id: params.id,
    uid: params.uid,
    userEmail: params.userEmail,
    displayName: params.displayName,
    mode: params.mode,
    status: 'in_progress',
    score: 0,
    choiceScore: 0,
    essayScore: 0,
    totalPossibleScore: 100,
    passed: false,
    answers: params.answers,
    startedAt: serverTimestamp(),
  }

  await setDoc(ref, newExam)
  return {
    ...newExam,
    startedAt: new Date(),
  } as CloudExamDoc
}

/**
 * 取得單筆考卷 Session
 */
export async function getExamByIdFirestore(examId: string): Promise<CloudExamDoc | null> {
  try {
    const ref = doc(db, EXAMS_COLLECTION, examId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      ...data,
      startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : new Date(),
      submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : null,
      gradedAt: data.gradedAt?.toDate ? data.gradedAt.toDate() : null,
    } as CloudExamDoc
  } catch (e) {
    console.error('Failed to get exam by id from Firestore:', e)
    return null
  }
}

/**
 * 考生提交作答至 Firestore (將 status 改為 submitted)
 */
export async function submitExamFirestore(params: {
  examId: string
  answers: CloudExamAnswer[]
  choiceScore: number
  essayScore?: number
  isFullyAutoGraded?: boolean
  passed?: boolean
}): Promise<void> {
  const ref = doc(db, EXAMS_COLLECTION, params.examId)
  const isAutoPass = params.isFullyAutoGraded ? (params.choiceScore >= 90) : false
  const updatedStatus = params.isFullyAutoGraded ? 'graded' : 'submitted'

  // 清理 Firestore 不支援的 undefined 欄位（例如問答題未批改前的 isCorrect: undefined）
  const sanitizedAnswers = params.answers.map((a) => {
    const cleanObj: Record<string, any> = {
      questionId: a.questionId,
      userAnswer: a.userAnswer,
    }
    if (a.isCorrect !== undefined) cleanObj.isCorrect = a.isCorrect
    if (a.score !== undefined) cleanObj.score = a.score
    if (a.feedback !== undefined) cleanObj.feedback = a.feedback
    if (a.questionDoc !== undefined) {
      // 確保 questionDoc 內沒有 undefined 欄位
      const cleanDoc: Record<string, any> = {}
      Object.entries(a.questionDoc).forEach(([k, v]) => {
        if (v !== undefined) cleanDoc[k] = v
      })
      cleanObj.questionDoc = cleanDoc
    }
    return cleanObj
  })

  await updateDoc(ref, {
    answers: sanitizedAnswers,
    choiceScore: params.choiceScore,
    essayScore: params.essayScore || 0,
    score: params.choiceScore + (params.essayScore || 0),
    passed: isAutoPass,
    status: updatedStatus,
    submittedAt: serverTimestamp(),
  })
}

/**
 * 主管線上提交批改
 */
export async function gradeExamFirestore(params: {
  examId: string
  answers: CloudExamAnswer[]
  essayScore: number
  choiceScore: number
  gradedBy: string
  passingThreshold?: number
}): Promise<number> {
  const threshold = params.passingThreshold || 90
  const totalScore = params.choiceScore + params.essayScore
  const passed = totalScore >= threshold

  const sanitizedAnswers = params.answers.map((a) => {
    const cleanObj: Record<string, any> = {
      questionId: a.questionId,
      userAnswer: a.userAnswer,
    }
    if (a.isCorrect !== undefined) cleanObj.isCorrect = a.isCorrect
    if (a.score !== undefined) cleanObj.score = a.score
    if (a.feedback !== undefined) cleanObj.feedback = a.feedback
    if (a.questionDoc !== undefined) {
      const cleanDoc: Record<string, any> = {}
      Object.entries(a.questionDoc).forEach(([k, v]) => {
        if (v !== undefined) cleanDoc[k] = v
      })
      cleanObj.questionDoc = cleanDoc
    }
    return cleanObj
  })

  const ref = doc(db, EXAMS_COLLECTION, params.examId)
  await updateDoc(ref, {
    answers: sanitizedAnswers,
    essayScore: params.essayScore,
    score: totalScore,
    passed,
    status: 'graded',
    gradedBy: params.gradedBy,
    gradedAt: serverTimestamp(),
  })

  return totalScore
}

/**
 * 查詢特定使用者的所有雲端考卷歷史
 */
export async function getUserExamsFirestore(uid: string): Promise<CloudExamDoc[]> {
  try {
    const q = query(
      collection(db, EXAMS_COLLECTION),
      where('uid', '==', uid)
    )
    const snap = await getDocs(q)
    const list: CloudExamDoc[] = []
    snap.forEach((docSnap) => {
      const data = docSnap.data()
      // 排除尚未交卷作廢的中途離開考卷 (status === 'in_progress')
      if (data.status && data.status !== 'in_progress') {
        list.push({
          ...data,
          startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : new Date(),
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : null,
          gradedAt: data.gradedAt?.toDate ? data.gradedAt.toDate() : null,
        } as CloudExamDoc)
      }
    })
    // 依時間排序 (最新在最前)
    return list.sort((a, b) => (b.startedAt?.getTime?.() || 0) - (a.startedAt?.getTime?.() || 0))
  } catch (e) {
    console.error('Failed to get user exams from Firestore:', e)
    return []
  }
}

/**
 * 查詢所有待批改考卷 (status === 'submitted')
 */
export async function getPendingExamsFirestore(): Promise<CloudExamDoc[]> {
  try {
    const q = query(
      collection(db, EXAMS_COLLECTION),
      where('status', '==', 'submitted')
    )
    const snap = await getDocs(q)
    const list: CloudExamDoc[] = []
    snap.forEach((docSnap) => {
      const data = docSnap.data()
      list.push({
        ...data,
        startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : new Date(),
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : null,
      } as CloudExamDoc)
    })
    return list
  } catch (e) {
    console.error('Failed to get pending exams from Firestore:', e)
    return []
  }
}
