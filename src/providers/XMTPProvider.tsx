import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { Client } from '@xmtp/xmtp-js'
import { useAccount, useWalletClient } from 'wagmi'
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
        // XMTP expects an ethers.js Signer-compatible object
        // WalletClient from Wagmi v2 works as a compatible signer in practice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xmtpClient = await Client.create(walletClient as any, { env: 'dev' })
        if (!cancelledRef.current) {
          setClient(xmtpClient)
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
