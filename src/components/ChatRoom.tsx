import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useXMTP } from '../providers/XMTPProvider'
import { ChatList } from '../chat/ChatList'
import { MessageThread } from '../chat/MessageThread'
import { vault } from '../vault/LocalVault'
import type { Contact } from '../vault/LocalVault'

export function ChatRoom() {
  const { isConnected: isWalletConnected } = useAccount()
  const { isConnected, isLoading, error } = useXMTP()
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null)

  if (!isWalletConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <h2 className="text-2xl font-bold">Connect your wallet to chat</h2>
        <p className="text-gray-400 text-sm">Use the Connect button in the top right corner</p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center space-y-4">
          {isLoading && <div className="text-yellow-400">Initializing secure channel...</div>}
          {error && <div className="text-red-400">XMTP error: {error.message}</div>}
          {!isLoading && !error && <div className="text-gray-400">Connecting to XMTP network...</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar: Contact list */}
      <aside className="w-80 border-r border-[#00FFA3]/20 flex flex-col">
        <div className="p-4 border-b border-[#00FFA3]/20 space-y-3">
          <h2 className="font-bold text-lg">Contacts</h2>
          <p className="text-xs text-gray-400">Green = verified identity</p>
          <NewChatInput onSelectContact={setSelectedPeer} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChatList onSelectContact={setSelectedPeer} />
        </div>
      </aside>

      {/* Main: Message thread */}
      <main className="flex-1">
        {selectedPeer ? (
          <MessageThread peerAddress={selectedPeer} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🔒</div>
              <p>Select a contact to start messaging</p>
              <p className="text-sm mt-2">All messages are end-to-end encrypted</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function NewChatInput({ onSelectContact }: { onSelectContact: (addr: string) => void }) {
  const [input, setInput] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    vault.getAllContacts().then(setContacts).catch(console.error)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isFullAddress = input.trim().startsWith('0x') && input.trim().length === 42

  const matches = input.trim().length > 0
    ? contacts.filter(c => {
        const q = input.trim().toLowerCase()
        return (
          c.walletAddress.toLowerCase().includes(q) ||
          c.localName.toLowerCase().includes(q) ||
          c.walletAddress.slice(-4).toLowerCase() === q
        )
      })
    : []

  const handleSelect = (addr: string) => {
    setInput('')
    setShowDropdown(false)
    setHighlightedIndex(-1)
    onSelectContact(addr)
  }

  const handleSubmit = () => {
    const addr = input.trim()
    if (!addr) return
    if (!addr.startsWith('0x') || addr.length !== 42) return
    handleSelect(addr)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.min(prev + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < matches.length) {
        handleSelect(matches[highlightedIndex].walletAddress)
      } else {
        handleSubmit()
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div className="relative space-y-1">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowDropdown(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="Name or 0x... (last 4 digits)"
          className="flex-1 bg-[#111] border border-[#00FFA3]/30 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00FFA3]"
        />
        <button
          onClick={handleSubmit}
          disabled={!isFullAddress}
          className="px-3 py-1.5 bg-[#00FFA3] text-black font-bold text-xs rounded hover:bg-[#00FFA3]/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Chat
        </button>
      </div>

      {showDropdown && matches.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-[#111] border border-[#00FFA3]/30 rounded max-h-48 overflow-y-auto"
        >
          {matches.map((contact, i) => (
            <button
              key={contact.walletAddress}
              onClick={() => handleSelect(contact.walletAddress)}
              onMouseEnter={() => setHighlightedIndex(i)}
              className={`w-full px-3 py-2 text-left text-xs hover:bg-[#00FFA3]/10 ${
                i === highlightedIndex ? 'bg-[#00FFA3]/10' : ''
              }`}
            >
              <div className="font-bold text-[#00FFA3]">{contact.localName}</div>
              <div className="text-gray-400">
                {contact.walletAddress.slice(0, 6)}...{contact.walletAddress.slice(-4)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
