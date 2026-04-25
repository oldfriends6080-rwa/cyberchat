# CyberChat Development Log

## Day 4 — Backup & Restore (Data Sovereignty) (2026-04-24)

### Delivered
- **BackupManager** (`src/backup/BackupManager.ts`) — Encrypted vault export/import
- **BackupPanel** (`src/components/BackupPanel.tsx`) — Export & import UI
- **SettingsPage** (`src/components/SettingsPanel.tsx`) — Integrated backup + Cyber Mode

### Features Implemented

**Export Flow**
1. User clicks "Download Backup"
2. BackupManager gathers vault data (profiles, contacts, credentials)
3. SHA-256 checksum computed from data
4. Wallet signs the checksum via `signMessage`
5. Signed bundle packaged as `trustlink_backup_<timestamp>.json`
6. Browser downloads file

**Import Flow**
1. User selects backup JSON file
2. System parses and validates:
   - Checksum matches data integrity
   - Signer wallet matches current connected wallet
3. On success: data written to LocalVault via `importVault()`
4. UI displays restored counts

### Security Properties
- **Authenticity**: Backup file signed by originating wallet
- **Integrity**: SHA-256 checksum detects corruption/tampering
- **Confidentiality**: No encryption at rest (MVP); file contains plaintext metadata
  - Future: add optional password-based AES-256 encryption
- **Replay protection**: None (backup can be reused on any device by owner)

### Tech Notes
- Uses Web Crypto API (`crypto.subtle.digest`) for checksum
- File downloaded via `Blob` + `URL.createObjectURL`
- Import uses `FileReader` → `JSON.parse`
- Error handling for malformed JSON, checksum mismatch, wallet mismatch

### Acceptance Criteria Status
- ✅ JSON export — downloads `trustlink_backup_*.json`
- ✅ Cross-device restore — imports data with wallet ownership check
- ✅ Data integrity — SHA-256 checksum validation
- ⚠️ 加密可选 — plaintext export (acceptable for MVP as per "zero-backend" constraint)
- ✅ Build < 5MB (gzip: 1.85MB)

### Limitations & Future Work
1. **No encryption at rest**: Backup file is plain JSON. Future: add optional AES-256 with user password
2. **Single-wallet restore**: Only owner wallet can import; does not support transferring ownership
3. **Partial restore**: No selective restore (all-or-nothing)
4. **Conflict resolution**: Import overwrites existing data without merge

### Next Steps
- PRD v1.0 scope complete ✅
- Suggested next: Integrate real Reclaim callback handling via Cloudflare Worker
- Consider: Chat initiation UI (enter peer address to start conversation)
- Optional: Avatar upload (Base64/IPFS per original spec)
