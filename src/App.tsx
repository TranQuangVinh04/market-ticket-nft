import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { Navigate, Route, Routes } from 'react-router-dom'
import { config } from '../wagmi.config'
import '@rainbow-me/rainbowkit/styles.css'
import { useAccount, useDisconnect } from 'wagmi'
import { useCallback, useEffect, useState } from 'react'

import Home from './pages/Home'
import Profile from './pages/Profile'
import EventDetail from './pages/EventDetail'
import WalletSignIn from './components/WalletSignIn'
import './App.css'

// Tạo QueryClient để quản lý cache và state
// Cấu hình để tránh lỗi JSON parsing
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AuthGate() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('auth_token')
    } catch {
      return null
    }
  })

  const refreshToken = useCallback(() => {
    try {
      setToken(localStorage.getItem('auth_token'))
    } catch {
      setToken(null)
    }
  }, [])

  useEffect(() => {
    refreshToken()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth_token') refreshToken()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('auth_token_changed', refreshToken)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('auth_token_changed', refreshToken)
    }
  }, [refreshToken])

  // If wallet disconnects, drop the token state (and keep UX consistent).
  useEffect(() => {
    if (isConnected && address) return
    setToken(null)
  }, [address, isConnected])

  const mustSignIn = !!(isConnected && address && !token)
  if (!mustSignIn) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop blocks all interaction */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[min(520px,calc(100vw-2rem))]">
        <div className="mb-3 text-center text-sm text-[#e8e0d0]" style={{ fontFamily: "'Lora', serif" }}>
          Bạn cần <span className="font-semibold text-[#f4d03f]">ký đăng nhập</span> để sử dụng các chức năng trong web.
        </div>

        <WalletSignIn variant="card" onSuccess={() => refreshToken()} />

        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('auth_token')
              } catch {
                // ignore
              }
              disconnect()
              refreshToken()
            }}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-[#5c4033]/60 bg-[#3d2817]/60 text-[#e8e0d0] hover:bg-[#5c4033]/60 transition-colors"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Ngắt kết nối ví
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AuthGate />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
