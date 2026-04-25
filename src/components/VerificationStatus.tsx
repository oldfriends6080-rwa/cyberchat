import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { vault } from '../vault/LocalVault'

type VerificationStatus = 'idle' | 'pending' | 'verifying' | 'success' | 'failed'

interface StatusInfo {
  status: VerificationStatus
  message: string
  progress?: number
}

export function useVerificationStatus(type: 'github' | 'amazon') {
  const { address } = useAccount()
  const [info, setInfo] = useState<StatusInfo>({ status: 'idle', message: 'Not started' })

  useEffect(() => {
    if (!address) {
      setInfo({ status: 'idle', message: 'Connect wallet to verify' })
      return
    }

    const checkStatus = async () => {
      const credentials = await vault.getCredentials(address)
      const cred = credentials.find(c => c.type === type)

      if (cred) {
        setInfo({
          status: 'success',
          message: `${type.toUpperCase()} verified`,
        })
        return
      }

      const sessionProfile = await vault.getProfile(`${address}-session-${type}`)
      if (sessionProfile?.avatarBase64) {
        try {
          const session = JSON.parse(atob(sessionProfile.avatarBase64))
          const timeSince = Date.now() - session.createdAt

          if (timeSince < 10 * 60 * 1000) { // 10 min window
            setInfo({
              status: 'verifying',
              message: 'Waiting for proof submission...',
            })
            const poll = setInterval(async () => {
              const updatedCreds = await vault.getCredentials(address)
              if (updatedCreds.find(c => c.type === type)) {
                setInfo({ status: 'success', message: `${type.toUpperCase()} verified!` })
                clearInterval(poll)
              }
            }, 2000)
            return
          }
        } catch { /* malformed session */ }
      }

      setInfo({ status: 'idle', message: 'Ready to verify' })
    }

    checkStatus()
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
