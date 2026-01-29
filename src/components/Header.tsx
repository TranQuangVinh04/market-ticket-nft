import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import { formatEther } from 'viem'
import { useNavigate } from 'react-router-dom'

function Header() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: address,
    query: {
      enabled: !!address && isConnected,
    },
  })

  // Format balance để hiển thị
  const formatBalance = () => {
    if (!isConnected || !address) return '$0.00'
    if (balanceLoading) return 'Loading...'
    if (!balance) return '$0.00'
    
    const ethBalance = parseFloat(formatEther(balance.value))
    return `$${ethBalance.toFixed(4)}`
  }

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0  z-50 flex h-16 items-center bg-[#3d2817]/90 backdrop-blur-md border-b border-[#5c4033]/50 px-3 sm:px-10 lg:h-20 lg:px-20 shadow-lg"
      style={{ fontFamily: "'Lora', serif" }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 sm:gap-4 md:gap-6 lg:gap-8">
        {/* Left Section - Logo + Search */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6">
          <Logo />
          <SearchBar />
        </div>

        {/* Center Section - Empty Space */}
        <div className="flex-1"></div>

        {/* Right Actions Section */}
        <RightActions 
          isConnected={isConnected} 
          balance={formatBalance()}
          onProfileClick={() => navigate('/profile')}
        />
      </div>
    </nav>
  )
}

// Logo Component
function Logo() {
  return (
    <div className="flex shrink-0 items-center">
      <a
        href="/"
        className="flex items-center gap-1.5 sm:gap-2 md:gap-3 transition-opacity duration-200 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#f4d03f]/50 focus:ring-offset-2 focus:ring-offset-[#3d2817] rounded-lg"
        aria-label="Zeo - Trang chủ"
      >
        {/* Ticket Icon */}
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#f4d03f] shadow-lg transition-transform duration-200 hover:scale-105 sm:h-9 sm:w-9 md:h-10 md:w-10">
          <svg
            className="h-4 w-4 text-[#3d2817] sm:h-5 sm:w-5 md:h-6 md:w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Ticket icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 0 0-6V7a2 2 0 0 0-2-2H5z"
            />
          </svg>
        </div>
        {/* Logo Text */}
        <span 
          className="text-base font-bold bg-gradient-to-r from-[#f4d03f] via-[#d4af37] to-[#d97706] bg-clip-text text-transparent sm:text-lg md:text-xl drop-shadow-md" 
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Zeo
        </span>
      </a>
    </div>
  )
}

// Search Bar Component
function SearchBar() {
  return (
    <div className="w-auto min-w-[100px] sm:min-w-[160px] md:min-w-[200px] lg:min-w-[400px] max-w-[150px] sm:max-w-[200px] md:max-w-[250px] lg:max-w-[300px]">
      <div className="group relative flex h-9 w-full items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#5c4033]/50 bg-[#3d2817]/60 backdrop-blur-md px-2 shadow-sm transition-all duration-150 hover:bg-[#5c4033]/60 hover:border-[#d4af37]/50 focus-within:bg-[#5c4033]/60 focus-within:border-[#d4af37]/50 sm:h-10 sm:gap-2 sm:px-3">
        {/* Search Icon */}
        <div className="flex min-w-fit items-center">
          <svg
            aria-label="Search"
            className="h-4 w-4 text-[#f4d03f] sm:h-[18px] sm:w-[18px]"
            fill="currentColor"
            role="img"
            viewBox="0 0 24 24"
          >
            <path d="m21 20-5.2-5.2a7 7 0 1 0-1.4 1.4L20 21zM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0" />
          </svg>
        </div>
        
        {/* Search Input */}
        <input
          type="search"
          aria-label="Search for tickets"
          aria-invalid="false"
          autoComplete="off"
          placeholder="Bạn Muốn Tìm Vé Gì?"
          className="w-full border-0 bg-transparent text-xs text-[#e8e0d0] outline-none placeholder:text-[#f4d03f]/60 focus:placeholder:text-[#f4d03f]/40 sm:text-sm"
        />
        
        {/* Keyboard Shortcut */}
        <div className="hidden min-w-fit items-center sm:flex">
          <div className="flex size-5 items-center justify-center rounded border border-[#5c4033]/50 bg-[#3d2817]/40 text-[#f4d03f]/60 sm:size-6">
            <span className="text-xs leading-none">/</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Notification Button Component
function NotificationButton() {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#e8e0d0] transition-all duration-200 hover:bg-[#5c4033]/60 hover:text-[#f4d03f] active:scale-[0.98] focus:outline-none  focus:ring-[#f4d03f]/50 focus:ring-offset-2 focus:ring-offset-[#3d2817] sm:h-9 sm:w-9 md:h-10 md:w-10 md:px-3"
      aria-label="Notifications"
    >
      <svg
        className="h-4 w-4 sm:h-5 sm:w-5"
        fill="currentColor"
        role="img"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2m6-6v-5a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1z" />
      </svg>
    </button>
  )
}

// Balance Button Component
interface BalanceButtonProps {
  balance: string
}

function BalanceButton({ balance }: BalanceButtonProps) {
  return (
    <button
      type="button"
      className="hidden items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[#e8e0d0] transition-all duration-200 hover:bg-[#5c4033]/60 hover:text-[#f4d03f] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#f4d03f]/50 focus:ring-offset-2 focus:ring-offset-[#3d2817] sm:inline-flex sm:h-9 sm:px-3 sm:text-sm md:h-10 md:gap-3 md:px-4"
      aria-label={`Current balance: ${balance}`}
    >
      <svg
        className="h-4 w-4 text-[#f4d03f] sm:h-5 sm:w-5"
        viewBox="0 0 24 24"
        role="img"
        aria-hidden="true"
      >
        <path d="M20 6H4a2 2 0 0 0-2 2v1h20V8a2 2 0 0 0-2-2M2 11h20v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Zm7 4a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-4a1 1 0 0 0-1 1" />
      </svg>
      <span className="hidden font-mono text-[#f4d03f] md:inline" aria-label={`Balance: ${balance}`}>
        {balance}
      </span>
    </button>
  )
}

// Wallet Button Component
function WalletButton() {
  return (
    <div className="flex h-8 items-center sm:h-9 md:h-10 rainbowkit-no-scrollbar">
      <ConnectButton chainStatus="none" showBalance={false} />
    </div>
  )
}

// User Profile Button Component
interface UserProfileButtonProps {
  onClick: () => void
}

const UserProfileButton = ({ onClick }: UserProfileButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#e8e0d0] transition-all duration-200 hover:bg-[#5c4033]/60 hover:text-[#f4d03f] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#f4d03f]/50 focus:ring-offset-2 focus:ring-offset-[#3d2817] sm:h-9 sm:w-9 md:h-10 md:w-10"
      aria-label="User profile"
    >
      <svg
        className="h-4 w-4 sm:h-5 sm:w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        role="img"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </button>
  )
}

// Right Actions Component
interface RightActionsProps {
  isConnected: boolean
  balance: string
  onProfileClick: () => void
}

function RightActions({ isConnected, balance, onProfileClick }: RightActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
      {/* Notifications Button */}
      <NotificationButton />

      {/* Divider */}
      <Divider />

      {/* Balance Button - Only show when connected */}
      {isConnected && (
        <>
          <BalanceButton balance={balance} />
          <Divider />
        </>
      )}

      {/* User Profile Button or Connect Wallet Button */}
      {isConnected ? (
        <UserProfileButton onClick={onProfileClick} />
      ) : (
        <WalletButton />
      )}
    </div>
  )
}

// Divider Component
function Divider() {
  return (
    <div 
      className="hidden h-3 w-px shrink-0 bg-[#5c4033]/50 sm:block md:h-6" 
      aria-hidden="true"
    />
  )
}

export default Header
