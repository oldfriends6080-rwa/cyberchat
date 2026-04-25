import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Web3Provider } from './providers/Web3Provider'
import { XMTPProvider } from './providers/XMTPProvider'
import { LandingPage } from './components/LandingPage'
import { ChatRoom } from './components/ChatRoom'
import { VerificationHub } from './components/VerificationHub'
import { SettingsPanel } from './components/SettingsPanel'
import { useAccount } from 'wagmi'

function Navbar() {
  const location = useLocation()
  const { isConnected } = useAccount()

  if (!isConnected) return null

  const links = [
    { to: '/chat', label: 'Chat' },
    { to: '/verify', label: 'Verify' },
    { to: '/settings', label: 'Settings' },
  ]

  return (
    <nav className="border-b border-[#00FFA3]/20 p-2">
      <div className="flex justify-center space-x-4">
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`px-4 py-2 text-sm font-mono transition-colors ${
              location.pathname === link.to
                ? 'text-[#00FFA3] border-b-2 border-[#00FFA3]'
                : 'text-gray-400 hover:text-[#00FFA3]'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

function App() {
  return (
    <Web3Provider>
      <XMTPProvider>
        <BrowserRouter>
          <div className="app min-h-screen bg-[#1A1A1A] text-[#00FFA3] font-mono">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/chat" element={<><Navbar /><ChatRoom /></>} />
              <Route path="/verify" element={<><Navbar /><VerificationHub /></>} />
              <Route path="/settings" element={<><Navbar /><SettingsPanel /></>} />
            </Routes>
          </div>
        </BrowserRouter>
      </XMTPProvider>
    </Web3Provider>
  )
}

export default App
