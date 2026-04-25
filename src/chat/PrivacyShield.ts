import { vault } from '../vault/LocalVault'

export interface ContactProof {
  walletAddress: string
  badges: string[]
  isVerified: boolean
}

export interface GatekeeperConfig {
  cyberMode: boolean
  requiredProviders: ('github' | 'amazon' | 'linkedin')[]
}

export class PrivacyShield {
  private config: GatekeeperConfig

  constructor(config: GatekeeperConfig) {
    this.config = config
  }

  updateConfig(newConfig: Partial<GatekeeperConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Determine if an inbound conversation request should be allowed.
   * Called when receiving a new Conversation object from XMTP.
   */
  async shouldAcceptInbound(walletAddress: string): Promise<boolean> {
    if (!this.config.cyberMode) return true // Gate disabled = allow all

    const contactProof = await this.getProofFor(walletAddress)
    return this.evaluateProof(contactProof)
  }

  /**
   * Evaluate if the contact meets minimum trust requirements
   */
  private evaluateProof(proof: ContactProof): boolean {
    if (this.config.requiredProviders.length === 0) return true

    const hasAllRequired = this.config.requiredProviders.every(provider =>
      proof.badges.includes(provider)
    )

    return hasAllRequired
  }

  /**
   * Fetch proof data from LocalVault for a given wallet
   */
  async getProofFor(walletAddress: string): Promise<ContactProof> {
    const credentials = await vault.getCredentials(walletAddress)
    const badges = credentials.map(c => c.type)
    const isVerified = badges.length > 0

    return {
      walletAddress,
      badges,
      isVerified,
    }
  }

  /**
   * Build a proof bundle to attach to outbound messages (for peer verification)
   */
  async buildOutboundProof(walletAddress: string): Promise<string | null> {
    const credentials = await vault.getCredentials(walletAddress)
    if (credentials.length === 0) return null

    return btoa(JSON.stringify({
      walletAddress,
      badges: credentials.map(c => c.type),
      verifiedAt: credentials[0].verifiedAt,
    }))
  }
}

// Singleton instance
export const privacyShield = new PrivacyShield({
  cyberMode: false, // Default: off (optional toggle per PRD)
  requiredProviders: ['github'], // Default minimum requirement
})
