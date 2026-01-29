import { useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useDisconnect, useReadContracts } from 'wagmi'
import { formatEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { ticket1155Abi } from '../abi/ticket1155Abi'
import { MyOnchainTicket } from '../interface/profile'
import { TokenMetadata } from '../type/profile'
import { apiFetch } from '../api/http'
import { useReload } from '../hooks/useReload'

function isHexAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}


// Vé trong dự án: 3 loại vé (tokenId 1..3) = Thường/VIP/VVIP
const TOKEN_IDS_TO_SCAN = [1n, 2n, 3n] as const



function normalizeIpfsUri(uri: string) {
  // Project uses https gateways already (set from backend / metadata),
  // so keep URIs as-is (no ipfs:// rewrites).
  return uri
}

function safeString(v: unknown) {
  return typeof v === 'string' ? v : undefined
}

function guessTicketTypeLabel(tokenId: bigint) {
  // Fallback mapping phổ biến cho contract của bạn
  if (tokenId === 1n) return 'Thường'
  if (tokenId === 2n) return 'VIP'
  if (tokenId === 3n) return 'VVIP'
  return undefined
}

function ticketTypeBadgeClass(label: string) {
  const v = label.trim().toLowerCase()
  // Thường
  if (v === 'thường' || v === 'thuong' || v === 'standard' || v === 'regular') {
    return 'bg-[#94a3b8]/20 text-[#cbd5e1] border border-[#94a3b8]/40'
  }
  // VIP
  if (v === 'vip') {
    return 'bg-[#f59e0b]/20 text-[#fcd34d] border border-[#f59e0b]/40'
  }
  // VVIP
  if (v === 'vvip' || v === 'v-vip') {
    return 'bg-[#a855f7]/20 text-[#e9d5ff] border border-[#a855f7]/40'
  }
  // fallback
  return 'bg-[#3b82f6]/20 text-[#93c5fd] border border-[#3b82f6]/40'
}

