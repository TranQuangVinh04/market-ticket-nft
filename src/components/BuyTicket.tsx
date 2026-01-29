import { useEffect, useMemo, useRef, useState } from 'react'
import { formatEther } from 'viem'
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ticket1155Abi } from '../abi/ticket1155Abi'
import { apiFetch } from '../api/http'

type Props = {
  /** Địa chỉ contract event (Ticket1155) – truyền động từ EventDetail/Home */
  contractAddress: `0x${string}`
  /** Mặc định loại vé (tokenId) */
  defaultTokenId?: bigint
  /**
   * Backend tokenId is used as "how many ticket types exist".
   * Example: tokenId=3 => options 1..3 (Thường/VIP/VVIP)
   */
  ticketTypeCount?: bigint
  /** Ẩn/hiện lựa chọn loại vé */
  showTicketTypeSelector?: boolean
  /** Callback khi mua xong (sau receipt) */
  onPurchased?: () => void
}

function isHexAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

export default function BuyTicket({
  contractAddress,
  defaultTokenId = 1n,
  ticketTypeCount,
  showTicketTypeSelector = true,
  onPurchased,
}: Props) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const [tokenIdInput, setTokenIdInput] = useState<string>(defaultTokenId.toString())
  const [purchaseSaveError, setPurchaseSaveError] = useState<string | null>(null)
  const [isSavingPurchase, setIsSavingPurchase] = useState(false)
  const [purchaseSaved, setPurchaseSaved] = useState(false)
  const lastSavedHashRef = useRef<`0x${string}` | null>(null)

  // After tx is confirmed on-chain, notify backend to store purchase for this user.
  useEffect(() => {
    if (!isConfirmed) return
    if (!hash) return
    if (lastSavedHashRef.current === hash) return
    if (!isHexAddress(contractAddress)) return

    lastSavedHashRef.current = hash
    setPurchaseSaveError(null)
    setIsSavingPurchase(true)
    setPurchaseSaved(false)

    void (async () => {
      try {
        const payload = { chainId, contractAddress, quantity: 1 } as unknown as any
        await apiFetch('/setpurchase', {
          method: 'POST',
          body: payload,
        })
        setPurchaseSaved(true)
        onPurchased?.()
      } catch (e) {
        setPurchaseSaveError(e instanceof Error ? e.message : String(e))
      } finally {
        setIsSavingPurchase(false)
      }
    })()
  }, [chainId, contractAddress, hash, isConfirmed])

  const tokenIdOptions = useMemo(() => {
    if (!showTicketTypeSelector) return [] as bigint[]
    if (ticketTypeCount === undefined) return [] as bigint[]
    if (ticketTypeCount < 1n) return [] as bigint[]
    const capped = ticketTypeCount > 20n ? 20n : ticketTypeCount // avoid rendering huge lists
    return Array.from({ length: Number(capped) }, (_, i) => BigInt(i + 1))
  }, [ticketTypeCount, showTicketTypeSelector])

  function ticketLabelByTokenId(tid: bigint) {
    if (tid === 1n) return 'Thường'
    if (tid === 2n) return 'VIP'
    if (tid === 3n) return 'VVIP'
    return `Vé số ${tid.toString()}`
  }

  // Nếu không cho chọn loại vé, khóa cứng tokenId theo defaultTokenId (vd: vé số 1)
  const tokenId = useMemo(() => {
    if (!showTicketTypeSelector) return defaultTokenId
    const v = tokenIdInput.trim()
    if (!/^\d+$/.test(v)) return undefined
    try {
      return BigInt(v)
    } catch {
      return undefined
    }
  }, [defaultTokenId, showTicketTypeSelector, tokenIdInput])

  const isValidContract = isHexAddress(contractAddress)
  const canQuery = isConnected && !!address && isValidContract && tokenId !== undefined

  const { data: priceWei, isLoading: priceLoading } = useReadContract({
    address: contractAddress,
    abi: ticket1155Abi,
    functionName: 'ticketPrices',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: canQuery },
  })

  const unitPrice = typeof priceWei === 'bigint' ? priceWei : undefined
  const totalPrice = unitPrice // vì mỗi lần chỉ mua 1 vé

  const handleBuy = async () => {
    if (!isConnected || !address) return
    if (!isValidContract) return
    if (tokenId === undefined) return
    if (unitPrice === undefined) return
    setPurchaseSaved(false)
    setPurchaseSaveError(null)

    // Ticket1155: buyTicket(uint256 id) => mỗi lần call mua đúng 1 vé
    writeContract({
      address: contractAddress,
      abi: ticket1155Abi,
      functionName: 'buyTicket',
      args: [tokenId],
      value: unitPrice,
    })
  }

  if (!isConnected) {
    return (
      <div className="card">
        <h2>Mua vé</h2>
        <p style={{ color: '#888', marginTop: '1rem' }}>Vui lòng kết nối ví để mua vé</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Mua vé</h2>

      <div style={{ marginTop: '1rem', textAlign: 'left' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Thông tin vé</h3>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Loại vé</div>
            <div className="info-value">
              {showTicketTypeSelector
                ? tokenId !== undefined
                  ? ticketLabelByTokenId(tokenId)
                  : 'N/A'
                : `Vé số ${defaultTokenId.toString()}`}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Giá 1 vé</div>
            <div className="info-value">
              {priceLoading ? 'Đang tải...' : unitPrice !== undefined ? `${formatEther(unitPrice)} ETH` : 'N/A'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Tổng tiền</div>
            <div className="info-value">
              {priceLoading ? 'Đang tải...' : totalPrice !== undefined ? `${formatEther(totalPrice)} ETH` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Mua vé</h3>

        {showTicketTypeSelector && (
          <>
            {tokenIdOptions.length > 0 ? (
              <select
                value={tokenIdInput}
                onChange={(e) => setTokenIdInput(e.target.value)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  width: '100%',
                }}
              >
                {tokenIdOptions.map((tid) => (
                  <option key={tid.toString()} value={tid.toString()} style={{ color: '#111' }}>
                    {ticketLabelByTokenId(tid)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Token ID (loại vé)"
                value={tokenIdInput}
                onChange={(e) => setTokenIdInput(e.target.value)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  width: '100%',
                }}
              />
            )}
          </>
        )}

        <button
          onClick={() => void handleBuy()}
          disabled={
            !isValidContract ||
            tokenId === undefined ||
            unitPrice === undefined ||
            isPending ||
            isConfirming ||
            isSavingPurchase ||
            purchaseSaved
          }
          style={{
            marginTop: showTicketTypeSelector ? '0.75rem' : '0.25rem',
            width: '100%',
            padding: '0.95rem 1rem',
            borderRadius: '12px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
            color: '#3d2817',
            opacity:
              !isValidContract || tokenId === undefined || unitPrice === undefined || isPending || isConfirming || isSavingPurchase || purchaseSaved
                ? 0.6
                : 1,
          }}
        >
          {isPending
            ? 'Đang ký...'
            : isConfirming
              ? 'Đang chờ xác nhận...'
              : isConfirmed && isSavingPurchase
                ? 'Đang lưu purchase...'
                : purchaseSaved
                  ? 'Thành công!'
                : showTicketTypeSelector
                  ? 'Mua vé'
                  : `Mua vé số ${defaultTokenId.toString()}`}
        </button>

        {hash && <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#888' }}>Tx: {hash}</div>}
        {isSavingPurchase && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#888' }}>Đang lưu purchase...</div>
        )}
        {purchaseSaveError && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#f87171', whiteSpace: 'pre-wrap' }}>
            Lưu purchase thất bại: {purchaseSaveError}
          </div>
        )}
        {error && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#f87171', whiteSpace: 'pre-wrap' }}>
            "Người Mua Đã Hủy Giao Dịch"
          </div>
        )}
      </div>

      
    </div>
  )
}
