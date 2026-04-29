import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useXMTP } from '../providers/XMTPProvider'
import { type Identifier, IdentifierKind } from '@xmtp/browser-sdk'
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
  const [loadingConversation, setLoadingConversation] = useState(true)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const conversationRef = useRef<any>(null)
  const messagesRef = useRef<Message[]>([])
  const myInboxIdRef = useRef<string | null>(null)
  const streamRef = useRef<any>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Resolve (or create) the DM conversation once per peer
  useEffect(() => {
    if (!client || !peerAddress || !isConnected) return
    let cancelled = false
    const currentClient = client

    const resolveConversation = async () => {
      setLoadingConversation(true)
      setError(null)
      conversationRef.current = null
      setMessages([])

      try {
        // Ensure contact exists in vault
        await vault.setContact({
          walletAddress: peerAddress,
          localName: `Wallet ${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)}`,
          verifiedBadges: [],
          updatedAt: Date.now(),
        })

        const identifier: Identifier = {
          identifier: peerAddress,
          identifierKind: IdentifierKind.Ethereum,
        }

        // Check peer is reachable via XMTP
        try {
          const canMessageMap = await currentClient.canMessage([identifier])
          const canReach = canMessageMap.get(peerAddress.toLowerCase())
          if (canReach === false) {
            if (!cancelled) {
              setError('This address has not registered on XMTP yet')
              const origin = window.location.origin.replace(/\/$/, '')
              setInviteUrl(`${origin}/cyberchat/chat?invitee=${encodeURIComponent(peerAddress)}`)
            }
            return
          }
        } catch (err) {
          console.warn('canMessage check failed:', err)
        }

        // Try to fetch existing DM
        let conversation = await currentClient.conversations.fetchDmByIdentifier(identifier).catch(() => null)

        // Create a new DM if none exists using createDmWithIdentifier
        if (!conversation) {
          try {
            conversation = await currentClient.conversations.createDmWithIdentifier(identifier)
          } catch (createErr) {
            console.error('DM createDmWithIdentifier failed:', createErr)
            throw createErr
          }
        }

        if (!conversation) {
          if (!cancelled) setError('Could not open a conversation with this address')
          return
        }

        if (cancelled) return
        conversationRef.current = conversation

        // Cache our own inbox ID for ownership detection
        if (!myInboxIdRef.current) {
          myInboxIdRef.current = currentClient.inboxId!
        }

        // Load initial messages
        const msgs = await conversation.messages()
        const myEthAddr = address?.toLowerCase() ?? ''
        const myInbox = (myInboxIdRef.current ?? '').toLowerCase()

        let loadedCount = 0
        const formatted: Message[] = msgs
          .map((m: any) => {
            const content = decodeMessageContent(m)
            if (content === null) return null
            const senderEth = (m.senderAddress ?? '').toLowerCase()
            const senderInbox = (m.senderInboxId ?? '').toLowerCase()
            const isOwn = senderEth === myEthAddr || senderInbox === myInbox
            loadedCount++
            return {
              id: m.id,
              senderAddress: m.senderAddress ?? m.senderInboxId ?? '',
              content,
              timestamp: Number(m.sent ?? m.sentNs ?? Date.now()),
              isOwn,
            }
          })
          .filter((msg): msg is Message => msg !== null)

        if (!cancelled) {
          setMessages(formatted)
        }
      } catch (err) {
        console.error('Failed to open conversation:', err)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to open conversation')
      } finally {
        if (!cancelled) setLoadingConversation(false)
      }
    }

    resolveConversation()
    return () => { cancelled = true }
  }, [client, peerAddress, isConnected, address])

  // Real-time message streaming using XMTP
  useEffect(() => {
    if (!client || !peerAddress) return
    let cancelled = false

    const startStreaming = async () => {
      if (!conversationRef.current) return

      try {
        // Stream all messages using client.conversations.streamAllMessages
        const stream = await client.conversations.streamAllMessages(
          async (msg: any) => {
            if (cancelled) return
            if (msg.conversationId !== conversationRef.current?.id) return

            const content = decodeMessageContent(msg)
            if (content === null) return

            const senderEth = (msg.senderAddress ?? '').toLowerCase()
            const senderInbox = (msg.senderInboxId ?? '').toLowerCase()
            const myEthAddr = address?.toLowerCase() ?? ''
            const myInbox = (myInboxIdRef.current ?? '').toLowerCase()
            const isOwn = senderEth === myEthAddr || senderInbox === myInbox
            if (isOwn) return

            let allowed = await privacyShield.shouldAcceptInbound(senderEth || senderInbox)
            if (!allowed) {
              try {
                await vault.setContact({
                  walletAddress: senderEth || senderInbox,
                  localName: `Wallet ${(senderEth || senderInbox).slice(0, 6)}...`,
                  verifiedBadges: [],
                  updatedAt: Date.now(),
                })
                allowed = true
              } catch (e) {
                console.warn('Failed to auto-add sender:', e)
              }
            }
            if (!allowed) return

            setMessages(prev => [...prev, {
              id: msg.id,
              senderAddress: msg.senderAddress ?? msg.senderInboxId ?? '',
              content,
              timestamp: Number(msg.sent ?? msg.sentNs ?? Date.now()),
              isOwn,
            }])
          },
          () => {},
          { conversationType: 0 } // DM only
        )
        streamRef.current = stream

        for await (const msg of stream) {
          if (cancelled) break

          // Only process messages for our target conversation
          if (msg.conversationId !== conversationRef.current?.id) continue

          const content = decodeMessageContent(msg)
          if (content === null) continue

          const senderEth = (msg.senderAddress ?? '').toLowerCase()
          const senderInbox = (msg.senderInboxId ?? '').toLowerCase()
          const myEthAddr = address?.toLowerCase() ?? ''
          const myInbox = (myInboxIdRef.current ?? '').toLowerCase()
          const isOwn = senderEth === myEthAddr || senderInbox === myInbox

          if (isOwn) continue

          // Auto-add unknown contacts to allow first message
          let allowed = await privacyShield.shouldAcceptInbound(senderEth || senderInbox)
          if (!allowed) {
            try {
              await vault.setContact({
                walletAddress: senderEth || senderInbox,
                localName: `Wallet ${(senderEth || senderInbox).slice(0, 6)}...`,
                verifiedBadges: [],
                updatedAt: Date.now(),
              })
              allowed = true
            } catch (e) {
              console.warn('Failed to auto-add sender:', e)
            }
          }
          if (!allowed) continue

          setMessages(prev => [...prev, {
            id: msg.id,
            senderAddress: msg.senderAddress ?? msg.senderInboxId ?? '',
            content,
            timestamp: Number(msg.sent ?? msg.sentNs ?? Date.now()),
            isOwn,
          }])
        }
      } catch (err) {
        console.error('Stream error:', err)
      }
    }

    startStreaming()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.end().catch(console.error)
        streamRef.current = null
      }
    }
  }, [client, peerAddress, address])

  const sendMessage = async () => {
    if (!input.trim() || !client || sending) return
    const conversation = conversationRef.current
    if (!conversation) {
      setError('Conversation not ready yet')
      return
    }

    setSending(true)
    setError(null)
    try {
      await conversation.sendText(input)
      setMessages(prev => [...prev, {
        id: `local-${Date.now()}`,
        senderAddress: address!,
        content: input,
        timestamp: Date.now(),
        isOwn: true,
      }])
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

        {inviteUrl && (
          <InviteLink url={inviteUrl} />
        )}

        {loadingConversation && !error && (
          <div className="text-center text-gray-400 text-sm">Opening secure conversation...</div>
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
            placeholder={loadingConversation ? 'Connecting...' : 'Type a message...'}
            className="flex-1 bg-[#1A1A1A] border border-[#00FFA3]/30 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#00FFA3]"
            disabled={sending || loadingConversation}
          />
          <button
            onClick={sendMessage}
            disabled={sending || loadingConversation || !input.trim()}
            className="px-4 py-2 bg-[#00FFA3] text-black font-bold rounded disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(console.error)
  }
  return (
    <div className="mt-4 p-3 bg-[#111] border border-amber-500/50 rounded text-xs">
      <p className="text-amber-400 mb-2">
        This user hasn't registered on XMTP yet. Copy the invite link below and share it via email, Discord, or any app.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={url} className="flex-1 bg-[#1A1A1A] border border-[#00FFA3]/20 rounded px-2 py-1.5 font-mono text-[10px] text-gray-300 truncate" onClick={e => e.currentTarget.select()} />
        <button onClick={copy} className="px-3 py-1.5 bg-amber-600 text-white font-bold text-xs rounded hover:bg-amber-500">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function decodeMessageContent(m: any): string | null {
  const content = m.content
  if (!content) return null
  if (content.type === 'text' && typeof content.content === 'string') {
    return content.content
  }
  if (content.type === 'markdown' && typeof content.content === 'string') {
    return content.content
  }
  const systemTypes = ['ConversationUpdated','ConsentUpdated','GroupUpdated','GroupCreated','GroupMemberAdded','GroupMemberRemoved','GroupRoleSet','GroupAdminAdded','GroupAdminRemoved','GroupSuperAdminAdded','GroupSuperAdminRemoved','GroupNameSet','GroupImageSetSet','GroupDescriptionSet','GroupDeleted','MessageDeleted','ReadReceipt','Reaction','Reply','Attachment','RemoteAttachment','MultiRemoteAttachment','TransactionReference','WalletSendCalls','Actions','Intent','deletedMessage','leaveRequest']
  if (content.type && systemTypes.includes(content.type)) return null
  try { return JSON.stringify(content) } catch { return '[unreadable]' }
}

function BadgeDisplay({ peerAddress }: { peerAddress: string }) {
  const [badges, setBadges] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    privacyShield.getProofFor(peerAddress).then(proof => {
      if (!cancelled) { setBadges(proof.badges); setLoaded(true) }
    }).catch(err => {
      console.error('Failed to load badges:', err)
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [peerAddress])
  if (!loaded) return null
  if (badges.length === 0) return <span className="text-xs text-gray-500">Unverified</span>
  return (
    <div className="flex gap-1">
      {badges.map(badge => (
        <span key={badge} className="text-xs px-2 py-0.5 bg-[#00FFA3]/10 border border-[#00FFA3]/30 rounded" title={`${badge} verified`}>
          {badge === 'github' ? '🐙' : badge === 'amazon' ? '📦' : '💼'} {badge}
        </span>
      ))}
    </div>
  )
}