function Profile() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { reloadNonce, triggerReload } = useReload()

  // Danh sách contract của user (backend trả về dựa trên field trong DB)
  const [userEventContracts, setUserEventContracts] = useState<`0x${string}`[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const [contractsError, setContractsError] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address) {
      setUserEventContracts([])
      setContractsError(null)
      return
    }

    let cancelled = false

    async function loadContracts() {
      setContractsLoading(true)
      setContractsError(null)

      // Prefer /me which returns: { ok: true, user: { purchases: [{ event: { contract: { address }}}] } }
      const candidates = ['/me']

      for (const path of candidates) {
        try {
          const json: any = await apiFetch(path, { method: 'GET' })

          // 1) New shape: user.purchases[].event.contract.address
          const purchases = json?.user?.purchases
          const addressesFromPurchases: string[] = Array.isArray(purchases)
            ? purchases
                .map((p: any) => p?.event?.contract?.address)
                .filter((x: any) => typeof x === 'string')
            : []

          // 2) Old shape fallback: { contracts: [...] } or array
          const legacyList = Array.isArray(json) ? json : json?.contracts
          const addressesFromLegacy: string[] = Array.isArray(legacyList)
            ? legacyList.filter((x: any) => typeof x === 'string')
            : []

          const merged = [...addressesFromPurchases, ...addressesFromLegacy]
            .map((x) => x.trim())
            .filter((x) => isHexAddress(x)) as `0x${string}`[]

          // Dedup
          const uniq = Array.from(new Set(merged.map((x) => x.toLowerCase())))
            .map((lower) => merged.find((x) => x.toLowerCase() === lower)!)
            .filter(Boolean)

          if (!cancelled) {
            setUserEventContracts(uniq)
            setContractsLoading(false)
            setContractsError(uniq.length === 0 ? 'Bạn chưa có purchase nào để quét vé.' : null)
          }
          return
        } catch {
          // try next
        }
      }

      if (!cancelled) {
        setUserEventContracts([])
        setContractsError('Không lấy được purchases/contracts từ backend (/me).')
        setContractsLoading(false)
      }
    }

    void loadContracts()
    return () => {
      cancelled = true
    }
  }, [address, isConnected, reloadNonce])

  const { data: balance, isLoading: balanceLoading } = useBalance({
    address: address,
    query: {
      enabled: !!address && isConnected,
    },
  })


  // Format address để hiển thị
  const formatAddress = (addr: string | undefined) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Format balance
  const formatBalance = () => {
    if (!isConnected || !address) return '0.00'
    if (balanceLoading) return 'Loading...'
    if (!balance) return '0.00'
    
    const ethBalance = parseFloat(formatEther(balance.value))
    return ethBalance.toFixed(4)
  }

  // ====== Load vé thật từ blockchain ======
  const tokenIdsToScan = useMemo(() => [...TOKEN_IDS_TO_SCAN], [])

  const contractList = useMemo(() => userEventContracts.filter((x) => isHexAddress(x)), [userEventContracts])

  // 1) Quét balanceOf(user, tokenId) cho TỪNG contract của user
  const balanceReads = useReadContracts({
    contracts:
      address && isConnected
        ? contractList.flatMap((contract) =>
            tokenIdsToScan.map((tokenId) => ({
              address: contract,
              abi: ticket1155Abi,
              functionName: 'balanceOf',
              args: [address, tokenId],
            })),
          )
        : [],
    query: { enabled: !!address && isConnected && contractList.length > 0 },
  })

  // 2) Lọc (contract, tokenId) user đang sở hữu (balance > 0)
  const ownedPairs = useMemo(() => {
    const data = balanceReads.data
    if (!data || data.length === 0) return [] as { contract: `0x${string}`; tokenId: bigint }[]

    const owned: { contract: `0x${string}`; tokenId: bigint }[] = []
    for (let ci = 0; ci < contractList.length; ci++) {
      for (let ti = 0; ti < tokenIdsToScan.length; ti++) {
        const idx = ci * tokenIdsToScan.length + ti
        const result = data[idx]?.result
        const bal = typeof result === 'bigint' ? result : 0n
        if (bal > 0n) owned.push({ contract: contractList[ci], tokenId: tokenIdsToScan[ti] })
      }
    }
    return owned
  }, [balanceReads.data, contractList, tokenIdsToScan])

  // 3) Với các (contract, tokenId) đang sở hữu, load thêm metadata on-chain (tên vé, trạng thái, giá, uri)
  const ticketInfoReads = useReadContracts({
    contracts:
      ownedPairs.length > 0
        ? ownedPairs.flatMap((p) => [
            {
              address: p.contract,
              abi: ticket1155Abi,
              functionName: 'getTicketType',
              args: [p.tokenId],
            },
            {
              address: p.contract,
              abi: ticket1155Abi,
              functionName: 'ticketPrices',
              args: [p.tokenId],
            },
            {
              address: p.contract,
              abi: ticket1155Abi,
              functionName: 'uri',
              args: [p.tokenId],
            },
          ])
        : [],
    query: { enabled: !!address && isConnected && ownedPairs.length > 0 },
  })

  // 4) Build list "My Tickets" từ dữ liệu hook
  const myTickets: MyOnchainTicket[] = useMemo(() => {
    if (!address || !isConnected) return []

    const balances = balanceReads.data
    if (!balances || balances.length === 0) return []

    // ticketInfoReads.data layout: [getTicketType(id1), price(id1), uri(id1), getTicketType(id2), ...]
    const info = ticketInfoReads.data || []

    const list: MyOnchainTicket[] = []
    for (let i = 0; i < ownedPairs.length; i++) {
      const p = ownedPairs[i]
      const ci = contractList.indexOf(p.contract)
      const ti = tokenIdsToScan.findIndex((x) => x === p.tokenId)
      const idx = ci >= 0 && ti >= 0 ? ci * tokenIdsToScan.length + ti : -1
      const quantityRaw = idx >= 0 ? balances[idx]?.result : 0n
      const quantity = typeof quantityRaw === 'bigint' ? quantityRaw : 0n
      if (quantity <= 0n) continue

      const base = i * 3
      const ticketTypeResult = info[base]?.result as
        | readonly [string, bigint, bigint, boolean, bigint]
        | undefined
      const priceWei = info[base + 1]?.result as bigint | undefined
      const uri = info[base + 2]?.result as string | undefined

      const name = ticketTypeResult?.[0] || `Ticket`
      const isActive = ticketTypeResult?.[3]

      list.push({
        contract: p.contract,
        tokenId: p.tokenId,
        name,
        quantity,
        priceWei,
        uri,
        status: isActive === false ? 'inactive' : 'active',
      })
    }

    // Sort theo tokenId tăng dần cho dễ nhìn
    list.sort((a, b) => (a.tokenId < b.tokenId ? -1 : 1))
    return list
  }, [
    address,
    isConnected,
    balanceReads.data,
    ownedPairs,
    ticketInfoReads.data,
    tokenIdsToScan,
    contractList,
  ])

  const totalQuantity = useMemo(() => {
    return myTickets.reduce((sum, t) => sum + t.quantity, 0n)
  }, [myTickets])

  // 5) Off-chain metadata (tên/mô tả/ảnh) từ uri(tokenId)
  const [metadataByTokenId, setMetadataByTokenId] = useState<Record<string, TokenMetadata>>({})

  // QR modal state
  const [qrOpen, setQrOpen] = useState(false)
  const [qrTitle, setQrTitle] = useState<string>('')
  const [qrPayload, setQrPayload] = useState<string>('')
  const [qrImageUrl, setQrImageUrl] = useState<string>('')

  const handleReloadAll = () => {
    // Reload backend-driven contracts (/me) + refetch on-chain reads + refetch metadata
    triggerReload()
    setMetadataByTokenId({})
    void (balanceReads as any).refetch?.()
    void (ticketInfoReads as any).refetch?.()
  }

  const ticketsWithUri = useMemo(
    () =>
      myTickets
        .filter((t) => !!t.uri)
        .map((t) => ({ contract: t.contract, tokenId: t.tokenId, uri: String(t.uri) })),
    [myTickets],
  )

  const openQrForTicket = (ticket: MyOnchainTicket) => {
    const tokenIdKey = ticket.tokenId.toString()
    const md = metadataByTokenId[`${ticket.contract}:${tokenIdKey}`]
    const label = md?.ticketType || md?.type || guessTicketTypeLabel(ticket.tokenId)

    // Keep payload small so QR URL won't exceed common limits
    const payloadObj = {
      contract: ticket.contract,
      owner: address,
      tokenId: tokenIdKey,
      ticketType: label,
      uri: ticket.uri ? normalizeIpfsUri(String(ticket.uri)) : undefined,
      event: md?.event
        ? {
            title: md.event.title,
            date: md.event.date,
            time: md.event.time,
            location: md.event.location,
            organizer: md.event.organizer,
          }
        : undefined,
      ts: Date.now(),
    }

    const payloadText = JSON.stringify(payloadObj)
    // Smaller by default to avoid taking too much screen space
    const img = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payloadText)}`

    setQrTitle(
      (md?.event?.title || md?.name || ticket.name) + (label ? ` • ${label}` : ''),
    )
    setQrPayload(payloadText)
    setQrImageUrl(img)
    setQrOpen(true)
  }

  useEffect(() => {
    let cancelled = false

    async function fetchOneByKey(contract: `0x${string}`, tokenId: bigint, rawUri: string) {
      const tokenKey = `${contract}:${tokenId.toString()}`
      if (metadataByTokenId[tokenKey]) return

      const uri = normalizeIpfsUri(rawUri)
      const candidates = uri.endsWith('.json') ? [uri] : [uri, `${uri}.json`]

      for (const url of candidates) {
        try {
          const res = await fetch(url, { method: 'GET' })
          if (!res.ok) continue
          const json = (await res.json()) as unknown
          if (!json || typeof json !== 'object') continue

          const obj = json as Record<string, unknown>
          const name = safeString(obj.name)
          const description = safeString(obj.description)
          const imageRaw = safeString(obj.image)
          const image = imageRaw ? normalizeIpfsUri(imageRaw) : undefined
          const ticketType = safeString(obj.ticketType)
          const type = safeString(obj.type)

          const eventRaw = obj.event
          const eventObj = eventRaw && typeof eventRaw === 'object' ? (eventRaw as Record<string, unknown>) : undefined
          const event = eventObj
            ? {
                title: safeString(eventObj.title),
                date: safeString(eventObj.date),
                time: safeString(eventObj.time),
                location: safeString(eventObj.location),
                organizer: safeString(eventObj.organizer),
              }
            : undefined

          if (cancelled) return
          setMetadataByTokenId((prev) => ({
            ...prev,
            [tokenKey]: { name, description, image, ticketType, type, event },
          }))
          return
        } catch {
          // ignore
        }
      }
    }

    void (async () => {
      for (const t of ticketsWithUri) {
        // eslint-disable-next-line no-await-in-loop
        await fetchOneByKey(t.contract, t.tokenId, t.uri)
        if (cancelled) return
      }
    })()

    return () => {
      cancelled = true
    }
    // metadataByTokenId is intentionally excluded to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsWithUri])

  const handleDisconnect = () => {
    disconnect()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#1e3a5f]/60 via-[#3d2817]/60 to-[#1e3a5f]/60" style={{ fontFamily: "'Lora', serif" }}>
      <Header />
      
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#f4d03f] drop-shadow-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              Hồ Sơ Của Tôi
            </h1>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#5c4033]/60 hover:bg-[#5c4033]/80 border border-[#5c4033]/50 hover:border-[#d4af37]/50 rounded-lg text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f4d03f]/50"
              aria-label="Quay lại trang chủ"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Quay lại</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 sm:space-y-8">
          {/* Contracts loaded from backend */}
          <div className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-[#5c4033]/50">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-[#f4d03f] drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>
                Contract sự kiện mà bạn đã mua
              </h2>
            
            
            </div>
            {contractsError && <div className="mt-2 text-xs text-[#fbbf24]">{contractsError}</div>}
            {contractList.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {contractList.map((c) => (
                  <span
                    key={c}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-[#5c4033]/40 text-[#e8e0d0] border border-[#5c4033]/60 font-mono"
                  >
                    {shortAddress(c)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Wallet Info */}
          {isConnected && address ? (
            <div className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-[#5c4033]/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-[#f4d03f] drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Thông Tin Ví
                </h2>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#d97706]/20 hover:bg-[#d97706]/30 border border-[#d97706]/50 hover:border-[#d97706] rounded-lg text-xs sm:text-sm font-medium text-[#d97706] hover:text-[#f4d03f] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#d97706]/50"
                  aria-label="Disconnect wallet"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Thoát Ví</span>
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base text-[#e8e0d0]">Địa chỉ:</span>
                  <span className="text-sm sm:text-base font-mono text-[#f4d03f]">{formatAddress(address)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base text-[#e8e0d0]">Số dư:</span>
                  <span className="text-sm sm:text-base font-mono text-[#f4d03f]">{formatBalance()} ETH</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-[#5c4033]/50 text-center">
              <p className="text-sm sm:text-base text-[#e8e0d0] mb-4">Vui lòng kết nối ví để xem thông tin</p>
              <div className="flex justify-center">
                <ConnectButton chainStatus="none" showBalance={false} />
              </div>
            </div>
          )}

          {/* Statistics */}
          {isConnected && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-[#5c4033]/50 text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#f4d03f] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {totalQuantity.toString()}
                </div>
                <div className="text-xs sm:text-sm text-[#e8e0d0]">Tổng số vé </div>
              </div>
              <div className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-[#5c4033]/50 text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#f4d03f] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {myTickets.length}
                </div>
                <div className="text-xs sm:text-sm text-[#e8e0d0]">Số loại vé</div>
              </div>
              <div className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-[#5c4033]/50 text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#f4d03f] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {balanceReads.isLoading || ticketInfoReads.isLoading ? '...' : '✓'}
                </div>
                <div className="text-xs sm:text-sm text-[#e8e0d0]">Trạng thái load</div>
              </div>
            </div>
          )}

          {/* My Tickets */}
          {isConnected && (
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#f4d03f] mb-4 sm:mb-6 drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>
                Vé Của Tôi
              </h2>
              <div className="space-y-3 sm:space-y-4">
                {myTickets.length > 0 ? (
                  myTickets.map((ticket) => (
                    <div
                      key={`${ticket.contract}:${ticket.tokenId.toString()}`}
                      className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div className="flex-1">
                          
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#f4d03f] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.title ||
                              metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.name ||
                              ticket.name}
                          </h3>
                          {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event && (
                            <div className="text-xs sm:text-sm text-[#e8e0d0] mb-2 space-y-1">
                              {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.date && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[#f4d03f]">📅</span>
                                  <span>
                                    {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.date}
                                    {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.time
                                      ? ` • ${metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.time}`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.location && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[#f4d03f]">📍</span>
                                  <span>{metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.location}</span>
                                </div>
                              )}
                              {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.organizer && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[#f4d03f]">👤</span>
                                  <span>{metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.event?.organizer}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.description && (
                            <p className="text-xs sm:text-sm text-[#e8e0d0] mb-2 line-clamp-3">
                              {metadataByTokenId[`${ticket.contract}:${ticket.tokenId.toString()}`]?.description}
                            </p>
                          )}
                          <div className="space-y-1 text-xs sm:text-sm text-[#e8e0d0]">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#f4d03f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>Số lượng: {ticket.quantity.toString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#f4d03f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>
                                Giá:{' '}
                                {typeof ticket.priceWei === 'bigint' ? `${formatEther(ticket.priceWei)} ETH` : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {(() => {
                            const key = `${ticket.contract}:${ticket.tokenId.toString()}`
                            const label =
                              metadataByTokenId[key]?.ticketType ||
                              metadataByTokenId[key]?.type ||
                              guessTicketTypeLabel(ticket.tokenId)
                            if (!label) return null
                            return (
                              <span className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium ${ticketTypeBadgeClass(label)}`}>
                                {label}
                              </span>
                            )
                          })()}
                          <span
                            className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium ${
                              ticket.status === 'active'
                                ? 'bg-[#4a9b8e]/30 text-[#4a9b8e] border border-[#4a9b8e]/50'
                                : 'bg-[#d97706]/30 text-[#d97706] border border-[#d97706]/50'
                            }`}
                          >
                            {ticket.status === 'active' ? 'Đang bán' : 'Tạm dừng'}
                          </span>
                          <button
                            type="button"
                            onClick={() => openQrForTicket(ticket)}
                            className="px-3 py-1.5 bg-linear-to-r from-[#d4af37] to-[#f4d03f] text-[#3d2817] rounded-lg text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity"
                          >
                            Generate QR
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#3d2817]/60 backdrop-blur-md rounded-xl p-6 border border-[#5c4033]/50 text-center">
                    <p className="text-sm sm:text-base text-[#e8e0d0]">
                      {balanceReads.isLoading
                        ? 'Đang tải vé từ blockchain...'
                        : 'Bạn chưa có vé nào trên contract này (hoặc tokenId nằm ngoài dải quét).'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* QR Modal */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Generate QR"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#3d2817] border border-[#5c4033]/60 p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#f4d03f]" style={{ fontFamily: "'Playfair Display', serif" }}>
                  QR Vé
                </h3>
                {qrTitle && <div className="text-xs sm:text-sm text-[#e8e0d0] mt-1">{qrTitle}</div>}
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#5c4033]/60 hover:bg-[#5c4033]/80 text-[#e8e0d0] border border-[#5c4033]/60"
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="Ticket QR"
                  className="rounded-xl border border-[#5c4033]/60 bg-white p-2"
                  // Override global `img { width: 100% }` in `src/index.css`
                  style={{ width: 160, height: 160, maxWidth: 160, maxHeight: 160 }}
                />
              ) : (
                <div className="text-sm text-[#e8e0d0]">Đang tạo QR...</div>
              )}
            </div>

            <div className="mt-4 text-xs text-[#e8e0d0]/80">
              Tip: QR này chứa dữ liệu xác thực (contract/owner/tokenId/loại vé/uri). Bạn có thể copy payload để debug:
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-black/20 border border-[#5c4033]/60 p-3">
                {qrPayload}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
