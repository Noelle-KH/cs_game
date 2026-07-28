import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata: Metadata = {
  title: '客服考核遊戲',
  description: '客服新人學習考核系統 — 楓之谷像素風格',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className="pixel-bg">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
