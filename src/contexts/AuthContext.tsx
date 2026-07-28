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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        await fetchUserDoc(firebaseUser.uid)
      } else {
        setUserDoc(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
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

  return (
    <AuthContext.Provider value={{
      user,
      userDoc,
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
