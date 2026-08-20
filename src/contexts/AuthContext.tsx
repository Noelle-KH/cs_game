// Auth Context — 管理登入狀態與使用者資料
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase/client'
import { UserDoc, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  userDoc: UserDoc | null
  userDocLoaded: boolean
  role: UserRole | null
  loading: boolean
  signInWithGoogle: () => Promise<UserDoc | null>
  logout: () => Promise<void>
  refreshUserDoc: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null)
  const [userDocLoaded, setUserDocLoaded] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchUserDoc(uid: string, email?: string | null) {
    try {
      const ref = doc(db, 'users', uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        const userEmail = email || data.email

        // 依據最新的授權清單即時判定最新角色
        const isAdmin = checkIsAdmin(userEmail)
        const isSupervisor = checkIsSupervisor(userEmail)
        const currentCalculatedRole: UserRole = isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'examinee')

        // 若資料庫中的角色與計算角色不符合（代表授權名單已被新增/移除），寫回雲端更新
        if (data.role !== currentCalculatedRole) {
          await updateDoc(ref, { role: currentCalculatedRole })
          data.role = currentCalculatedRole
        }

        setUserDoc({
          ...data,
          role: currentCalculatedRole,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date(),
        } as UserDoc)
      } else {
        setUserDoc(null)
      }
    } catch (e) {
      console.error('Failed to fetch userDoc from Firestore:', e)
      setUserDoc(null)
    } finally {
      setUserDocLoaded(true)
    }
  }

  // 判斷是否為 Admin Email
  function checkIsAdmin(email?: string | null): boolean {
    if (!email) return false
    const envEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'admin@example.com,manager@example.com')
      .split(',')
      .map(e => e.trim().toLowerCase())
    
    let localEmails: string[] = []
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cs_admin_emails')
      if (stored) {
        try { localEmails = (JSON.parse(stored) as string[]).map(e => e.toLowerCase()) } catch {}
      }
    }

    const allAdminEmails = Array.from(new Set([...envEmails, ...localEmails]))
    return allAdminEmails.includes(email.toLowerCase())
  }

  // 判斷是否為 Supervisor (主管) Email
  function checkIsSupervisor(email?: string | null): boolean {
    if (!email) return false
    const envSupervisorEmails = (process.env.NEXT_PUBLIC_SUPERVISOR_EMAILS || 'supervisor@example.com')
      .split(',')
      .map(e => e.trim().toLowerCase())
    
    let localSupervisorEmails: string[] = []
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cs_supervisor_emails')
      if (stored) {
        try { localSupervisorEmails = (JSON.parse(stored) as string[]).map(e => e.toLowerCase()) } catch {}
      }
    }

    const allSupervisorEmails = Array.from(new Set([...envSupervisorEmails, ...localSupervisorEmails]))
    return allSupervisorEmails.includes(email.toLowerCase())
  }

  useEffect(() => {
    // ⚠️ 開發保護：Firebase 未設定完成時，2 秒後強制結束 loading
    const devFallback = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        setLoading(false)
      }
    }, 2000)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(devFallback)
      if (firebaseUser) {
        setUserDocLoaded(false)
        await fetchUserDoc(firebaseUser.uid, firebaseUser.email)
        setUser(firebaseUser)
      } else {
        setUser(null)
        setUserDoc(null)
        setUserDocLoaded(true)
      }
      setLoading(false)
    })

    return () => {
      clearTimeout(devFallback)
      unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user
      const ref = doc(db, 'users', firebaseUser.uid)
      const snap = await getDoc(ref)
      const isAdmin = checkIsAdmin(firebaseUser.email)
      const isSupervisor = checkIsSupervisor(firebaseUser.email)

      const defaultDisplayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '客服勇者'
      const targetRole: UserRole = isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : 'examinee')

      // 取得或寫入 users
      if (snap.exists()) {
        const existingData = snap.data() as UserDoc
        const updatedRole = isAdmin ? 'admin' : (isSupervisor ? 'supervisor' : (existingData.role || 'examinee'))
        await setDoc(ref, {
          lastLoginAt: serverTimestamp(),
          role: updatedRole,
          email: firebaseUser.email || existingData.email,
        }, { merge: true })
      } else {
        // 首次 Google 登入：建立雲端 users 數據（displayName 預設留空，強制跳轉 /setup 讓使用者手動輸入真實姓名）
        const newUserDoc: Omit<UserDoc, 'createdAt' | 'lastLoginAt'> & { createdAt: any; lastLoginAt: any } = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: '',
          role: targetRole,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        }
        await setDoc(ref, newUserDoc)
      }

      await fetchUserDoc(firebaseUser.uid, firebaseUser.email)
      // 回傳 Firestore 中的 userDoc 以便調用端直接做跳轉決定
      const freshSnap = await getDoc(ref)
      return freshSnap.exists() ? (freshSnap.data() as UserDoc) : null
    } catch (e: any) {
      console.error('Google Sign-in Error:', e)
      if (e?.code === 'auth/unauthorized-domain') {
        alert('⚠️ 登入失敗：當前網域未獲 Firebase 授權！\n請至 Firebase Console -> Authentication -> Settings -> Authorized domains 新增您的 Vercel 網域。')
      } else if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user') {
        alert('⚠️ 登入彈窗被瀏覽器阻擋或關閉，請允許本站跳出彈窗後重試。')
      } else {
        alert(`⚠️ 登入失敗：${e?.message || '請確認網路或 Google 登入設定'}`)
      }
      return null
    }
  }

  async function logout() {
    await signOut(auth)
    setUserDoc(null)
    setUserDocLoaded(true)
  }

  async function refreshUserDoc() {
    if (user) await fetchUserDoc(user.uid, user.email)
  }

  return (
    <AuthContext.Provider value={{
      user,
      userDoc,
      userDocLoaded,
      role: userDoc?.role ?? null,
      loading,
      signInWithGoogle,
      logout,
      refreshUserDoc,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
