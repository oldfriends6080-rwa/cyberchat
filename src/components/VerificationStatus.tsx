import { useEffect, useState, useRef } from 'react'
import { useAccount } from 'wagmi'
import { vault } from '../vault/LocalVault'
import { reclaimService } from '../identity/ReclaimService'

type VerificationStatus = 'idle' | 'pending' | 'verifying' | 'success' | 'failed'

interface StatusInfo {
  status: VerificationStatus
  message: string
  progress?: number
}

export function useVerificationStatus(type: 'github' | 'amazon') {
  const { address } = useAccount()
  const [info, setInfo] = useState<StatusInfo>({ status: 'idle', message: 'Not started' })
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!address) {
      setInfo({ status: 'idle', message: 'Connect wallet to verify' })
      return
    }

    const checkStatus = async () => {
      // Check credentials first
      const credentials = await vault.getCredentials(address)
      const cred = credentials.find(c => c.type === type)

      if (cred) {
        setInfo({
          status: 'success',
          message: `${type.toUpperCase()} verified`,
        })
        return
      }

      // Check for active session
      const sessionProfile = await vault.getProfile(`${address}-session-${type}`)
      if (sessionProfile?.avatarBase64) {
        try {
          const session = JSON.parse(atob(sessionProfile.avatarBase64))
          const timeSince = Date.now() - session.createdAt

          if (timeSince < 15 * 60 * 1000) { // 15 min window
            setInfo({
              status: 'verifying',
              message: 'Waiting for proof submission...',
            })

            const poll = setInterval(async () => {
              // 1. Check local vault (all modes)
              const updatedCreds = await vault.getCredentials(address)
              const found = updatedCreds.find(c => c.type === type)
              if (found) {
                setInfo({ status: 'success', message: `${type.toUpperCase()} verified!` })
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
                return
              }

              // 2. Production mode: poll Cloudflare Worker
              if (session.mode === 'production' && session.callbackId) {
                const result = await reclaimService.pollForProof(session.callbackId)
                if (result?.proofs) {
                  const extracted = reclaimService.extractValues(session.expectedProofs, result.proofs)
                  await reclaimService.saveVerifiedProof(address, type, result.proofs[0], extracted)
                  setInfo({ status: 'success', message: `${type.toUpperCase()} verified!` })
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
                }
              }
              // Mock mode relies on setTimeout auto-save
            }, 3000)

            pollIntervalRef.current = poll
            return
          }
        } catch (err) {
          console.error('Session parse error:', err)
        }
      }

      setInfo({ status: 'idle', message: 'Ready to verify' })
    }

    checkStatus()

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [address, type])

  return info
}

export function VerificationStatus({ type }: { type: 'github' | 'amazon' }) {
  const info = useVerificationStatus(type)

  const getColor = () => {
    switch (info.status) {
      case 'pending':
      case 'verifying': return 'text-yellow-400'
      case 'success': return 'text-[#00FFA3]'
      case 'failed': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const getSpinner = () => {
    if (info.status !== 'verifying' && info.status !== 'pending') return null
    return (
      <div className="inline-block w-4 h-4 border-2 border-current border-t-transparent animate-spin mr-2" />
    )
  }

  const getBadge = () => {
    if (info.status !== 'success') return null
    return (
      <span className="ml-2 px-2 py-0.5 text-xs bg-[#00FFA3] text-black font-bold rounded">
        ✓ Verified
      </span>
    )
  }

  return (
    <div className={`flex items-center text-sm ${getColor()}`}>
      {getSpinner()}
      <span>{info.message}</span>
      {getBadge()}
    </div>
  )
}
