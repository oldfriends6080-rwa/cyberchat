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
  const streamRef = useRef<{ stop: () => void } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    messagesRef.current = messages
    // Cleanup: remove any system messages that might have slipped through
    const hasSystem = messages.some(m =>
      typeof m.content === 'string' &&
      m.content.trim().startsWith('{') &&
      m.content.includes('"type"')
    )
    if (hasSystem) {
      const cleaned = messages.filter(m => {
        if (typeof m.content !== 'string') return true
        const trimmed = m.content.trim()
        if (trimmed.startsWith('{') && trimmed.includes('"type"')) return false
        return true
      })
      if (cleaned.length !== messages.length) {
        setMessages(cleaned)
      }
    }
  }, [messages])

  // Resolve (or create) the DM conversation once per peer
  useEffect(() => {
    if (!client || !peerAddress || !isConnected) return
    let cancelled = false
    myInboxIdRef.current = null // reset inbox cache when peer changes
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

        // Check peer is reachable via XMTP using the client's network
        try {
          const canMessageMap = await currentClient.canMessage([identifier])
          const canReach = canMessageMap.get(peerAddress.toLowerCase())
          if (canReach === false) {
            if (!cancelled) {
              setError('This address has not registered on XMTP yet')
              // Generate invitation deep link
              const origin = window.location.origin.replace(/\/$/, '')
              const inviteUrl = `${origin}/cyberchat/chat?invitee=${encodeURIComponent(peerAddress)}`
              setInviteUrl(inviteUrl)
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
          conversation = await currentClient.conversations.createDmWithIdentifier(identifier)
        }

        if (!conversation) {
          if (!cancelled) setError('Could not open a conversation with this address')
          return
        }

        if (cancelled) return
        conversationRef.current = conversation

        // Cache our own inbox ID for ownership detection
        if (!myInboxIdRef.current && currentClient) {
          myInboxIdRef.current = currentClient.inboxId!
        }

        const msgs = await conversation.messages()
        const myEthAddr = address?.toLowerCase() ?? ''
        const myInbox = (myInboxIdRef.current ?? '').toLowerCase()

        const formatted: Message[] = msgs
          .map((m: any) => {
            const content = decodeMessageContent(m)
            if (content === null) return null
            const senderEth = (m.senderAddress ?? '').toLowerCase()
            const senderInbox = (m.senderInboxId ?? '').toLowerCase()
            // isOwn if sender matches us by address OR by inboxId
            const isOwn = senderEth === myEthAddr || senderInbox === myInbox
            return {
              id: m.id,
              senderAddress: (m.senderAddress ?? m.senderInboxId ?? '') as string,
              content,
              timestamp: Number(m.sent ?? m.sentNs ?? Date.now()),
              isOwn,
            }
          })
          .filter((msg): msg is Message => msg !== null)

        if (!cancelled) setMessages(formatted)
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
      const conversation = conversationRef.current
      if (!conversation) return

      try {
        // Use XMTP's stream() method for real-time message delivery
        // It returns a StreamCloser with a stop() method
        const streamCloser = await (conversation as any).stream(
          async (msg: any) => {
            if (cancelled) return

            const content = decodeMessageContent(msg)
            if (content === null) return

            const senderEth = (msg.senderAddress ?? '').toLowerCase()
            const senderInbox = (msg.senderInboxId ?? '').toLowerCase()
            const myEthAddr = address?.toLowerCase() ?? ''
            const myInbox = (myInboxIdRef.current ?? '').toLowerCase()
            const isOwn = senderEth === myEthAddr || senderInbox === myInbox

            // Skip own messages (already displayed when sent)
            if (isOwn) return

          // Check if sender is allowed by privacy shield
          let allowed = await privacyShield.shouldAcceptInbound(senderEth || senderInbox)
          if (!allowed) {
            // Auto-add unknown sender as contact to allow first message
            // (privacy shield will treat new contacts as allowed by default)
            try {
              await vault.setContact({
                walletAddress: senderEth || senderInbox,
                localName: `Wallet ${(senderEth || senderInbox).slice(0, 6)}...`,
                verifiedBadges: [],
                updatedAt: Date.now(),
              })
              allowed = true
            } catch (e) {
              console.warn('Failed to auto-add sender as contact:', e)
            }
          }
          if (!allowed) {
            console.warn('Blocked message from unverified sender')
            return
          }

            setMessages(prev => [...prev, {
              id: msg.id,
              senderAddress: (msg.senderAddress ?? msg.senderInboxId ?? '') as string,
              content,
              timestamp: Number(msg.sent ?? msg.sentNs ?? Date.now()),
              isOwn,
            }])
          },
          () => { /* onFail callback - stream will auto-restart */ }
        )
        streamRef.current = streamCloser
      } catch (err) {
        if (!cancelled) {
          console.error('Stream error, falling back to polling:', err)
          // Fallback: simple interval poll
          pollRef.current = setInterval(async () => {
            const conv = conversationRef.current
            if (!conv) return
            try {
              const msgs = await conv.messages()
              const latest = Math.max(...messagesRef.current.map(m => m.timestamp), 0)
              const newMsgs = msgs.filter((m: any) => Number(m.sent ?? m.sentNs ?? 0) > latest)
              for (const m of newMsgs) {
                const content = decodeMessageContent(m)
                if (content === null) continue
                const senderEth = (m.senderAddress ?? '').toLowerCase()
                const senderInbox = (m.senderInboxId ?? '').toLowerCase()
                const myEthAddr = address?.toLowerCase() ?? ''
                const myInbox = (myInboxIdRef.current ?? '').toLowerCase()
                const isOwn = senderEth === myEthAddr || senderInbox === myInbox
                if (isOwn) continue
                const allowed = await privacyShield.shouldAcceptInbound(senderEth || senderInbox)
                if (!allowed) continue
                setMessages(prev => [...prev, {
                  id: m.id,
                  senderAddress: (m.senderAddress ?? m.senderInboxId ?? '') as string,
                  content,
                  timestamp: Number(m.sent ?? m.sentNs ?? Date.now()),
                  isOwn,
                }])
              }
            } catch (e) {
              console.error('Poll fallback error:', e)
            }
          }, 2000)
        }
      }
    }

    startStreaming()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.stop()
        streamRef.current = null
      }
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
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

        {inviteUrl && (
          <InviteLink url={inviteUrl} />
        )}

        {loadingConversation && !error && (
          <div className="text-center text-gray-400 text-sm">Opening secure conversation...</div>
        )}

        {messages.map((msg) => {
          // Detect system messages that slipped through: JSON-like content with 'type' field
          let looksLikeSystem = false
          if (typeof msg.content === 'string' && !msg.isOwn) {
            const trimmed = msg.content.trim()
            if (trimmed.startsWith('{') && trimmed.includes('"type"')) {
              looksLikeSystem = true
            }
          }

          return (
            <div
              key={msg.id}
              className={`flex ${looksLikeSystem ? 'justify-center' : msg.isOwn ? 'justify-end' : 'justify-start'}`}
            >
              {looksLikeSystem ? (
                <div className="px-3 py-1 bg-[#111] border border-[#00FFA3]/10 rounded-full">
                  <span className="text-xs text-gray-500">
                    {(() => {
                      try {
                        const parsed = JSON.parse(msg.content)
                        return getSystemMessageLabel(parsed)
                      } catch {
                        return 'System event'
                      }
                    })()}
                  </span>
                </div>
              ) : (
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
              )}
            </div>
          )
        })}
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
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

function decodeMessageContent(m: any): string | null {
  // XMTP v7 DecodedMessageContent union: { type: "...", content: ... }
  const content = m.content
  if (!content) return null

  // 1. Text messages: { type: "text", content: string }
  if (content.type === 'text' && typeof content.content === 'string') {
    return content.content
  }

  // 2. Markdown: { type: "markdown", content: string }
  if (content.type === 'markdown' && typeof content.content === 'string') {
    return content.content
  }

  // 3. System/conversation events — skip from chat display
  // These have types that are not user-facing messages
  const systemTypes = [
    'ConversationUpdated',
    'ConsentUpdated',
    'GroupUpdated',
    'GroupCreated',
    'GroupMemberAdded',
    'GroupMemberRemoved',
    'GroupRoleSet',
    'GroupAdminAdded',
    'GroupAdminRemoved',
    'GroupSuperAdminAdded',
    'GroupSuperAdminRemoved',
    'GroupNameSet',
    'GroupImageSetSet',
    'GroupDescriptionSet',
    'GroupDeleted',
    'MessageDeleted',
    'ReadReceipt',
    'Reaction',
    'Reply',
    'Attachment',
    'RemoteAttachment',
    'MultiRemoteAttachment',
    'TransactionReference',
    'WalletSendCalls',
    'Actions',
    'Intent',
    'deletedMessage',
    'leaveRequest',
  ]
  if (content.type && systemTypes.includes(content.type)) {
    return null
  }

  // 4. Unknown content type — as fallback, stringify (for debugging)
  try {
    return JSON.stringify(content)
  } catch {
    return '[unreadable message]'
  }
}

// Get a human-readable label for system messages
function getSystemMessageLabel(content: any): string {
  const type = content?.type
  switch (type) {
    case 'ConversationUpdated':
      return 'Conversation started'
    case 'ConsentUpdated':
      return 'Consent updated'
    case 'GroupUpdated':
      return 'Group updated'
    default:
      return `System: ${type ?? 'unknown'}`
  }
}

function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(err => {
        console.error('Failed to copy:', err)
      })
  }

  return (
    <div className="mt-4 p-3 bg-[#111] border border-amber-500/50 rounded text-xs">
      <p className="text-amber-400 mb-2">
        This user hasn't registered on XMTP yet. Copy the invite link below and share it via email, Discord, or any app. When they open it and connect their wallet, you can start chatting.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 bg-[#1A1A1A] border border-[#00FFA3]/20 rounded px-2 py-1.5 font-mono text-[10px] text-gray-300 truncate"
          onClick={e => e.currentTarget.select()}
        />
        <button
          onClick={copy}
          className="px-3 py-1.5 bg-amber-600 text-white font-bold text-xs rounded hover:bg-amber-500"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

 function BadgeDisplay({ peerAddress }: { peerAddress: string }) {
  const [badges, setBadges] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    privacyShield.getProofFor(peerAddress)
      .then(proof => {
        if (!cancelled) {
          setBadges(proof.badges)
          setLoaded(true)
        }
      })
      .catch(err => {
        console.error('Failed to load badges:', err)
        if (!cancelled) setLoaded(true)
      })
    return () => { cancelled = true }
  }, [peerAddress])

  if (!loaded) return null
  if (badges.length === 0) {
    return <span className="text-xs text-gray-500">Unverified</span>
  }

  return (
    <div className="flex gap-1">
      {badges.map(badge => (
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
