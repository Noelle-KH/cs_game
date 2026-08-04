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
  devBypassLogin: () => void
  logout: () => Promise<void>
  refreshUserDoc: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchUserDoc(uid: string) {
    const ref = doc(db, 'users', uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      setUserDoc(snap.data() as UserDoc)
    } else {
      setUserDoc(null)
    }
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
        await fetchUserDoc(firebaseUser.uid)
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
    const result = await signInWithPopup(auth, googleProvider)
    const ref = doc(db, 'users', result.user.uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      // 更新最後登入時間
      await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true })
    }
    // 若無 userDoc，middleware 會導向 /setup 設定顯示名稱
    await fetchUserDoc(result.user.uid)
  }

  async function logout() {
    await signOut(auth)
    setUserDoc(null)
  }

  async function refreshUserDoc() {
    if (user) await fetchUserDoc(user.uid)
  }

  function devBypassLogin() {
    // 建立 mock 用戶
    const mockUser = {
      uid: 'dev-mock-uid-001',
      email: 'dev_hero@example.com',
      displayName: '客服測試勇者',
    } as unknown as User
    
    const mockDoc: UserDoc = {
      uid: 'dev-mock-uid-001',
      email: 'dev_hero@example.com',
      displayName: '客服測試勇者',
      role: 'examinee',
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
