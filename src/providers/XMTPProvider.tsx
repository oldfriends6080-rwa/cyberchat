import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { Client, IdentifierKind, type XmtpEnv } from '@xmtp/browser-sdk'
import { useAccount, useWalletClient } from 'wagmi'
import { hexToBytes } from 'viem'
import { vault } from '../vault/LocalVault'

interface XMTPContextType {
  client: Client | null
  isConnected: boolean
  isLoading: boolean
  error: Error | null
}

const XMTPContext = createContext<XMTPContextType>({
  client: null,
  isConnected: false,
  isLoading: false,
  error: null,
})

export function XMTPProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [client, setClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    if (!walletClient || !address) {
      if (!cancelledRef.current) setClient(null)
      return
    }

    const initXMTP = async () => {
      setIsLoading(true)
      setError(null)
      try {
        if (!walletClient || !address) {
          return
        }

        // Create a signer compatible with XMTP Browser SDK
        const signer = {
          type: 'EOA' as const,
          getIdentifier: async () => ({
            identifier: address,
            identifierKind: IdentifierKind.Ethereum,
          }),
          signMessage: async (message: string): Promise<Uint8Array> => {
            // message is hex string; forward to wallet for signature
            const signature = await walletClient.signMessage({ message })
            // Convert hex signature to Uint8Array
            return hexToBytes(signature)
          },
        }

        const xmtpEnv = (import.meta.env.VITE_XMTP_ENV || 'dev') as XmtpEnv
        const xmtpClient = await Client.create(signer, { env: xmtpEnv } as any)
        if (!cancelledRef.current) {
          setClient(xmtpClient as any)
          await vault.setProfile({
            id: address,
            displayName: `Wallet ${address.slice(0, 6)}...`,
            createdAt: Date.now(),
          })
        }
      } catch (err) {
        if (!cancelledRef.current) {
          console.error('XMTP init failed:', err)
          setError(err instanceof Error ? err : new Error('XMTP init failed'))
        }
      } finally {
        if (!cancelledRef.current) setIsLoading(false)
      }
    }

    initXMTP()

    return () => {
      cancelledRef.current = true
    }
  }, [walletClient, address])

  return (
    <XMTPContext.Provider value={{ client, isConnected: !!client, isLoading, error }}>
      {children}
    </XMTPContext.Provider>
  )
}

export const useXMTP = () => useContext(XMTPContext)
