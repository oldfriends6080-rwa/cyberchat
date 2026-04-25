#!/usr/bin/env bash
set -e

echo "🚀 Deploying Cloudflare Worker for CyberChat..."

# 检查 wrangler
if ! command -v wrangler &> /dev/null; then
  echo "❌ wrangler not found. Install with: npm install -g wrangler"
  exit 1
fi

# 检查是否登录
if ! wrangler whoami &> /dev/null; then
  echo "🔑 Please login to Cloudflare first:"
  wrangler login
fi

# 创建 KV 命名空间（如不存在）
echo "📦 Creating KV namespace..."
KV_ID=$(wrangler kv:namespace create "PROOF_CACHE" --json | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$KV_ID" ]; then
  echo "❌ Failed to create KV namespace"
  exit 1
fi
echo "✅ KV Namespace ID: $KV_ID"

# 更新 wrangler.toml
echo "🔧 Updating wrangler.toml with KV ID..."
sed "s/YOUR_KV_ID_HERE/$KV_ID/g" cloudflare/wrangler.toml > cloudflare/wrangler.toml.tmp
mv cloudflare/wrangler.toml.tmp cloudflare/wrangler.toml

# 部署 Worker
echo "🚀 Deploying Worker..."
cd cloudflare
wrangler deploy

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables in Cloudflare Dashboard:"
echo "   VITE_RECLAIM_RELAY_URL = https://<your-worker>.workers.dev"
echo "   RECLAIM_WEBHOOK_SECRET = <your-secret>"
echo ""
echo "2. Configure Reclaim Console callback URL to:"
echo "   https://<your-worker>.workers.dev/callback"
echo ""
echo "3. Update frontend .env.production with VITE_RECLAIM_RELAY_URL"
echo ""
