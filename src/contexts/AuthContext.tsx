// Auth Context — 管理登入狀態與使用者資料
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase/client'
import { UserDoc, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  userDoc: UserDoc | null
  role: UserRole | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  devBypassLogin: (asRole?: UserRole) => void
  logout: () => Promise<void>
  refreshUserDoc: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchUserDoc(uid: string, email?: string | null) {
    try {
      const ref = doc(db, 'users', uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        setUserDoc({
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date(),
        } as UserDoc)
      } else {
        setUserDoc(null)
      }
    } catch (e) {
      console.error('Failed to fetch userDoc from Firestore:', e)
    }
  }

  // 判斷是否為 Admin Email (支援比對環境變數與 Settings 後台設定)
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

  useEffect(() => {
    // ⚠️ 開發保護：Firebase 未設定完成時，2 秒後強制結束 loading
    // 讓頁面的 DEV_MOCK_USER 可以套用（生產環境 Firebase 正常時會在 2 秒內觸發）
    const devFallback = setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        setLoading(false)
      }
    }, 2000)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(devFallback)
      setUser(firebaseUser)
      if (firebaseUser) {
        await fetchUserDoc(firebaseUser.uid, firebaseUser.email)
      } else {
        setUserDoc(null)
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

      const defaultDisplayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '客服勇者'
      const targetRole: UserRole = isAdmin ? 'admin' : 'examinee'

      if (snap.exists()) {
        const existingData = snap.data() as UserDoc
        const updatedRole = isAdmin ? 'admin' : (existingData.role || 'examinee')
        await setDoc(ref, {
          lastLoginAt: serverTimestamp(),
          role: updatedRole,
          email: firebaseUser.email || existingData.email,
        }, { merge: true })
      } else {
        // 首次 Google 登入：自動建立雲端 users 數據
        const newUserDoc: Omit<UserDoc, 'createdAt' | 'lastLoginAt'> & { createdAt: any; lastLoginAt: any } = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: defaultDisplayName,
          role: targetRole,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        }
        await setDoc(ref, newUserDoc)
      }

      await fetchUserDoc(firebaseUser.uid, firebaseUser.email)
    } catch (e: any) {
      console.error('Google Sign-in Error:', e)
      alert(`⚠️ 登入失敗：${e?.message || '請確認網路或 Google 登入設定'}`)
    }
  }

  async function logout() {
    await signOut(auth)
    setUserDoc(null)
  }

  async function refreshUserDoc() {
    if (user) await fetchUserDoc(user.uid, user.email)
  }

  function devBypassLogin(asRole: UserRole = 'examinee') {
    // 建立指定角色的 mock 用戶，保留快速測試功能
    const mockUser = {
      uid: asRole === 'admin' ? 'dev-admin-uid-001' : 'dev-mock-uid-001',
      email: asRole === 'admin' ? 'admin_hero@example.com' : 'dev_hero@example.com',
      displayName: asRole === 'admin' ? '主管測試勇者' : '客服測試勇者',
    } as unknown as User
    
    const mockDoc: UserDoc = {
      uid: mockUser.uid,
      email: mockUser.email!,
      displayName: mockUser.displayName!,
      role: asRole,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    }

    setUser(mockUser)
    setUserDoc(mockDoc)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{
      user,
      userDoc,
      role: userDoc?.role ?? null,
      loading,
      signInWithGoogle,
      devBypassLogin,
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
