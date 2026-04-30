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
  const myInboxIdRef = useRef<string | null>(null)
  const streamRef = useRef<any>(null)
  const cancelledRef = useRef(false)

  // Open or create conversation
  useEffect(() => {
    if (!client || !peerAddress || !isConnected) return
    cancelledRef.current = false
    const currentClient = client

    const init = async () => {
      setLoadingConversation(true)
      setError(null)
      conversationRef.current = null
      setMessages([])

      try {
        // Save contact to vault
        const addrLower = peerAddress.toLowerCase()
        await vault.setContact({
          walletAddress: addrLower,
          localName: `Wallet ${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)}`,
          verifiedBadges: [],
          updatedAt: Date.now(),
        })

        const identifier: Identifier = {
          identifier: peerAddress,
          identifierKind: IdentifierKind.Ethereum,
        }

        // Check if peer is reachable
        try {
          const canMessageMap = await currentClient.canMessage([identifier])
          const canReach = canMessageMap.get(addrLower)
          if (canReach === false) {
            if (!cancelledRef.current) {
              setError('This address has not registered on XMTP yet')
              const origin = window.location.origin.replace(/\/$/, '')
              setInviteUrl(`${origin}/cyberchat/chat?invitee=${encodeURIComponent(peerAddress)}`)
              setLoadingConversation(false)
            }
            return
          }
        } catch (err) {
          console.warn('canMessage check failed:', err)
        }

        // Retrieve or create DM conversation
        let conversation = await currentClient.conversations.fetchDmByIdentifier(identifier).catch(() => null)
        if (!conversation) {
          conversation = await currentClient.conversations.createDmWithIdentifier(identifier)
        }
        if (!conversation) {
          if (!cancelledRef.current) {
            setError('Could not open a conversation with this address')
            setLoadingConversation(false)
          }
          return
        }

        if (cancelledRef.current) return
        conversationRef.current = conversation

        // Store own inbox ID for message ownership detection
        if (!myInboxIdRef.current) {
          myInboxIdRef.current = currentClient.inboxId!
        }
        const myInbox = (myInboxIdRef.current ?? '').toLowerCase()

        // Load existing messages
        const loadedMessages = await conversation.messages()
        const formatted: Message[] = loadedMessages
          .map((m: any) => {
            const content = extractMessageText(m)
            if (content === null) return null
            const senderInbox = (m.senderInboxId ?? '').toLowerCase()
            return {
              id: m.id,
              senderAddress: m.senderInboxId ?? '',
              content,
              timestamp: Number(Number(m.sentAtNs) / 1_000_000),
              isOwn: senderInbox === myInbox,
            }
          })
          .filter((msg): msg is Message => msg !== null)

        if (!cancelledRef.current) {
          setMessages(formatted)
          setLoadingConversation(false)
        }

        // Start streaming new messages
        const handleIncoming = async (msg: any) => {
          if (cancelledRef.current) return
          if (msg.conversationId !== conversationRef.current?.id) return

          const content = extractMessageText(msg)
          if (content === null) return

          const senderInbox = (msg.senderInboxId ?? '').toLowerCase()
          const isOwn = senderInbox === myInbox
          if (isOwn) return // skip own messages (already added locally)

          // Auto-add unknown sender so privacy shield doesn't block future messages
          let allowed = await privacyShield.shouldAcceptInbound(senderInbox)
          if (!allowed) {
            try {
              await vault.setContact({
                walletAddress: senderInbox,
                localName: `Wallet ${senderInbox.slice(0, 6)}...`,
                verifiedBadges: [],
                updatedAt: Date.now(),
              })
              allowed = true
            } catch (e) {
              console.warn('Failed to auto-add sender:', e)
            }
          }
          if (!allowed) return

          setMessages(prev => {
            const exists = prev.some(m => m.id === msg.id)
            if (exists) return prev
            return [...prev, {
              id: msg.id,
              senderAddress: msg.senderInboxId ?? '',
              content,
              timestamp: Number(Number(msg.sentAtNs) / 1_000_000),
              isOwn: false,
            }]
          })
        }

        const handleStreamFail = () => {
          if (!cancelledRef.current) {
            console.error('Message stream failed')
          }
        }

        streamRef.current = (currentClient.conversations as any).streamAllMessages(
          handleIncoming,
          handleStreamFail,
          0, // ConversationType.Dm
        )
      } catch (err) {
        console.error('Failed to open conversation:', err)
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to open conversation')
          setLoadingConversation(false)
        }
      }
    }

    init()

    return () => {
      cancelledRef.current = true
      if (streamRef.current) {
        streamRef.current.end()
        streamRef.current = null
      }
    }
  }, [client, peerAddress, isConnected])

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
      await conversation.sendText(input.trim())

      setMessages(prev => [...prev, {
        id: `local-${Date.now()}`,
        senderAddress: address ?? '',
        content: input.trim(),
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

  if (loadingConversation) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Opening secure conversation...
      </div>
    )
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="text-red-400 text-center">{error}</p>
        {inviteUrl && <InviteLink url={inviteUrl} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#00FFA3]/20 flex justify-between items-center">
        <div>
          <div className="font-bold font-mono text-sm">
            {peerAddress.slice(0, 6)}...{peerAddress.slice(-4)}
          </div>
          <div className="flex gap-2 mt-1">
            <BadgeDisplay walletAddress={peerAddress} />
          </div>
        </div>
        {address && (
          <div className="text-xs text-gray-500 font-mono">
            You: {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && messages.length > 0 && (
          <div className="p-3 bg-red-900/30 border border-red-500 rounded text-red-400 text-center text-sm">
            {error}
          </div>
        )}
        {inviteUrl && messages.length === 0 && (
          <InviteLink url={inviteUrl} />
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
              <div className="text-sm break-words">{msg.content}</div>
              <div className={`text-xs mt-1 ${msg.isOwn ? 'text-black/60' : 'text-gray-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#00FFA3]/20">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); sendMessage() }
            }}
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

/* ── Helpers ── */

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

/**
 * Extract human-readable text from an XMTP v7 DecodedMessage.
 * Handles the union content type: { type: "text", content: string }
 * Returns null for system messages that should be hidden.
 */
function extractMessageText(m: any): string | null {
  const content = m.content
  if (!content) return null

  // Text and markdown messages
  if (content.type === 'text' && typeof content.content === 'string') {
    return content.content
  }
  if (content.type === 'markdown' && typeof content.content === 'string') {
    return content.content
  }

  // System message types to skip
  const systemTypes = [
    'ConversationUpdated', 'ConsentUpdated', 'GroupUpdated', 'GroupCreated',
    'GroupMemberAdded', 'GroupMemberRemoved', 'GroupRoleSet',
    'GroupAdminAdded', 'GroupAdminRemoved', 'GroupSuperAdminAdded',
    'GroupSuperAdminRemoved', 'GroupNameSet', 'GroupDescriptionSet',
    'GroupDeleted', 'MessageDeleted', 'ReadReceipt', 'Reaction', 'Reply',
    'Attachment', 'RemoteAttachment', 'MultiRemoteAttachment',
    'TransactionReference', 'WalletSendCalls', 'Actions', 'Intent',
    'deletedMessage', 'leaveRequest',
  ]
  if (content.type && systemTypes.includes(content.type)) {
    return null
  }

  // Fallback: stringify unknown content for debugging
  try { return JSON.stringify(content) } catch { return '[unreadable]' }
}

function BadgeDisplay({ walletAddress }: { walletAddress: string }) {
  const [badges, setBadges] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    privacyShield.getProofFor(walletAddress).then(proof => {
      if (!cancelled) {
        setBadges(proof.badges)
        setLoaded(true)
      }
    }).catch(err => {
      console.error('Failed to load badges:', err)
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [walletAddress])

  if (!loaded) return null
  if (badges.length === 0) {
    return <span className="text-xs text-gray-500">Unverified</span>
  }
  const getIcon = (type: string) => {
    switch (type) {
      case 'github': return '🐙'
      case 'amazon': return '📦'
      default: return '💼'
    }
  }
  return (
    <div className="flex gap-1">
      {badges.map(badge => (
        <span
          key={badge}
          className="text-xs px-2 py-0.5 bg-[#00FFA3]/10 border border-[#00FFA3]/30 rounded"
          title={`${badge} verified`}
        >
          {getIcon(badge)} {badge}
        </span>
      ))}
    </div>
  )
}
