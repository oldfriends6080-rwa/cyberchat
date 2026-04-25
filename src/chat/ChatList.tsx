import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useXMTP } from '../providers/XMTPProvider'
import { vault } from '../vault/LocalVault'
import { privacyShield } from './PrivacyShield'

interface ContactWithProof {
  walletAddress: string
  localName: string
  badges: string[]
}

export function ChatList({ onSelectContact }: { onSelectContact: (addr: string) => void }) {
  const { address } = useAccount()
  const { client, isConnected } = useXMTP()
  const [contacts, setContacts] = useState<ContactWithProof[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConnected || !address || !client) {
      setContacts([])
      setLoading(false)
      return
    }

    const loadContacts = async () => {
      setLoading(true)
      try {
        const conversations = await client.conversations.list()
        const contactPromises = conversations.map(async (conv) => {
          const peerAddress = conv.peerAddress
          const contact = await vault.getContact(peerAddress)
          const proof = await privacyShield.getProofFor(peerAddress)

          return {
            walletAddress: peerAddress,
            localName: contact?.localName || `${peerAddress.slice(0, 6)}...`,
            badges: proof.badges,
          }
        })

        const loaded = await Promise.all(contactPromises)
        setContacts(loaded)
      } catch (err) {
        console.error('Failed to load contacts:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContacts()
  }, [client, isConnected, address])

  const getBadgeIcon = (type: string) => {
    switch (type) {
      case 'github': return '🐙'
      case 'amazon': return '📦'
      default: return '✓'
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Loading contacts...</div>
  }

  if (contacts.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No conversations yet.</p>
        <p className="text-sm mt-2">Start a chat by entering a wallet address.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-2">
      {contacts.map((contact) => (
        <button
          key={contact.walletAddress}
          onClick={() => onSelectContact(contact.walletAddress)}
          className="w-full p-3 bg-[#1A1A1A] border border-[#00FFA3]/20 rounded-lg hover:border-[#00FFA3] text-left transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-cyber-green/20 flex items-center justify-center text-lg">
                  {contact.badges.length > 0 ? getBadgeIcon(contact.badges[0]) : '👤'}
                </div>
                {contact.badges.length > 0 && (
                  <div className="absolute -bottom-1 -right-1 bg-[#00FFA3] rounded-full p-1">
                    <span className="text-xs">✓</span>
                  </div>
                )}
              </div>
              <div>
                <div className="font-bold font-mono text-sm">
                  {contact.localName}
                </div>
                <div className="text-xs text-gray-400">
                  {contact.walletAddress.slice(0, 8)}...{contact.walletAddress.slice(-4)}
                </div>
              </div>
            </div>

            {contact.badges.length > 0 && (
              <div className="flex gap-1">
                {contact.badges.map(badge => (
                  <span
                    key={badge}
                    className="text-xs px-2 py-0.5 bg-[#00FFA3]/10 border border-[#00FFA3]/30 rounded"
                    title={badge}
                  >
                    {getBadgeIcon(badge)} {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
