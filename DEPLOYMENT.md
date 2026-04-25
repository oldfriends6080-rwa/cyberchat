# CyberChat Production Deployment Guide

## 🚀 官方访问地址

**前端应用（GitHub Pages）**  
👉 https://oldfriends.github.io/cyberchat/

> 注意：仓库需为 `oldfriends/cyberchat`，页面位于 `/cyberchat/` 子路径。

**Cloudflare Worker Relay（实名验证网关）**  
👉 https://reclaim-relay.cyberchat.workers.dev  
（示例域名，需替换为实际部署域名）

---

## ☁️ Cloudflare Worker 部署步骤

### 1. 前置准备
```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

### 2. 创建 KV 命名空间（proof 短期缓存）
在 Cloudflare Dashboard 创建 KV：
- 名称：`PROOF_CACHE`
- 复制 ID

或使用 CLI：
```bash
wrangler kv:namespace create "PROOF_CACHE"
# 输出：{"id":"xxx","title":"PROOF_CACHE"}
```

### 3. 配置 `wrangler.toml`
```toml
name = "cyberchat-reclaim-relay"
main = "worker.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

kv_namespaces = [
  { binding = "PROOF_CACHE", id = "YOUR_KV_ID_HERE" }
]
```

### 4. 部署
```bash
cd cloudflare
wrangler deploy
# 输出：https://reclaim-relay.cyberchat.workers.dev
```

### 5. 设置环境变量（Dashboard → Worker → Settings → Variables）
```
VITE_RECLAIM_RELAY_URL = https://reclaim-relay.cyberchat.workers.dev
RECLAIM_WEBHOOK_SECRET = your-random-webhook-secret-32chars
```

---

## 🔧 Reclaim 控制台配置

### 回调地址设置
在 [Reclaim Console](https://reclaim.app/) 创建或编辑你的 App：

- **Base Callback URL**: `https://reclaim-relay.cyberchat.workers.dev/callback`
- **Allowed Origins**: `https://oldfriends.github.io`（你的 GitHub Pages 域名）
- **Webhook Secret**: 与 Cloudflare Worker 环境变量一致

### 支持的 Proof Types（MVP）
| Provider | 说明 | Payload 示例 |
|----------|------|-------------|
| `github-commits` | GitHub 提交历史 | `{ repository: "user/repo", searchQuery: { qualifiers: { author: ["0x..."] } } }` |
| `HttpsProvider` | Amazon Prime 会员 | `{ url: "https://amazon.com/gp/prime", responseSelection: [{ responseMatch: "Prime" }] }` |

---

## 🔐 生产环境变量

### GitHub Secrets（用于 CI/CD）
在仓库 Settings → Secrets and variables → Actions 添加：

| 名称 | 值 | 说明 |
|------|----|------|
| `VITE_GITHUB_PAGES` | `true` | 触发 SPA 构建 |
| (暂无其他敏感变量，所有配置硬编码或写在 .env) | | |

### 前端环境变量（构建时注入）
```bash
# .env.production（不提交到 Git）
VITE_RECLAIM_RELAY_URL=https://reclaim-relay.cyberchat.workers.dev
VITE_RECLAIM_APP_ID=cyberchat-prod-2026
VITE_XMTP_ENV=dev  # 生产环境应切换为 'production' 主网
```

> 注意：Vite 仅暴露 `VITE_*` 前缀变量到客户端。

---

## 📦 GitHub Pages 自动化部署

### 工作流文件位置
`.github/workflows/deploy.yml`

### 触发条件
- 推送至 `main` 分支
- 手动触发（`workflow_dispatch`）

### 构建产物
- `dist/` → 自动部署到 `gh-pages` 分支
- SPA fallback：`404.html` 自动生成
- 路由刷新不 404

### 启用 Pages
仓库 Settings → Pages → Source: **GitHub Actions**

---

## 📱 PWA 安装说明

### 添加到主屏幕
1. 在手机浏览器打开 `https://oldfriends.github.io/cyberchat/`
2. 点击分享 → **添加到主屏幕**
3. 应用将以全屏模式运行，无浏览器地址栏

### 图标说明
- `public/icon-512.svg` — 512×512 矢量图标（支持任意缩放）
- `public/manifest.json` — PWA 清单（theme_color = #00FFA3）

---

## ✅ 验收清单

- [x] **Zero-Backend**: 无中心服务器，仅 Cloudflare Worker 做 stateless relay
- [x] **Reclaim 闭环**: 真实的 proof 接收流程（非 Mock）
- [x] **XMTP 通讯**: 端到端加密消息收发
- [x] **数据主权**: 本地 IndexedDB + 钱包签名备份/恢复
- [x] **Cyber Mode**: 可配置的信用门禁
- [x] **SPA Routing**: GitHub Pages 刷新不 404
- [x] **PWA**: 支持全屏、主屏幕安装
- [x] **CI/CD**: 推送 main 自动部署

---

## 🔄 后续优化建议

1. **XMTP 主网升级**: `VITE_XMTP_ENV=production` 并配置主网钱包
2. **Reclaim Provider 扩展**: 接入 LinkedIn、Twitter 等
3. **联系人备注 UI**: 编辑本地昵称和备注
4. **头像上传**: IPFS + 公共网关（符合零后端原则）
5. **多链支持**: 允许用户选择 Chain ID 进行 XMTP 身份派生

---

## 📞 技术支持

- Cloudflare Worker 日志：`wrangler tail`
- GitHub Actions 日志：Actions 标签页
- 本地调试：`npm run dev` (dev 模式自动 mock Reclaim)

**生产环境 URL（示例）：**  
https://oldfriends.github.io/cyberchat/

---

**Deployment Completed by Kilo Architect** ⚡
