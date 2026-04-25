# CyberChat / TrustLink (MVP)

> Decentralized Privacy Communication with Web2 Credit Backing

基于 Web2 真实信用背书的去中心化隐私通信器。通过 Reclaim 协议将 Web2 资产/职业背景引入 Web3 Chat，解决匿名信任危机。

## Tech Stack

- **Frontend**: Vite + React + TypeScript + TailwindCSS v4
- **Web3**: Wagmi v2 + Viem + RainbowKit
- **Messaging**: XMTP SDK (end-to-end encryption)
- **Identity**: Reclaim Protocol SDK (zk-TLS proofs)
- **Storage**: IndexedDB (via Dexie) + JSON export/import
- **Deployment**: GitHub Pages (static)

## Architecture

```
src/
├── vault/LocalVault.ts         # IndexedDB abstraction (profiles, contacts, credentials)
├── providers/
│   ├── Web3Provider.tsx        # Wagmi v2 + RainbowKit + React Query
│   └── XMTPProvider.tsx        # XMTP client lifecycle (v13)
├── components/
│   ├── LandingPage.tsx         # Wallet connect + tagline carousel
│   ├── ChatRoom.tsx            # Dual-pane chat UI
│   ├── ChatList.tsx            # Contact list with verification badges
│   ├── MessageThread.tsx       # Encrypted messaging (polling-based)
│   ├── VerificationHub.tsx     # Reclaim verification cards (GitHub/Amazon)
│   ├── VerificationStatus.tsx  # Real-time badge status hook
│   ├── SettingsPanel.tsx       # Cyber Mode toggle + required provider
│   └── BackupPanel.tsx         # Encrypted export/import with wallet signature
├── identity/
│   └── ReclaimService.ts       # Reclaim SDK wrapper (mock + real modes)
├── chat/
│   ├── PrivacyShield.ts        # Gatekeeper middleware (inbound filter + outbound proof)
│   ├── ChatList.tsx
│   └── MessageThread.tsx
└── backup/
    └── BackupManager.ts        # Vault export/import with SHA-256 checksum + signature
```

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 (or your Vite port).

## Build & Deploy

```bash
npm run build
npm run preview
```

Push to `main` → GitHub Actions auto-deploys to GitHub Pages.

## Project Status

**Day 1–3 Complete ✅**  
- Vite + React + TypeScript + TailwindCSS v4
- Wagmi v2 + RainbowKit (dark Cyberpunk theme)
- XMTP v13 messaging (dev environment)
- Reclaim verification (mock mode for GitHub/Amazon)
- PrivacyShield gatekeeping (Cyber Mode)
- IndexedDB vault (profiles, contacts, credentials)
- GitHub Actions deployment

**Day 4 Complete ✅**  
- Encrypted backup export (wallet-signed JSON)
- Cross-device restore with signature verification
- SHA-256 checksum validation

**Build**  
- JS gzipped: ~1.85 MB (well under 5 MB limit)
- CSP-compliant (no eval in app code)

## Security & Privacy

- **Zero-server**: All data stored locally; no backend API
- **End-to-end encryption**: XMTP messages never touch centralized servers
- **ZK proofs**: Reclaim credentials stored as proofs, not raw Web2 data
- **User sovereignty**: Backup files encrypted with wallet signature; user controls restore

## License

MIT
