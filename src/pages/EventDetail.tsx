import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import { featuredEvents, trendingEvents, recommendedEvents, weekendEvents, endOfMonthEvents, type Event } from '../config/events'
import atraic2Image from '../public/atraic2.png'
import backgroundImage from '../public/background.jpg'
import BuyTicket from '../components/BuyTicket'
import { getAllEvent } from '../api/events'
import { useReadContract, useReadContracts } from 'wagmi'
import { ticket1155Abi } from '../abi/ticket1155Abi'
import { formatEther } from 'viem'
import { useReload } from '../hooks/useReload'

// Temporary mapping for testing: map eventId -> on-chain contract address.
// Later you can load this from backend/database.
const EVENT_CONTRACT_BY_ID: Record<string, `0x${string}`> = {
  'anh-trai-say-hi': '0x37A9aC8f2fBe87aD3CB95fB6598E00CB9BfF7E2E',
} as const

type DetailNavState = {
  contractAddress?: `0x${string}`
  /** Backend tokenId is used as "ticket type count" (options 1..tokenId) */
  tokenId?: string
  chainId?: number
  backendId?: string
  slug?: string
  metadata?: NftMetadata
}

function isHexAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

type NftMetadata = {
  name?: string
  description?: string
  image?: string
  event?: {
    title?: string
    date?: string
    time?: string
    location?: string
    organizer?: string
  }
}

