import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useXMTP } from '../providers/XMTPProvider'
import { IdentifierKind } from '@xmtp/browser-sdk'
import { vault } from '../vault/LocalVault'
import { privacyShield } from './PrivacyShield'

interface Message {
  id: string
  senderAddress: string
  content: string
  timestamp: number
  isOwn: boolean
}

export function MessageThread({ peerAddress }: { peerAddress: string }) {
  const { address } = useAccount()
  const { client, isConnected } = useXMTP()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load initial messages
  useEffect(() => {
    if (!client || !peerAddress || !isConnected) return

     const loadMessages = async () => {
       try {
         const conversation = await client.conversations.fetchDmByIdentifier({
           identifier: peerAddress,
           identifierKind: IdentifierKind.Ethereum,
         })
         if (!conversation) return

         // Ensure contact exists in vault
         await vault.setContact({
           walletAddress: peerAddress,
           localName: `Wallet ${peerAddress.slice(0, 6)}...`,
           verifiedBadges: [],
           updatedAt: Date.now(),
         })

         const msgs = await conversation.messages()

         const formatted = msgs.map((m: any) => ({
           id: m.id,
           senderAddress: m.senderAddress,
           content: m.content,
           timestamp: m.sent || Date.now(),
           isOwn: m.senderAddress?.toLowerCase() === address?.toLowerCase(),
         }))

        setMessages(formatted)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }

    loadMessages()
  }, [client, peerAddress, isConnected, address])

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!client || !peerAddress) return

     pollRef.current = setInterval(async () => {
       try {
         const conversation = await client.conversations.fetchDmByIdentifier({
           identifier: peerAddress,
           identifierKind: IdentifierKind.Ethereum,
         })
         if (!conversation) return
         const msgs = await conversation.messages()
         const latestTimestamp = Math.max(...messages.map(m => m.timestamp), 0)

         const newMsgs = msgs.filter((m: any) => {
           const ts = m.sent || 0
           return ts > latestTimestamp
         })

        if (newMsgs.length > 0) {
          newMsgs.forEach(async (m: any) => {
            const allowed = await privacyShield.shouldAcceptInbound(m.senderAddress)
            if (!allowed) {
              console.warn('Blocked message from unverified sender')
              setError('Blocked: Sender must be verified')
              return
            }

            setMessages(prev => [...prev, {
              id: m.id,
              senderAddress: m.senderAddress,
              content: m.content,
              timestamp: m.sent || Date.now(),
              isOwn: false,
            }])
          })
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [client, peerAddress, messages])

   const sendMessage = async () => {
     if (!input.trim() || !client || sending) return

     setSending(true)
     setError(null)

    try {
      const conversation = await client.conversations.fetchDmByIdentifier({
        identifier: peerAddress,
        identifierKind: IdentifierKind.Ethereum,
      })
      if (!conversation) {
        setError('Conversation not found')
        return
      }
      const proof = await privacyShield.buildOutboundProof(address!)
      // @ts-ignore - XMTP supports metadata in options
      await conversation.send(input, { metadata: proof ? { 'x-cyber-proof': proof } : {} })

      const newMsg: Message = {
        id: `local-${Date.now()}`,
        senderAddress: address!,
        content: input,
        timestamp: Date.now(),
        isOwn: true,
      }

      setMessages(prev => [...prev, newMsg])
      setInput('')
    } catch (err) {
      console.error('Send failed:', err)
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#00FFA3]/20 flex justify-between items-center">
        <div>
          <div className="font-bold font-mono text-sm">
            {peerAddress.slice(0, 6)}...{peerAddress.slice(-4)}
          </div>
          <div className="flex gap-2 mt-1">
            <BadgeDisplay peerAddress={peerAddress} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500 rounded text-red-400 text-center">
            {error}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                msg.isOwn
                  ? 'bg-[#00FFA3] text-black'
                  : 'bg-[#1A1A1A] border border-[#00FFA3]/20'
              }`}
            >
              <div className="text-sm">{msg.content}</div>
              <div className={`text-xs mt-1 ${msg.isOwn ? 'text-black/60' : 'text-gray-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-[#00FFA3]/20">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-[#1A1A1A] border border-[#00FFA3]/30 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#00FFA3]"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="px-4 py-2 bg-[#00FFA3] text-black font-bold rounded disabled:opacity-50"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

async function BadgeDisplay({ peerAddress }: { peerAddress: string }) {
  const proof = await privacyShield.getProofFor(peerAddress)

  if (proof.badges.length === 0) {
    return <span className="text-xs text-gray-500">Unverified</span>
  }

  return (
    <div className="flex gap-1">
      {proof.badges.map(badge => (
        <span
          key={badge}
          className="text-xs px-2 py-0.5 bg-[#00FFA3]/10 border border-[#00FFA3]/30 rounded"
          title={`${badge} verified`}
        >
          {badge === 'github' ? '🐙' : badge === 'amazon' ? '📦' : '💼'} {badge}
        </span>
      ))}
    </div>
  )
}
