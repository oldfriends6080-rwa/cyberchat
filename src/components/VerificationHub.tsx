import { useState } from 'react'
import { useAccount } from 'wagmi'
import { VerificationStatus } from './VerificationStatus'
import { reclaimService } from '../identity/ReclaimService'

export function VerificationHub() {
  const { address } = useAccount()
  const [activeType, setActiveType] = useState<'github' | 'amazon' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startVerification = async (type: 'github' | 'amazon') => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const session = await reclaimService.startVerification(type, address)
      // Open Reclaim verification page in new tab
      window.open(session.reclaimUrl, '_blank', 'width=500,height=700')
      setActiveType(type)
    } catch (err) {
      console.error('Failed to start verification:', err)
      setError(err instanceof Error ? err.message : 'Verification failed to start')
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    {
      type: 'github' as const,
      title: 'GitHub',
      description: 'Prove your account age and Star history',
      icon: '🐙',
      recommended: true,
    },
    {
      type: 'amazon' as const,
      title: 'Amazon Prime',
      description: 'Verify your Prime membership and spending record',
      icon: '📦',
      recommended: false,
    },
    // LinkedIn reserved for future
  ]

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Verification Hub</h1>
        <p className="text-gray-400 text-sm">
          Strengthen your trust score by linking Web2 credentials
        </p>
      </header>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-center">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        {cards.map((card) => (
          <div
            key={card.type}
            className="bg-[#1A1A1A] border border-[#00FFA3]/30 rounded-lg p-5 space-y-4 hover:border-[#00FFA3] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{card.icon}</span>
                <div>
                  <h3 className="font-bold text-lg">{card.title}</h3>
                  {card.recommended && (
                    <span className="text-xs px-2 py-0.5 bg-[#00FFA3] text-black rounded">
                      Recommended
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-400">{card.description}</p>

            <VerificationStatus type={card.type} />

            <button
              onClick={() => startVerification(card.type)}
              disabled={loading || activeType === card.type}
              className={`w-full py-2 px-4 rounded font-mono text-sm transition-all ${
                loading && activeType === card.type
                  ? 'bg-gray-700 cursor-wait'
                  : 'bg-[#00FFA3] text-black hover:bg-[#00FFA3]/80'
              }`}
            >
              {loading && activeType === card.type ? 'Processing...' : 'Verify Now'}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center mt-8 text-xs text-gray-500 max-w-md mx-auto">
        <p>
          After verification, your badge will appear automatically in chat.
          Proofs are stored locally and never leave your device.
        </p>
      </div>
    </div>
  )
}
