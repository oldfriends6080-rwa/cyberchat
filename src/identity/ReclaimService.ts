import { reclaimprotocol } from '@reclaimprotocol/reclaim-sdk'
import { vault } from '../vault/LocalVault'

type VerificationType = 'github' | 'amazon' | 'linkedin'

interface VerificationSession {
  sessionId: string
  callbackId: string
  reclaimUrl: string
  expectedProofs: string
  type: VerificationType
  createdAt: number
  mode: 'mock' | 'production' // 区分轮询策略
}

export class ReclaimService {
  private reclaim: reclaimprotocol.Reclaim
  private useMock: boolean
  private relayUrl: string

  constructor(useMock: boolean = false, relayUrl?: string) {
    this.reclaim = new reclaimprotocol.Reclaim()
    this.useMock = useMock
    this.relayUrl = relayUrl || import.meta.env.VITE_RECLAIM_RELAY_URL || ''
    // App ID reserved for future Reclaim SDK integration (if needed)
  }

  /**
   * 启动验证流程（生产模式：使用 Cloudflare Worker relay）
   */
  async startVerification(type: VerificationType, walletAddress: string): Promise<VerificationSession> {
    if (this.useMock) {
      const mockSession: VerificationSession = {
        sessionId: `mock-${Date.now()}`,
        callbackId: `mock-callback-${Date.now()}`,
        reclaimUrl: `https://reclaim.app/callback?mock=true&type=${type}`,
        expectedProofs: JSON.stringify([{ provider: type, field: 'verified' }]),
        type,
        createdAt: Date.now(),
        mode: 'mock',
      }

      await vault.setProfile({
        id: `${walletAddress}-session-${type}`,
        displayName: `session-${mockSession.sessionId}`,
        createdAt: mockSession.createdAt,
        avatarBase64: btoa(JSON.stringify(mockSession)),
      })

      // Mock 模式：3秒后自动生成 proof
      setTimeout(async () => {
        const mockProof = {
          id: mockSession.sessionId,
          type,
          ownerPublicKey: walletAddress,
          timestampS: String(Date.now()),
          witnessAddresses: ['0xMockWitness'],
          signatures: ['0xMockSignature'],
          extractedParameterValues: { isVerified: 1 },
          epoch: 1,
          identifier: type,
        }
        await this.saveVerifiedProof(walletAddress, type, mockProof, mockProof.extractedParameterValues)
      }, 3000)

      return mockSession
    }

    // 生产模式：使用 Cloudflare Worker 作为 callback 端点
    const baseCallbackUrl = `${this.relayUrl}/callback`

    let requestedProofs: any[]

    if (type === 'github') {
      requestedProofs = [
        new this.reclaim.CustomProvider({
          provider: 'github-commits',
          payload: {
            type: 'github-commits',
            repository: 'reclaimprotocol/reclaim-js',
            searchQuery: {
              keywords: [],
              qualifiers: { author: [walletAddress.slice(2, 42)] },
            },
          },
        }),
      ]
    } else if (type === 'amazon') {
      requestedProofs = [
        new this.reclaim.HttpsProvider({
          name: 'Amazon Prime',
          logoUrl: 'https://www.amazon.com/favicon.ico',
          url: 'https://www.amazon.com/gp/prime',
          loginUrl: 'https://www.amazon.com/ap/signin',
          loginCookies: [],
          responseSelection: [{ responseMatch: 'Prime' }],
          useZK: true,
        }),
      ]
    } else {
      throw new Error(`Unsupported verification type: ${type}`)
    }

    const request = this.reclaim.requestProofs({
      title: `CyberChat - ${type.toUpperCase()} Verification`,
      baseCallbackUrl,
      requestedProofs,
      contextMessage: `Verify your ${type} identity for TrustLink`,
      contextAddress: walletAddress,
    })

    const reclaimUrl = await request.getReclaimUrl({ shortened: true })
    const { callbackId, expectedProofsInCallback } = request

    const session: VerificationSession = {
      sessionId: request.id,
      callbackId,
      reclaimUrl,
      expectedProofs: expectedProofsInCallback,
      type,
      createdAt: Date.now(),
      mode: 'production',
    }

    // 存储 session（包含 claimId 用于后续轮询）
    await vault.setProfile({
      id: `${walletAddress}-session-${type}`,
      displayName: `session-${session.sessionId}`,
      createdAt: session.createdAt,
      avatarBase64: btoa(JSON.stringify(session)),
    })

    return session
  }

  /**
   * 轮询 Cloudflare Worker 查询 proof 是否已就绪
   * @param claimId Cloudflare Worker 返回的 claimId（从 session 中提取）
   */
  async pollForProof(claimId: string): Promise<any | null> {
    if (this.useMock) {
      // Mock 模式：直接返回 mock proof
      return {
        proofs: [{
          id: `mock-${Date.now()}`,
          type: 'github',
          ownerPublicKey: '0xMock',
          timestampS: String(Date.now()),
          witnessAddresses: ['0xMockWitness'],
          signatures: ['0xMockSignature'],
          extractedParameterValues: { isVerified: 1 },
          epoch: 1,
          identifier: 'github',
        }],
        signer: '0xMockSigner',
      }
    }

    try {
      const response = await fetch(`${this.relayUrl}/proof-status?claimId=${claimId}`)
      const data = await response.json()

      if (data.status === 'ready') {
        return data
      }
      return null
    } catch (err) {
      console.error('Poll failed:', err)
      return null
    }
  }

  async verifyProof(callbackId: string, submittedProofs: any[]): Promise<boolean> {
    if (this.useMock) return true
    try {
      return await this.reclaim.verifyCorrectnessOfProofs(callbackId, submittedProofs)
    } catch (err) {
      console.error('Proof verification failed:', err)
      return false
    }
  }

  extractValues(expectedProofs: string, proofs: any[]): Record<string, string | number> {
    if (this.useMock) {
      return { isVerified: 1 }
    }
    try {
      // @ts-ignore
      return this.reclaim.utils.extractParameterValuesFromRegex(expectedProofs, proofs)
    } catch (err) {
      console.error('Failed to extract values:', err)
      return {}
    }
  }

  async saveVerifiedProof(
    walletAddress: string,
    type: VerificationType,
    proof: any,
    extractedValues: Record<string, string | number>
  ): Promise<void> {
    const credential = {
      id: `${walletAddress}-${type}`,
      type,
      proofJson: JSON.stringify(proof),
      metadata: extractedValues,
      verifiedAt: Date.now(),
    }
    await vault.addCredential(credential)
  }

  async getCredentials(walletAddress: string): Promise<any[]> {
    return vault.getCredentials(walletAddress)
  }
}

// 生产环境实例（useMock=false）
// 根据环境决定使用 Mock 还是 Production 模式
const isDev = import.meta.env.DEV
export const reclaimService = new ReclaimService(
  isDev, // DEV 模式：useMock=true（演示用）；PROD：useMock=false（真实回调）
  isDev ? undefined : import.meta.env.VITE_RECLAIM_RELAY_URL
)
