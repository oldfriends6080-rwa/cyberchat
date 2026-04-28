import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useXMTP } from '../providers/XMTPProvider'
import { ChatList } from '../chat/ChatList'
import { MessageThread } from '../chat/MessageThread'

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
  const [error, setError] = useState('')

  const handleStartChat = () => {
    const addr = input.trim()
    if (!addr) {
      setError('Enter a wallet address')
      return
    }
    if (!addr.startsWith('0x') || addr.length !== 42) {
      setError('Invalid Ethereum address')
      return
    }
    setError('')
    setInput('')
    onSelectContact(addr)
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleStartChat()}
          placeholder="0x... address"
          className="flex-1 bg-[#111] border border-[#00FFA3]/30 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00FFA3]"
        />
        <button
          onClick={handleStartChat}
          className="px-3 py-1.5 bg-[#00FFA3] text-black font-bold text-xs rounded hover:bg-[#00FFA3]/80"
        >
          Chat
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
