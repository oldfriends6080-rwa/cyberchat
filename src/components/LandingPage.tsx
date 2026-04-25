import { useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function LandingPage() {
  const [index, setIndex] = useState(0)
  const texts = [
    'Verify your Taobao 88VIP',
    'Prove your Google employment',
    'Protect your privacy',
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [texts.length])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-wider">
          <span className="text-[#00FFA3]">TRUST</span>
          <span className="text-white">LINK</span>
        </h1>
        <p className="text-gray-400 text-sm">
          Decentralized Privacy Communication with Web2 Credit Backing
        </p>
      </div>

      <div className="flex justify-center">
        <ConnectButton />
      </div>

      <div className="text-center text-xs text-gray-500 h-8">
        <span>{texts[index]}</span>
      </div>
    </div>
  )
}
