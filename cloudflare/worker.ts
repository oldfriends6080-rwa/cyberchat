// Cloudflare Worker: Reclaim Callback Relay
// 设计原则：无状态 + 短期缓存 + 签名验证

export interface Env {
  // 可选：使用 KV 存储证明（短暂 TTL，符合无隐私数据保留原则）
  PROOF_CACHE?: KVNamespace
}

// 允许的 Reclaim AppID（生产环境从环境变量读取）
const ALLOWED_APP_ID = 'cyberchat-prod-2026'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS 头部
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Signature',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // POST /callback — 接收 Reclaim 的 proof 回调
    if (path === '/callback' && request.method === 'POST') {
      try {
        const body = await request.json()
        const { proofs, callbackId, sessionId, signer } = body

        // 1. 验证 Reclaim 签名（可选，依赖 Reclaim 官方签名）
        // 实际生产应验证 Reclaim 的 JWT 或 signed payload

        // 2. 缓存 proof 到 KV（5分钟 TTL）
        const cacheKey = `proof:${callbackId}:${sessionId}`
        if (env.PROOF_CACHE) {
          await env.PROOF_CACHE.put(cacheKey, JSON.stringify({
            proofs,
            receivedAt: Date.now(),
            signer,
          }), {
            expirationTtl: 300 // 5 minutes
          })
        }

        // 3. 返回前端可轮询的 claimId
        return new Response(JSON.stringify({
          status: 'received',
          claimId: cacheKey,
          message: 'Proof stored. Frontend should poll /proof-status with claimId.',
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // GET /proof-status?claimId=xxx — 前端轮询查询 proof 状态
    if (path === '/proof-status' && request.method === 'GET') {
      const claimId = url.searchParams.get('claimId')
      if (!claimId) {
        return new Response(JSON.stringify({ error: 'claimId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (env.PROOF_CACHE) {
        const cached = await env.PROOF_CACHE.get(claimId)
        if (cached) {
          const data = JSON.parse(cached)
          return new Response(JSON.stringify({
            status: 'ready',
            proofs: data.proofs,
            signer: data.signer,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      return new Response(JSON.stringify({ status: 'pending' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('CyberChat Reclaim Relay', { status: 200 })
  },
}
