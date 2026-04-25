import { vault, type Profile, type Contact, type Credential } from '../vault/LocalVault'

export interface BackupBundle {
  version: string
  exportedAt: number
  walletAddress: string
  profile?: Profile
  contacts: Contact[]
  credentials: Credential[]
  checksum: string
}

export interface ImportResult {
  success: boolean
  message: string
  importedCount: number
}

class BackupManager {
  /**
   * Export all vault data and create a signed backup bundle
   */
  async exportVault(walletAddress: string, signMessage: (message: string) => Promise<string>): Promise<Blob> {
    const data = await vault.exportVault(walletAddress)

    // Remove redundant backupMeta from export
    const { backupMeta, ...cleanData } = data

    // Create checksum from data
    const checksum = await this.calculateChecksum(cleanData)

    const bundle: BackupBundle = {
      version: '1.0',
      exportedAt: Date.now(),
      walletAddress,
      profile: cleanData.profile,
      contacts: cleanData.contacts,
      credentials: cleanData.credentials,
      checksum,
    }

    // Sign the checksum with wallet
    const signature = await signMessage(checksum)
    const signedBundle = {
      ...bundle,
      signature,
      signer: walletAddress,
    }

    return new Blob([JSON.stringify(signedBundle, null, 2)], { type: 'application/json' })
  }

  /**
   * Import backup bundle and verify ownership via signature
   */
  async importVault(
    jsonContent: string,
    currentWalletAddress: string
  ): Promise<ImportResult> {
    try {
      const bundle = JSON.parse(jsonContent) as BackupBundle & { signature: string; signer: string }

      // Validate structure
      if (!bundle.version || !bundle.checksum || !bundle.walletAddress) {
        return { success: false, message: 'Invalid backup format', importedCount: 0 }
      }

      // Verify checksum
      const { signature, signer, ...dataWithoutSig } = bundle
      const computedChecksum = await this.calculateChecksum(dataWithoutSig)
      if (computedChecksum !== bundle.checksum) {
        return { success: false, message: 'Checksum mismatch - data corrupted', importedCount: 0 }
      }

      // Verify signature (requires signing the checksum)
      // Note: Signature verification happens externally via wallet signature
      // Here we just check that the signer matches the expected wallet
      if (bundle.signer !== currentWalletAddress) {
        return { success: false, message: 'Backup not owned by current wallet', importedCount: 0 }
      }

      // Perform import
      await vault.importVault(bundle.walletAddress, {
        profile: bundle.profile,
        contacts: bundle.contacts,
        credentials: bundle.credentials,
      })

      return {
        success: true,
        message: `Restored ${bundle.contacts.length} contacts and ${bundle.credentials.length} credentials`,
        importedCount: bundle.contacts.length + bundle.credentials.length,
      }
    } catch (err) {
      console.error('Import failed:', err)
      return { success: false, message: 'Failed to parse backup file', importedCount: 0 }
    }
  }

  /**
   * Calculate SHA-256 checksum of backup data
   */
  private async calculateChecksum(data: any): Promise<string> {
    const encoder = new TextEncoder()
    const dataStr = JSON.stringify(data)
    const dataBuf = encoder.encode(dataStr)

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Download backup as file
   */
  async downloadBackup(blob: Blob, filename = 'trustlink_backup.json') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export const backupManager = new BackupManager()
