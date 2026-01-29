// import BuyTicket from '../components/BuyTicket'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import atraic2Image from '../public/atraic2.png'
import backgroundImage from '../public/background.jpg'
import { formatEther } from 'viem'
import { useReadContracts } from 'wagmi'
import { 
  featuredEvents, 
  trendingEvents, 
  recommendedEvents, 
  weekendEvents, 
  endOfMonthEvents,
  type Event 
} from '../config/events'
import { useDragScroll } from '../hooks/useDragScroll'
import { useReload } from '../hooks/useReload'
import { getAllEvent } from '../api/events'
import { ticket1155Abi } from '../abi/ticket1155Abi'

type UiEvent = Event & {
  backendId?: string
  chainId?: number
  tokenId?: string
  contractAddress?: `0x${string}`
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

function Home() {
  const { reloadNonce, triggerReload } = useReload()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [activeTimeTab, setActiveTimeTab] = useState<'week' | 'month'>('week')
  const [scrollY, setScrollY] = useState(0)

  const [remoteEvents, setRemoteEvents] = useState<UiEvent[] | null>(null)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  
  // Banner only: prefer backend events that have contractAddress; fallback to local featuredEvents.
  const bannerSlides = useMemo(() => {
    const withContract =
      remoteEvents?.filter((e) => !!e.contractAddress).slice(0, 3) || []
    return withContract.length > 0 ? withContract : featuredEvents
  }, [remoteEvents])

  // Keep sections below as-is (use local mock data)
  const trendingList = useMemo(() => trendingEvents, [])
  
  // Chọn sự kiện theo tab
  const timeBasedEvents: Event[] = activeTimeTab === 'week' ? weekendEvents : endOfMonthEvents
  
  // Drag scroll refs cho mỗi section
  const trendingScrollRef = useDragScroll()
  const recommendedScrollRef = useDragScroll()
  const timeBasedScrollRef = useDragScroll()

  // Banner: batch read on-chain info for each contract (price + ticket type)
  function asSupportedChainId(v: unknown): 1 | 11155111 | 137 | 42161 | undefined {
    return v === 1 || v === 11155111 || v === 137 || v === 42161 ? v : undefined
  }

  const bannerContracts = useMemo(() => {
    if (!Array.isArray(bannerSlides))
      return [] as { address: `0x${string}`; chainId?: 1 | 11155111 | 137 | 42161; tokenId: bigint }[]
    return (bannerSlides as UiEvent[])
      .filter((e) => !!e.contractAddress)
      .map((e) => {
        // Hard-coded: always read base price/type for tokenId=1 (Thường) in banner
        const tokenId = 1n
        return { address: e.contractAddress as `0x${string}`, chainId: asSupportedChainId(e.chainId), tokenId }
      })
  }, [bannerSlides])

  const [bannerMetaByIndex, setBannerMetaByIndex] = useState<Record<number, NftMetadata>>({})
  const [bannerMetaLoading, setBannerMetaLoading] = useState(false)

  const { data: bannerReads, isLoading: bannerReadsLoading } = useReadContracts({
    contracts:
      bannerContracts.length > 0
        ? bannerContracts.flatMap((c) => [
            {
              address: c.address,
              chainId: c.chainId,
              abi: ticket1155Abi,
              functionName: 'ticketPrices',
              args: [c.tokenId],
            },
            {
              address: c.address,
              chainId: c.chainId,
              abi: ticket1155Abi,
              functionName: 'getTicketType',
              args: [c.tokenId],
            },
            {
              address: c.address,
              chainId: c.chainId,
              abi: ticket1155Abi,
              functionName: 'uri',
              args: [c.tokenId],
            },
          ])
        : [],
    query: { enabled: bannerContracts.length > 0 },
  })

  const bannerOnchainByIndex = useMemo(() => {
    const out: { priceLabel?: string; ticketTypeLabel?: string; uri?: string }[] = []
    for (let i = 0; i < bannerContracts.length; i++) {
      const priceRes = bannerReads?.[i * 3]?.result
      const typeRes = bannerReads?.[i * 3 + 1]?.result
      const uriRes = bannerReads?.[i * 3 + 2]?.result

      const priceLabel = typeof priceRes === 'bigint' ? `${formatEther(priceRes)} ETH` : undefined
      const ticketTypeLabel =
        Array.isArray(typeRes) && typeof typeRes[0] === 'string' ? (typeRes[0] as string) : undefined
      const uri = typeof uriRes === 'string' ? uriRes : undefined

      out.push({ priceLabel, ticketTypeLabel, uri })
    }
    return out
  }, [bannerContracts.length, bannerReads])

  // Fetch NFT metadata JSON from on-chain uri (https). Use it to fill banner title/description/image.
  useEffect(() => {
    let cancelled = false

    async function loadMeta() {
      setBannerMetaLoading(true)
      const tasks = bannerOnchainByIndex
        .map((x, idx) => ({ idx, uri: x.uri }))
        .filter((x) => !!x.uri)

      if (tasks.length === 0) {
        setBannerMetaByIndex({})
        if (!cancelled) setBannerMetaLoading(false)
        return
      }

      const next: Record<number, NftMetadata> = {}
      await Promise.all(
        tasks.map(async ({ idx, uri }) => {
          if (!uri) return
          try {
            const candidates = uri.endsWith('.json') ? [uri] : [uri, `${uri}.json`]
            for (const u of candidates) {
              try {
                const res = await fetch(u, { method: 'GET' })
                if (!res.ok) continue
                const json = (await res.json()) as any
                if (json && typeof json === 'object') {
                  next[idx] = {
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
                  break
                }
              } catch {
                // try next candidate
              }
            }
          } catch {
            // ignore
          }
        }),
      )

      if (!cancelled) {
        setBannerMetaByIndex(next)
        setBannerMetaLoading(false)
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [bannerOnchainByIndex])

  // Banner loading state: show overlay until API + on-chain reads + metadata fetch are done.
  const bannerLoading = remoteLoading || bannerReadsLoading || bannerMetaLoading
  
  function mapRemoteToEvent(v: unknown): UiEvent | null {
    if (!v || typeof v !== 'object') return null
    const o = v as any

    // Backend shape (example):
    // { id: uuid, name: slug, chainId, tokenId, contract: { address } }
    const slugRaw = o.name ?? o.slug
    const slug = typeof slugRaw === 'string' && slugRaw.trim() ? slugRaw.trim() : undefined
    if (!slug) return null

    // Title is not provided by backend currently; fallback to slug (pretty).
    const titleRaw = o.title ?? o.eventTitle
    const title =
      typeof titleRaw === 'string' && titleRaw.trim()
        ? titleRaw
        : slug
            .split('-')
            .map((w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w))
            .join(' ')

    const descriptionRaw = o.description ?? o.desc ?? o.summary
    const description = typeof descriptionRaw === 'string' ? descriptionRaw : ''

    const dateRaw = o.date ?? o.startDate ?? o.time ?? o.startTime
    const date = typeof dateRaw === 'string' ? dateRaw : ''

    const locationRaw = o.location ?? o.venue ?? o.address
    const location = typeof locationRaw === 'string' ? locationRaw : ''

    const priceRaw = o.price ?? o.minPrice ?? o.ticketPrice
    const price =
      typeof priceRaw === 'string'
        ? priceRaw
        : typeof priceRaw === 'number'
          ? `${priceRaw}`
          : 'Liên hệ'

    const featured = !!(o.featured ?? o.isFeatured ?? o.highlight)

    const contractAddressRaw = o?.contract?.address
    const contractAddress =
      typeof contractAddressRaw === 'string' && /^0x[a-fA-F0-9]{40}$/.test(contractAddressRaw)
        ? (contractAddressRaw as `0x${string}`)
        : undefined

    return {
      // Keep route id compatible with existing /event/:id (uses slug ids in config)
      id: slug,
      name: slug,
      title,
      description,
      bannerImage: typeof o.bannerImage === 'string' ? o.bannerImage : '',
      date,
      location,
      price,
      featured,
      details: typeof o.details === 'object' ? o.details : undefined,
      backendId: typeof o.id === 'string' ? o.id : undefined,
      chainId: typeof o.chainId === 'number' ? o.chainId : undefined,
      tokenId: typeof o.tokenId === 'string' || typeof o.tokenId === 'number' ? String(o.tokenId) : undefined,
      contractAddress,
    }
  }

  function routeStateFor(e: Partial<UiEvent>) {
    // Backend tokenId is treated as "ticket type count" (e.g. 3 => options 1..3)
    const tokenIdCount = e.tokenId && /^\d+$/.test(e.tokenId) ? e.tokenId : undefined
    return {
      contractAddress: e.contractAddress,
      tokenId: tokenIdCount || '3',
      chainId: e.chainId,
      backendId: e.backendId,
      slug: e.id,
    }
  }

  // Track scroll for background parallax
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setScrollY(window.scrollY || 0))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Load events from backend (JWT will be attached automatically via api client)
  useEffect(() => {
    let cancelled = false

    async function load() {
      setRemoteLoading(true)
      setRemoteError(null)
      try {
        const raw = await getAllEvent()

        const list: unknown =
          Array.isArray(raw)
            ? raw
            : raw && typeof raw === 'object'
              ? (raw as any).data ?? (raw as any).events ?? (raw as any).result
              : null

        const arr = Array.isArray(list) ? list : []
        const mapped: UiEvent[] = arr.map((x) => mapRemoteToEvent(x)).filter((x): x is UiEvent => !!x)

        if (!cancelled) setRemoteEvents(mapped.length > 0 ? mapped : null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!cancelled) setRemoteError(msg)
        if (!cancelled) setRemoteEvents(null)
      } finally {
        if (!cancelled) setRemoteLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [reloadNonce])


  // Auto-play carousel - chuyển slide mỗi 5 giây
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerSlides.length)
    }, 5000) // 5 giây = 5000ms

    return () => clearInterval(interval)
  }, [bannerSlides.length]) // Chỉ reset khi số lượng slides thay đổi

  // Reset slide index when banner source changes (avoid out-of-range)
  useEffect(() => {
    setCurrentSlide(0)
  }, [bannerSlides.length])

  // Hàm chuyển slide
  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index)
  }, [])

  const goToPrevious = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + bannerSlides.length) % bannerSlides.length)
  }, [bannerSlides.length])

  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % bannerSlides.length)
  }, [bannerSlides.length])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#3d2817] via-[#5c4033] to-[#1e3a5f]" style={{ fontFamily: "'Lora', 'Crimson Text', Georgia, serif" }}>
      <Header />

      <main className="relative">
        {/* Banner Carousel Section */}
        <section className="relative w-full min-h-[90vh] sm:min-h-[85vh] overflow-hidden">
          {/* Carousel Container */}
          <div className="relative w-full h-full min-h-[95vh] sm:min-h-[95vh]">
            {bannerLoading && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-[#f4d03f]/30 border-t-[#f4d03f] animate-spin" />
                  <div className="text-sm sm:text-base text-[#f5f1e8] font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Đang tải sự kiện...
                  </div>
                </div>
              </div>
            )}
            {bannerSlides.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat flex items-center justify-center transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
                style={{
                  backgroundImage: `url(${backgroundImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: `center ${scrollY * 0.3}px`,
                  backgroundAttachment: window.innerWidth < 768 ? 'scroll' : 'fixed',
                  imageRendering: 'auto' as const,
                  WebkitBackfaceVisibility: 'hidden' as const,
                  backfaceVisibility: 'hidden' as const,
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
              >
                {/* Animated Overlay gradient - Warm tones phù hợp với thư viện */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#3d2817]/70 via-[#5c4033]/50 to-[#1e3a5f]/70 animate-gradient-shift"></div>
                
                {/* Floating particles effect - Warm golden stars */}
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-[#f4d03f]/40 rounded-full animate-float"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 3}s`,
                        animationDuration: `${3 + Math.random() * 4}s`,
                      }}
                    />
                  ))}
                </div>
                
                {/* Banner Content với Highlights */}
                <div className="relative z-10 px-3 sm:px-4 md:px-6 lg:px-8 w-[90%] max-w-7xl mx-auto py-12 sm:py-16 md:py-20 lg:py-24 xl:py-32 overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-12 items-start lg:items-center w-full">
                    {/* Left Side - Event Image */}
                    <div 
                      className={`relative group transition-all duration-700 w-full ${
                        index === currentSlide ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                      }`}
                      style={{ transitionDelay: '0.2s' }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-2xl sm:rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-300"></div>
                      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-900/50 backdrop-blur-md p-3 sm:p-4 md:p-6 w-full">
                        <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl">
                          <img 
                            src={bannerMetaByIndex[index]?.image || atraic2Image} 
                            alt={slide.name}
                            className="w-full h-auto max-w-full object-contain sm:object-cover transform group-hover:scale-105 transition-transform duration-500"
                            style={{ maxHeight: '400px' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Event Highlights */}
                    <div 
                      className={`transition-all duration-700 w-full ${
                        index === currentSlide ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
                      }`}
                      style={{ transitionDelay: '0.5s' }}
                    >
                      {/* Featured Badge */}
                      <span className="inline-block px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-[#d4af37]/30 to-[#f4d03f]/30 border border-[#d4af37]/50 rounded-full text-[#f4d03f] text-xs sm:text-sm font-semibold mb-3 sm:mb-4 shadow-lg">
                        Sự Kiện Nổi Bật
                      </span>
                      
                      {/* Event Title */}
                      <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-[#f5f1e8] mb-3 sm:mb-4 drop-shadow-lg leading-tight" style={{ fontFamily: "'Playfair Display', serif", textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                        {bannerMetaByIndex[index]?.event?.title || bannerMetaByIndex[index]?.name || slide.title}
                      </h2>
                      
                      {/* Event Metadata */}
                      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 text-[#e8e0d0] mb-4 sm:mb-6 text-xs sm:text-sm md:text-base">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="drop-shadow-md truncate">
                            {bannerMetaByIndex[index]?.event?.date
                              ? `${bannerMetaByIndex[index]?.event?.date}${bannerMetaByIndex[index]?.event?.time ? ` • ${bannerMetaByIndex[index]?.event?.time}` : ''}`
                              : slide.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="drop-shadow-md truncate">{bannerMetaByIndex[index]?.event?.location || slide.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-[#f4d03f] drop-shadow-md truncate">
                            {bannerOnchainByIndex[index]?.priceLabel ?? slide.price}
                          </span>
                        </div>
                      </div>

                      {/* Ticket type count from backend tokenId */}
                      {(slide as any)?.tokenId && (
                        <div className="mb-3">
                          <span className="inline-block px-3 py-1.5 bg-[#3d2817]/40 border border-[#d4af37]/30 rounded-full text-[#f5f1e8] text-xs sm:text-sm font-semibold">
                            Có {(slide as any).tokenId} loại vé
                          </span>
                        </div>
                      )}

                      {/* Organizer (from metadata) */}
                      {bannerMetaByIndex[index]?.event?.organizer && (
                        <div className="mb-3">
                          <span className="inline-block px-3 py-1.5 bg-[#3d2817]/30 border border-[#5c4033]/40 rounded-full text-[#e8e0d0] text-xs sm:text-sm">
                            Nhà tổ chức: {bannerMetaByIndex[index]?.event?.organizer}
                          </span>
                        </div>
                      )}

                      {/* Event Description */}
                      {(bannerMetaByIndex[index]?.description || slide.details?.about) && (
                        <p className="text-sm sm:text-base md:text-lg text-[#e8e0d0] leading-relaxed mb-4 sm:mb-6 drop-shadow-md line-clamp-3 sm:line-clamp-none" style={{ fontFamily: "'Lora', serif" }}>
                          {bannerMetaByIndex[index]?.description || slide.details?.about}
                        </p>
                      )}
                      
                      {/* Highlights Section */}
                      {slide.details?.highlights && (
                        <div className="mb-4 sm:mb-6 md:mb-8 max-h-[200px] sm:max-h-none overflow-y-auto sm:overflow-visible">
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#f5f1e8] mb-2 sm:mb-3 md:mb-4 drop-shadow-lg" style={{ fontFamily: "'Playfair Display', serif" }}>Điểm Nổi Bật:</h3>
                          <ul className="space-y-1.5 sm:space-y-2 md:space-y-3">
                            {slide.details.highlights.map((highlight, idx) => (
                              <li 
                                key={idx} 
                                className="flex items-start gap-2 sm:gap-3 text-[#e8e0d0] transition-all duration-300 hover:text-[#f5f1e8] drop-shadow-md text-xs sm:text-sm md:text-base"
                              >
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#4a9b8e] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="min-w-0" style={{ fontFamily: "'Lora', serif" }}>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* CTA Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <Link
                          to={`/event/${encodeURIComponent(slide.id)}`}
                          state={{ ...routeStateFor(slide as any), metadata: bannerMetaByIndex[index] }}
                          className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#3d2817] font-semibold rounded-xl hover:from-[#f4d03f] hover:to-[#d4af37] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 drop-shadow-lg text-sm sm:text-base text-center"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          Mua Vé Ngay
                        </Link>
                        <button className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-[#3d2817]/60 backdrop-blur-md text-[#f5f1e8] font-semibold rounded-xl border border-[#d4af37]/50 hover:border-[#f4d03f]/70 transition-all duration-200 hover:scale-105 active:scale-95 drop-shadow-md text-sm sm:text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                          Chia Sẻ Sự Kiện
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Buttons - Mobile friendly */}
          <button
            onClick={goToPrevious}
            className="absolute left-1 sm:left-2 md:left-4 lg:left-6 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-black/30 backdrop-blur-lg border border-white/20 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/50 hover:border-white/40 transition-all duration-300 hover:scale-110 active:scale-95 group shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 touch-manipulation"
            aria-label="Previous slide"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-pink-500/20 transition-all duration-300 blur-xl"></div>
            <svg className="relative w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 group-hover:translate-x-[-3px] transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-1 sm:right-2 md:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 bg-black/30 backdrop-blur-lg border border-white/20 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/50 hover:border-white/40 transition-all duration-300 hover:scale-110 active:scale-95 group shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 touch-manipulation"
            aria-label="Next slide"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-pink-500/20 transition-all duration-300 blur-xl"></div>
            <svg className="relative w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 group-hover:translate-x-[3px] transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Slide Indicators - Mobile friendly */}
          <div className="absolute bottom-3 sm:bottom-4 md:bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 sm:gap-2 md:gap-3 items-center px-3 py-1.5 sm:px-4 sm:py-2 bg-black/30 backdrop-blur-md rounded-full border border-white/20">
            {bannerSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all duration-500 rounded-full touch-manipulation ${
                  index === currentSlide
                    ? 'w-6 h-1.5 sm:w-8 sm:h-2 md:w-10 md:h-3 bg-white shadow-lg shadow-purple-500/50'
                    : 'w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-3 md:h-3 bg-white/40 hover:bg-white/60 active:bg-white/80'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </section>

        {/* Sự kiện xu hướng - Trending Events */}
        <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-b from-[#3d2817] to-[#3d2817]/50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#f5f1e8] mb-2 drop-shadow-lg flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                  <span className="text-3xl sm:text-4xl">🔥</span>
                  Sự kiện xu hướng
                </h2>
                <p className="text-sm sm:text-base text-[#e8e0d0]" style={{ fontFamily: "'Lora', serif" }}>
                  Những sự kiện đang được quan tâm nhất hiện nay
                </p>
                {remoteLoading && (
                  <p className="mt-2 text-xs sm:text-sm text-[#e8e0d0]/80" style={{ fontFamily: "'Lora', serif" }}>
                    Đang tải sự kiện từ server...
                  </p>
                )}
                {remoteError && (
                  <p className="mt-2 text-xs sm:text-sm text-[#fca5a5]" style={{ fontFamily: "'Lora', serif" }}>
                    Không tải được từ server: {remoteError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={triggerReload}
                  disabled={remoteLoading}
                  className="px-3 py-2 rounded-xl border border-[#d4af37]/40 bg-[#3d2817]/30 text-[#f4d03f] hover:bg-[#3d2817]/50 hover:text-[#f5f1e8] transition-colors duration-200 text-sm sm:text-base font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {remoteLoading ? 'Đang tải...' : 'Tải lại'}
                </button>
                <button
                  type="button"
                  className="text-[#f4d03f] hover:text-[#f5f1e8] transition-colors duration-200 text-sm sm:text-base font-semibold flex items-center gap-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Xem tất cả
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal Scroll Events */}
          <div className="max-w-7xl mx-auto">
            <div className="px-3 sm:px-4 md:px-6 lg:px-8">
              <div 
                ref={trendingScrollRef}
                className="scroll-container flex gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto pb-4 -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8"
              >
              {trendingList.map((event) => (
                <Link
                  key={event.id}
                  to={`/event/${event.id}`}
                  state={routeStateFor(event as any)}
                  className="scroll-snap-card event-card group bg-[#5c4033]/40 backdrop-blur-md rounded-xl sm:rounded-2xl overflow-hidden border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#d4af37]/20 cursor-pointer"
                >
                  {/* Event Image */}
                  <div className="relative w-full aspect-[3/2] sm:aspect-[16/10] overflow-hidden bg-[#5c4033]/30">
                    <img
                      src={atraic2Image}
                      alt={event.name}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Trending Badge */}
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-lg">
                      <span className="text-xs sm:text-sm">🔥</span>
                      <span className="hidden xs:inline">HOT</span>
                    </div>
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#3d2817]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  {/* Event Info */}
                  <div className="p-3 sm:p-4 md:p-5">
                    <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#f5f1e8] mb-2 line-clamp-2 group-hover:text-[#f4d03f] transition-colors duration-300 min-h-[2.5rem] sm:min-h-[3rem]" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {event.title}
                    </h3>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs md:text-sm text-[#e8e0d0] mb-1.5 sm:mb-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate" style={{ fontFamily: "'Lora', serif" }}>{event.date}</span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs md:text-sm text-[#e8e0d0] mb-2 sm:mb-3">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate" style={{ fontFamily: "'Lora', serif" }}>{event.location}</span>
                    </div>

                    <div className="border-t border-[#5c4033]/50 pt-2 sm:pt-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-shrink">
                        <p className="text-[10px] sm:text-xs text-[#e8e0d0] mb-0.5 sm:mb-1" style={{ fontFamily: "'Lora', serif" }}>Từ</p>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-[#f4d03f] leading-tight truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {event.price}
                        </p>
                      </div>
                      <button className="shrink-0 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#3d2817] text-[10px] sm:text-xs md:text-sm font-semibold rounded-lg hover:from-[#f4d03f] hover:to-[#d4af37] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Mua vé
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sự kiện dành cho bạn - Recommended Events */}
        <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-b from-[#3d2817]/50 to-[#3d2817] overflow-hidden">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#f5f1e8] mb-2 drop-shadow-lg flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                  <span className="text-3xl sm:text-4xl">⭐</span>
                  Dành cho bạn
                </h2>
                <p className="text-sm sm:text-base text-[#e8e0d0]" style={{ fontFamily: "'Lora', serif" }}>
                  Các sự kiện được đề xuất dựa trên sở thích của bạn
                </p>
              </div>
              <button className="text-[#f4d03f] hover:text-[#f5f1e8] transition-colors duration-200 text-sm sm:text-base font-semibold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                Xem tất cả
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Horizontal Scroll Events */}
          <div className="max-w-7xl mx-auto">
            <div className="px-3 sm:px-4 md:px-6 lg:px-8">
              <div 
                ref={recommendedScrollRef}
                className="scroll-container flex gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto pb-4 -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8"
              >
              {recommendedEvents.map((event) => (
                <Link
                  key={event.id}
                  to={`/event/${event.id}`}
                  className="scroll-snap-card event-card group bg-[#5c4033]/40 backdrop-blur-md rounded-xl sm:rounded-2xl overflow-hidden border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#d4af37]/20 cursor-pointer"
                >
                  {/* Event Image */}
                  <div className="relative w-full aspect-[3/2] sm:aspect-[16/10] overflow-hidden bg-[#5c4033]/30">
                    <img
                      src={atraic2Image}
                      alt={event.name}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Recommended Badge */}
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-1 sm:px-3 sm:py-1.5 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] rounded-full text-[#3d2817] text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-lg">
                      <span className="text-xs sm:text-sm">⭐</span>
                      <span className="hidden xs:inline">Đề xuất</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#3d2817]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>

                  {/* Event Info */}
                  <div className="p-3 sm:p-4 md:p-5">
                    <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#f5f1e8] mb-2 line-clamp-2 group-hover:text-[#f4d03f] transition-colors duration-300 min-h-[2.5rem] sm:min-h-[3rem]" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {event.title}
                    </h3>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs md:text-sm text-[#e8e0d0] mb-1.5 sm:mb-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate" style={{ fontFamily: "'Lora', serif" }}>{event.date}</span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs md:text-sm text-[#e8e0d0] mb-2 sm:mb-3">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate" style={{ fontFamily: "'Lora', serif" }}>{event.location}</span>
                    </div>

                    <div className="border-t border-[#5c4033]/50 pt-2 sm:pt-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-shrink">
                        <p className="text-[10px] sm:text-xs text-[#e8e0d0] mb-0.5 sm:mb-1" style={{ fontFamily: "'Lora', serif" }}>Từ</p>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-[#f4d03f] leading-tight truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {event.price}
                        </p>
                      </div>
                      <button className="shrink-0 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#3d2817] text-[10px] sm:text-xs md:text-sm font-semibold rounded-lg hover:from-[#f4d03f] hover:to-[#d4af37] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Mua vé
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sự kiện theo thời gian - Time-based Events với Tabs */}
        <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-b from-[#3d2817] to-[#3d2817]/50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            {/* Section Header with Tabs */}
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                {/* Tabs */}
                <div className="flex items-center gap-6 sm:gap-8 md:gap-12">
                  <button
                    onClick={() => setActiveTimeTab('week')}
                    className={`text-lg sm:text-xl md:text-2xl font-bold transition-all duration-300 pb-2 relative ${
                      activeTimeTab === 'week'
                        ? 'text-[#f5f1e8]'
                        : 'text-[#e8e0d0]/50 hover:text-[#e8e0d0]/80'
                    }`}
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Cuối tuần này
                    {activeTimeTab === 'week' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] rounded-full"></div>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTimeTab('month')}
                    className={`text-lg sm:text-xl md:text-2xl font-bold transition-all duration-300 pb-2 relative ${
                      activeTimeTab === 'month'
                        ? 'text-[#f5f1e8]'
                        : 'text-[#e8e0d0]/50 hover:text-[#e8e0d0]/80'
                    }`}
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Tháng này
                    {activeTimeTab === 'month' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] rounded-full"></div>
                    )}
                  </button>
                </div>

                {/* Xem thêm button */}
                <button className="text-[#f4d03f] hover:text-[#f5f1e8] transition-colors duration-200 text-sm sm:text-base font-semibold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Xem thêm
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal Scroll Events */}
          <div className="max-w-7xl mx-auto">
            <div className="px-3 sm:px-4 md:px-6 lg:px-8">
              <div 
                ref={timeBasedScrollRef}
                className="scroll-container flex gap-3 sm:gap-4 md:gap-5 lg:gap-6 overflow-x-auto pb-4 -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8"
              >
              {timeBasedEvents.map((event) => (
                <Link
                  key={event.id}
                  to={`/event/${event.id}`}
                  className="scroll-snap-card event-card group bg-[#5c4033]/40 backdrop-blur-md rounded-xl sm:rounded-2xl overflow-hidden border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#d4af37]/20 cursor-pointer"
                >
                  {/* Event Image */}
                  <div className="relative w-full aspect-[3/2] sm:aspect-[16/10] overflow-hidden bg-[#5c4033]/30">
                    <img
                      src={atraic2Image}
                      alt={event.name}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Dynamic Badge */}
                    <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-lg ${
                      activeTimeTab === 'week'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                        : 'bg-gradient-to-r from-orange-500 to-red-500'
                    }`}>
                      <span className="text-xs sm:text-sm">{activeTimeTab === 'week' ? '🎉' : '📅'}</span>
                      <span className="hidden xs:inline">Đã diễn ra</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#3d2817]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>

                  {/* Event Info */}
                  <div className="p-3 sm:p-4 md:p-5">
                    <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#f5f1e8] mb-2 line-clamp-2 group-hover:text-[#f4d03f] transition-colors duration-300 min-h-[2.5rem] sm:min-h-[3rem]" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {event.title}
                    </h3>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs md:text-sm text-[#e8e0d0] mb-1.5 sm:mb-2">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate" style={{ fontFamily: "'Lora', serif" }}>{event.date}</span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs md:text-sm text-[#e8e0d0] mb-2 sm:mb-3">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4d03f] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate" style={{ fontFamily: "'Lora', serif" }}>{event.location}</span>
                    </div>

                    <div className="border-t border-[#5c4033]/50 pt-2 sm:pt-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-shrink">
                        <p className="text-[10px] sm:text-xs text-[#e8e0d0] mb-0.5 sm:mb-1" style={{ fontFamily: "'Lora', serif" }}>Từ</p>
                        <p className="text-base sm:text-lg md:text-xl font-bold text-[#f4d03f] leading-tight truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
                          {event.price}
                        </p>
                      </div>
                      <button className="shrink-0 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-[#3d2817] text-[10px] sm:text-xs md:text-sm font-semibold rounded-lg hover:from-[#f4d03f] hover:to-[#d4af37] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 whitespace-nowrap" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Mua vé
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
              </div>
            </div>
          </div>
        </section>

       
        {/* Footer */}
        <footer className="bg-[#3d2817]/90 backdrop-blur-md border-t border-[#5c4033]/50 py-8 sm:py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-10 mb-8 sm:mb-10">
              {/* Logo & Description */}
              <div className="sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#d4af37] to-[#f4d03f] rounded-lg flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#3d2817]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 100 6v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 100-6V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <span className="text-2xl sm:text-3xl font-bold text-[#f4d03f] drop-shadow-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Zeo
                  </span>
                </div>
                <p className="text-sm sm:text-base text-[#e8e0d0] leading-relaxed mb-4" style={{ fontFamily: "'Lora', serif" }}>
                  Nền tảng mua vé sự kiện hàng đầu với công nghệ blockchain, đảm bảo an toàn và minh bạch cho mọi giao dịch.
                </p>
                {/* Social Media */}
                <div className="flex items-center gap-3">
                  <a href="#" className="w-9 h-9 sm:w-10 sm:h-10 bg-[#5c4033]/60 hover:bg-[#d4af37]/20 rounded-lg flex items-center justify-center border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-110">
                    <svg className="w-5 h-5 text-[#e8e0d0] hover:text-[#f4d03f]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                  <a href="#" className="w-9 h-9 sm:w-10 sm:h-10 bg-[#5c4033]/60 hover:bg-[#d4af37]/20 rounded-lg flex items-center justify-center border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-110">
                    <svg className="w-5 h-5 text-[#e8e0d0] hover:text-[#f4d03f]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                  <a href="#" className="w-9 h-9 sm:w-10 sm:h-10 bg-[#5c4033]/60 hover:bg-[#d4af37]/20 rounded-lg flex items-center justify-center border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-110">
                    <svg className="w-5 h-5 text-[#e8e0d0] hover:text-[#f4d03f]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.057-1.274-.07-1.649-.07-4.844 0-3.196.016-3.586.074-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.9.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                    </svg>
                  </a>
                  <a href="#" className="w-9 h-9 sm:w-10 sm:h-10 bg-[#5c4033]/60 hover:bg-[#d4af37]/20 rounded-lg flex items-center justify-center border border-[#5c4033]/50 hover:border-[#d4af37]/50 transition-all duration-300 hover:transform hover:scale-110">
                    <svg className="w-5 h-5 text-[#e8e0d0] hover:text-[#f4d03f]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#f4d03f] mb-4 sm:mb-6 drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Liên Kết Nhanh
                </h3>
                <ul className="space-y-2 sm:space-y-3">
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Về Chúng Tôi
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Sự Kiện
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Cách Mua Vé
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Hướng Dẫn
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Câu Hỏi Thường Gặp
                    </a>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#f4d03f] mb-4 sm:mb-6 drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Hỗ Trợ
                </h3>
                <ul className="space-y-2 sm:space-y-3">
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Trung Tâm Trợ Giúp
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Liên Hệ
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Chính Sách Bảo Mật
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Điều Khoản Sử Dụng
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-sm sm:text-base text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200 inline-block" style={{ fontFamily: "'Lora', serif" }}>
                      Hoàn Tiền
                    </a>
                  </li>
                </ul>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#f4d03f] mb-4 sm:mb-6 drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Liên Hệ
                </h3>
                <ul className="space-y-3 sm:space-y-4">
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-[#f4d03f] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm sm:text-base text-[#e8e0d0]" style={{ fontFamily: "'Lora', serif" }}>
                      support@zeo.vn
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-[#f4d03f] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-sm sm:text-base text-[#e8e0d0]" style={{ fontFamily: "'Lora', serif" }}>
                      1900 1234
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-[#f4d03f] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm sm:text-base text-[#e8e0d0]" style={{ fontFamily: "'Lora', serif" }}>
                      123 Đường ABC, Quận XYZ<br />
                      TP.HCM, Việt Nam
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-[#5c4033]/50 pt-6 sm:pt-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs sm:text-sm text-[#e8e0d0] text-center sm:text-left" style={{ fontFamily: "'Lora', serif" }}>
                  © 2024 Zeo Tickets. Tất cả quyền được bảo lưu.
                </p>
                <div className="flex items-center gap-4 sm:gap-6">
                  <a href="#" className="text-xs sm:text-sm text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200" style={{ fontFamily: "'Lora', serif" }}>
                    Chính Sách Bảo Mật
                  </a>
                  <span className="text-[#5c4033]">|</span>
                  <a href="#" className="text-xs sm:text-sm text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200" style={{ fontFamily: "'Lora', serif" }}>
                    Điều Khoản
                  </a>
                  <span className="text-[#5c4033]">|</span>
                  <a href="#" className="text-xs sm:text-sm text-[#e8e0d0] hover:text-[#f4d03f] transition-colors duration-200" style={{ fontFamily: "'Lora', serif" }}>
                    Cookie
                  </a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default Home

