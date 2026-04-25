import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useXMTP } from '../providers/XMTPProvider'
import { ChatList } from '../chat/ChatList'
import { MessageThread } from '../chat/MessageThread'

export function ChatRoom() {
  const { address } = useAccount()
  const { isConnected, isLoading, error } = useXMTP()
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null)

  if (!address) return <div className="p-8 text-center">Wallet disconnected</div>

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
        <div className="p-4 border-b border-[#00FFA3]/20">
          <h2 className="font-bold text-lg">Contacts</h2>
          <p className="text-xs text-gray-400 mt-1">Green = verified identity</p>
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
