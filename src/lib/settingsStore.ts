// 系統參數雲端/本地儲存庫 (Settings Store)
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { SettingsDoc } from '@/types'

const SETTINGS_DOC_ID = 'global'

const DEFAULT_SETTINGS: SettingsDoc = {
  sheetsIdQuestions: '',
  sheetsIdResults: '',
  passThreshold: 90,
  quizPassThreshold: 90,
  essayPassThreshold: 90,
  quizQuestionCount: 20,
  essayQuestionCount: 10,
  quizTimePerQuestion: 300,
  choiceTimePerQuestion: 120,
  qaTimePerQuestion: 300,
  essayTimePerQuestion: 600,
}

// 取得系統參數設定（優先自 Cloud Firestore 讀取，若無則降級讀取 localStorage 或預設值）
export async function getSystemSettings(): Promise<SettingsDoc> {
  try {
    const ref = doc(db, 'settings', SETTINGS_DOC_ID)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...snap.data() } as SettingsDoc
    }
  } catch (err) {
    console.warn('Failed to fetch system settings from Firestore, using local fallback:', err)
  }

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('cs_system_settings')
    if (local) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(local) }
      } catch {}
    }
  }

  return DEFAULT_SETTINGS
}

// 儲存系統參數設定
export async function saveSystemSettings(settings: Partial<SettingsDoc>): Promise<void> {
  try {
    const ref = doc(db, 'settings', SETTINGS_DOC_ID)
    await setDoc(ref, settings, { merge: true })
  } catch (err) {
    console.error('Failed to save settings to Firestore:', err)
  }

  if (typeof window !== 'undefined') {
    const current = await getSystemSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem('cs_system_settings', JSON.stringify(updated))
  }
}
