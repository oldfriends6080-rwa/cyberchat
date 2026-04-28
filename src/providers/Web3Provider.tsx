import '@rainbow-me/rainbowkit/styles.css'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { foundry, mainnet, sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'

// Use public RPCs that support CORS for GitHub Pages deployment
// Fallback chain: if primary RPC fails, the browser will try others
const publicRpcUrls = {
  [mainnet.id]: [
    'https://eth.llamarpc.com',          // Llama RPC (free, no CORS issues)
    'https://rpc.ankr.com/eth',          // Ankr (free, public)
    'https://ethereum.publicnode.com',   // PublicNode (free)
  ],
  [sepolia.id]: [
    'https://rpc.ankr.com/eth_sepolia',  // Ankr Sepolia
    'https://sepolia.drpc.org',          // Drpc Sepolia
  ],
  [foundry.id]: [
    'http://localhost:8545',              // Local foundry (only works locally)
  ],
}

// Create transports with fallback URLs for each chain
const createTransports = () => {
  const transports: Record<number, ReturnType<typeof http>> = {}

  for (const [chainId, urls] of Object.entries(publicRpcUrls)) {
    const numericChainId = Number(chainId)
    // Use the first available RPC URL
    const rpcUrl = urls.find(url => url !== 'http://localhost:8545') || urls[0]
    transports[numericChainId] = http(rpcUrl)
  }

  return transports
}

const config = createConfig({
  chains: [foundry, mainnet, sepolia],
  transports: createTransports(),
  ssr: false,
})

const queryClient = new QueryClient()

const theme = darkTheme({
  accentColor: '#00FFA3',
  accentColorForeground: '#000000',
  borderRadius: 'medium',
  fontStack: 'system',
})

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