function prettifySlug(slug: string) {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function EventDetail() {
  const { reloadNonce, triggerReload } = useReload()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state || {}) as DetailNavState
  const [event, setEvent] = useState<Event | null>(null)
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([])
  const [showBuy, setShowBuy] = useState(false)
  const [isResolvingEvent, setIsResolvingEvent] = useState(true)
  const [isNotFound, setIsNotFound] = useState(false)

  const [contractAddress, setContractAddress] = useState<`0x${string}` | null>(null)
  const [ticketTypeCount, setTicketTypeCount] = useState<bigint | null>(null)
  const [meta, setMeta] = useState<NftMetadata | null>(null)

  const resolvedContract = useMemo(() => {
    return contractAddress || (id ? EVENT_CONTRACT_BY_ID[id] : undefined) || null
  }, [contractAddress, id])

  const defaultTokenId = 1n

  const displayedTitle = meta?.event?.title || meta?.name || event?.title || (id ? prettifySlug(id) : 'Sự kiện')
  const displayedDate =
    meta?.event?.date ? `${meta.event.date}${meta.event.time ? ` • ${meta.event.time}` : ''}` : event?.date || ''
  const displayedLocation = meta?.event?.location || event?.location || ''
  const displayedDescription = meta?.description || event?.description || ''
  const displayedImage = meta?.image || atraic2Image

  // Price range (tokenId 1..ticketTypeCount): show min-max ETH
  const ticketTypeIds = useMemo(() => {
    const n = ticketTypeCount ?? 3n
    const capped = n > 20n ? 20n : n
    return Array.from({ length: Number(capped) }, (_, i) => BigInt(i + 1))
  }, [ticketTypeCount])

  const { data: priceReads } = useReadContracts({
    contracts:
      resolvedContract
        ? ticketTypeIds.map((tid) => ({
            address: resolvedContract,
            abi: ticket1155Abi,
            functionName: 'ticketPrices',
            args: [tid],
          }))
        : [],
    query: { enabled: !!resolvedContract && ticketTypeIds.length > 0 },
  })

  const priceRangeLabel = useMemo(() => {
    const rows = (priceReads as any[] | undefined) || []
    const prices = rows
      .map((x) => (typeof x?.result === 'bigint' ? (x.result as bigint) : null))
      .filter((x): x is bigint => x !== null)
    if (prices.length === 0) return undefined
    let min = prices[0]
    let max = prices[0]
    for (const p of prices) {
      if (p < min) min = p
      if (p > max) max = p
    }
    const minEth = formatEther(min)
    const maxEth = formatEther(max)
    return min === max ? `${minEth} ETH` : `${minEth} - ${maxEth} ETH`
  }, [priceReads])

  useEffect(() => {
    let cancelled = false
    setIsResolvingEvent(true)
    setIsNotFound(false)
    setEvent(null)
    setRelatedEvents([])

    // Scroll to top
    window.scrollTo(0, 0)

    const allEvents = [...featuredEvents, ...trendingEvents, ...recommendedEvents, ...weekendEvents, ...endOfMonthEvents]
    const foundLocal = allEvents.find((e) => e.id === id)

    if (foundLocal) {
      setEvent(foundLocal)
      setRelatedEvents(
        allEvents
          .filter((e) => e.id !== id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 4),
      )
      setIsResolvingEvent(false)
      return () => {
        cancelled = true
      }
    }

    async function loadFromBackend() {
      if (!id) return
      try {
        const raw = await getAllEvent()
        const list: unknown =
          Array.isArray(raw)
            ? raw
            : raw && typeof raw === 'object'
              ? (raw as any).events ?? (raw as any).data ?? (raw as any).result
              : null

        const arr = Array.isArray(list) ? list : []
        const found = arr.find((x: any) => x && typeof x === 'object' && (x.name === id || x.slug === id))
        if (!found || cancelled) {
          if (!cancelled) setIsNotFound(true)
          if (!cancelled) setIsResolvingEvent(false)
          return
        }

        const titleRaw = found.title ?? found.eventTitle
        const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw : prettifySlug(id)

        const next: Event = {
          id,
          name: id,
          title,
          description: typeof found.description === 'string' ? found.description : '',
          bannerImage: '',
          date: typeof found.date === 'string' ? found.date : '',
          location: typeof found.location === 'string' ? found.location : '',
          price: '—',
          featured: true,
        }

        if (!cancelled) setEvent(next)
        if (!cancelled) setIsResolvingEvent(false)
      } catch {
        if (!cancelled) setIsNotFound(true)
        if (!cancelled) setIsResolvingEvent(false)
      }
    }

    void loadFromBackend()
    return () => {
      cancelled = true
    }
  }, [id, reloadNonce])

  // Prefer metadata passed from banner navigation.
  useEffect(() => {
    if (navState.metadata && typeof navState.metadata === 'object') {
      setMeta(navState.metadata)
    }
  }, [navState.metadata])

  // (event loading handled in the effect above to avoid "not found" flash)

  // If we have a contract to buy from, auto-open the buy panel for faster UX (banner -> detail -> buy).
  useEffect(() => {
    if (resolvedContract) setShowBuy(true)
  }, [resolvedContract])

  // Resolve contractAddress/tokenId:
  // 1) Prefer router state (from Home.tsx)
  // 2) Fallback to backend getAllEvent (match by slug name === :id)
  // 3) Fallback to local mapping EVENT_CONTRACT_BY_ID
  useEffect(() => {
    let cancelled = false

    // From router state
    if (navState.contractAddress && isHexAddress(navState.contractAddress)) {
      setContractAddress(navState.contractAddress)
    } else {
      setContractAddress(null)
    }

    // Ticket types count: prefer router state tokenId, fallback to backend tokenId, else default 3.
    const fromState =
      navState.tokenId && /^\d+$/.test(navState.tokenId)
        ? (() => {
            try {
              return BigInt(navState.tokenId)
            } catch {
              return null
            }
          })()
        : null

    setTicketTypeCount(fromState ?? 3n)

    // If missing, try backend
    async function loadFromBackend() {
      if (!id) return
      // If we already have both contract + tokenId count from router state, no need to fetch.
      if (navState.contractAddress && navState.tokenId) return

      try {
        const raw = await getAllEvent()
        const list: unknown =
          Array.isArray(raw)
            ? raw
            : raw && typeof raw === 'object'
              ? (raw as any).events ?? (raw as any).data ?? (raw as any).result
              : null

        const arr = Array.isArray(list) ? list : []
        const found = arr.find((x: any) => x && typeof x === 'object' && (x.name === id || x.slug === id))
        if (!found || cancelled) return

        const addr = found?.contract?.address
        if (typeof addr === 'string' && isHexAddress(addr)) {
          setContractAddress(addr as `0x${string}`)
        }

        // Backend tokenId is used as "how many ticket types exist" (1..tokenId)
        const tid = found?.tokenId
        if ((typeof tid === 'string' || typeof tid === 'number') && /^\d+$/.test(String(tid))) {
          try {
            setTicketTypeCount(BigInt(String(tid)))
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore: keep fallbacks
      }
    }

    void loadFromBackend()
    return () => {
      cancelled = true
    }
  }, [id, navState.contractAddress, navState.tokenId, reloadNonce])

  // Fallback metadata loading from on-chain uri(1) so direct URL still has full metadata.
  const { data: uri } = useReadContract({
    address: resolvedContract ?? undefined,
    abi: ticket1155Abi,
    functionName: 'uri',
    args: [1n],
    query: { enabled: !!resolvedContract && !meta },
  })
  useEffect(() => {
    let cancelled = false
    if (!uri || typeof uri !== 'string') return
    if (meta) return
    
    const uriStr = uri

    async function loadMeta() {
      try {
        const candidates = uriStr.endsWith('.json') ? [uriStr] : [uriStr, `${uriStr}.json`]
        for (const u of candidates) {
          try {
            const res = await fetch(u, { method: 'GET' })
            
            if (!res.ok) continue
            const json = (await res.json()) as any
            if (!json || typeof json !== 'object') continue

            const next: NftMetadata = {
              name: typeof json.name === 'string' ? json.name : undefined,
              description: typeof json.description === 'string' ? json.description : undefined,
              image: typeof json.image === 'string' ? json.image : undefined,
              event:
                json.event && typeof json.event === 'object'
                  ? {
                      title: typeof json.event.title === 'string' ? json.event.title : undefined,
                      date: typeof json.event.date === 'string' ? json.event.date : undefined,
                      time: typeof json.event.time === 'string' ? json.event.time : undefined,
                      location: typeof json.event.location === 'string' ? json.event.location : undefined,
                      organizer: typeof json.event.organizer === 'string' ? json.event.organizer : undefined,
                    }
                  : undefined,
            }
            if (!cancelled) setMeta(next)
            break
          } catch {
            // try next
          }
        }
      } catch {
        // ignore
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [meta, uri])

  if (isResolvingEvent) {
    return (
      <div
        className="min-h-screen bg-gradient-to-b from-[#3d2817] via-[#5c4033] to-[#1e3a5f] flex items-center justify-center"
        style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full border-4 border-[#f4d03f]/30 border-t-[#f4d03f] animate-spin" />
          <div className="text-[#f5f1e8] font-semibold">Đang tải sự kiện...</div>
        </div>
      </div>
    )
  }

  if (isNotFound || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#3d2817] via-[#5c4033] to-[#1e3a5f] flex items-center justify-center" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#f5f1e8] mb-4" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
            Không tìm thấy sự kiện
          </h1>
          <button
            type="button"
            onClick={triggerReload}
            className="inline-block mr-3 px-6 py-3 bg-[#3d2817]/40 text-[#f4d03f] font-semibold rounded-xl border border-[#d4af37]/40 hover:bg-[#3d2817]/60 transition-all duration-200"
            style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}
          >
            Tải lại
          </button>
          <Link 
            to="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#3d2817] font-semibold rounded-xl hover:from-[#f4d03f] hover:to-[#d4af37] transition-all duration-200"
            style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}
          >
            Quay về trang chủ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#3d2817] via-[#5c4033] to-[#1e3a5f]" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <Header />

      <main className="relative">
        {/* Hero Section with Background */}
        <section className="relative w-full min-h-[60vh] overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              filter: 'brightness(0.3) blur(2px)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#3d2817]/80 via-[#5c4033]/70 to-[#3d2817]" />
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-12 sm:pb-16">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="mb-6 sm:mb-8 flex items-center gap-2 text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 group"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 transform group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm sm:text-base font-semibold" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>Quay lại</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Event Image */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-300" />
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-[#d4af37]/30 shadow-2xl bg-slate-900/50 backdrop-blur-md p-4 sm:p-6">
                  {/* Fixed aspect image frame so all events look consistent */}
                  <div className="relative w-full aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden bg-black/20">
                    <img
                      src={displayedImage}
                      alt={event.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>

              {/* Event Info */}
              <div>
                {/* Featured Badge */}
                {event.featured && (
                  <span className="inline-block px-4 py-2 bg-gradient-to-r from-[#d4af37]/30 to-[#f4d03f]/30 border border-[#d4af37]/50 rounded-full text-[#f4d03f] text-sm font-semibold mb-4 shadow-lg">
                    Sự Kiện Nổi Bật
                  </span>
                )}

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f5f1e8] mb-6 leading-tight" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                  {displayedTitle}
                </h1>

                {/* Event Meta */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-[#e8e0d0]">
                    <div className="w-12 h-12 bg-[#d4af37]/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#f4d03f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-[#e8e0d0]/70 mb-1">Thời gian</p>
                      <p className="text-base sm:text-lg font-semibold" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>{displayedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[#e8e0d0]">
                    <div className="w-12 h-12 bg-[#d4af37]/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#f4d03f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-[#e8e0d0]/70 mb-1">Địa điểm</p>
                      <p className="text-base sm:text-lg font-semibold" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>{displayedLocation}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[#e8e0d0]">
                    <div className="w-12 h-12 bg-[#d4af37]/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#f4d03f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 100 6v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 100-6V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-[#e8e0d0]/70 mb-1">Giá vé</p>
                      <p className="text-2xl sm:text-3xl font-bold text-[#f4d03f]" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
                        {priceRangeLabel ? `${priceRangeLabel}` : event.price}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Organizer (from metadata) */}
                {meta?.event?.organizer && (
                  <div className="mb-4 text-sm text-[#e8e0d0]/90">
                    Nhà tổ chức: <span className="font-semibold text-[#f4d03f]">{meta.event.organizer}</span>
                  </div>
                )}

                {/* On-chain Trade Panel (placeholder) */}
                <div className="mt-6 sm:mt-8 bg-[#5c4033]/40 backdrop-blur-md rounded-2xl border border-[#5c4033]/50 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-[#f5f1e8] mb-1">
                        Giao dịch vé (On-chain)
                      </h2>
                      <p className="text-sm text-[#e8e0d0]/80">
                        Khu vực này để bạn gắn smart contract mua/bán vé NFT.
                      </p>
                    </div>
                    <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#d4af37]/20 text-[#f4d03f] border border-[#d4af37]/40">
                      Web3
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                    <div className="rounded-xl border border-[#5c4033]/50 bg-[#3d2817]/30 p-3">
                      <p className="text-[11px] text-[#e8e0d0]/70 mb-1">Contract</p>
                      <p className="text-sm text-[#f5f1e8] font-semibold truncate">{resolvedContract || 'Chưa cấu hình'}</p>
                    </div>
                    <div className="rounded-xl border border-[#5c4033]/50 bg-[#3d2817]/30 p-3">
                      <p className="text-[11px] text-[#e8e0d0]/70 mb-1">Event ID</p>
                      <p className="text-sm text-[#f5f1e8] font-semibold truncate">{event.id}</p>
                    </div>
                  </div>

                  {resolvedContract ? (
                    <div className="w-full">
                      {/* Dropdown / Accordion trigger */}
                      <button
                        type="button"
                        onClick={() => setShowBuy((v) => !v)}
                        className=" flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#3d2817] font-bold rounded-xl hover:opacity-90 transition-opacity"
                        aria-expanded={showBuy}
                        aria-controls="buy-ticket-panel"
                      >
                        <span>Mua vé</span>
                        <span className={`transition-transform duration-200 ${showBuy ? 'rotate-180' : ''}`} aria-hidden="true">
                          ▼
                        </span>
                      </button>

                      {/* Collapsible panel */}
                      <div
                        id="buy-ticket-panel"
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out mt-4 ${
                          showBuy ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <BuyTicket
                            contractAddress={resolvedContract}
                            defaultTokenId={defaultTokenId}
                            ticketTypeCount={ticketTypeCount ?? undefined}
                            showTicketTypeSelector={true}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[#e8e0d0]/80">
                      Event này chưa có contract address để demo. Bạn có thể thêm vào mapping <code>EVENT_CONTRACT_BY_ID</code> trong <code>EventDetail.tsx</code>.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Event Details Section */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-[#3d2817]/50">
          <div className="max-w-4xl mx-auto">
            {/* About */}
            {(displayedDescription || event.details?.about) && (
              <div className="mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#f5f1e8] mb-6 flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                  <span className="text-3xl">📋</span>
                  Về Sự Kiện
                </h2>
                <p className="text-base sm:text-lg text-[#e8e0d0] leading-relaxed" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
                  {displayedDescription || event.details?.about}
                </p>
              </div>
            )}

            {/* Highlights */}
            {event.details?.highlights && event.details.highlights.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#f5f1e8] mb-6 flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                  <span className="text-3xl">⭐</span>
                  Điểm Nổi Bật
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.details.highlights.map((highlight, idx) => (
                    <div 
                      key={idx}
                      className="flex items-start gap-3 p-4 bg-[#5c4033]/40 backdrop-blur-md rounded-xl border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300"
                    >
                      <div className="w-6 h-6 bg-[#4a9b8e] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm sm:text-base text-[#e8e0d0]" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
                        {highlight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
              <div className="bg-[#5c4033]/40 backdrop-blur-md rounded-xl p-6 border border-[#5c4033]/50 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#d4af37] to-[#f4d03f] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#3d2817]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#f4d03f] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Thời lượng
                </h3>
                <p className="text-sm text-[#e8e0d0]">3-4 giờ</p>
              </div>

              <div className="bg-[#5c4033]/40 backdrop-blur-md rounded-xl p-6 border border-[#5c4033]/50 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#d4af37] to-[#f4d03f] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#3d2817]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#f4d03f] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Độ tuổi
                </h3>
                <p className="text-sm text-[#e8e0d0]">16+</p>
              </div>

              <div className="bg-[#5c4033]/40 backdrop-blur-md rounded-xl p-6 border border-[#5c4033]/50 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#d4af37] to-[#f4d03f] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#3d2817]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#f4d03f] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Loại vé
                </h3>
                <p className="text-sm text-[#e8e0d0]">Standard, VIP</p>
              </div>
            </div>
          </div>
        </section>

        {/* Related Events */}
        {relatedEvents.length > 0 && (
          <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#3d2817]/50 to-[#1e3a5f]">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#f5f1e8] mb-8 flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                <span className="text-3xl">🎭</span>
                Sự Kiện Liên Quan
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedEvents.map((relatedEvent) => (
                  <Link
                    key={relatedEvent.id}
                    to={`/event/${relatedEvent.id}`}
                    className="group bg-[#5c4033]/40 backdrop-blur-md rounded-xl overflow-hidden border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-[#d4af37]/20"
                  >
                    <div className="relative w-full aspect-[3/2] overflow-hidden bg-[#5c4033]/30">
                      <img
                        src={atraic2Image}
                        alt={relatedEvent.name}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-base font-bold text-[#f5f1e8] mb-2 line-clamp-2 group-hover:text-[#f4d03f] transition-colors duration-300" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
                        {relatedEvent.title}
                      </h3>
                      <p className="text-sm text-[#e8e0d0] mb-2" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
                        {relatedEvent.date}
                      </p>
                      <p className="text-lg font-bold text-[#f4d03f]" style={{ fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
                        {relatedEvent.price}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default EventDetail
