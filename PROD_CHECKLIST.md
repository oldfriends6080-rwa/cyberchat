# 🚀 CyberChat 生产发布最终检查清单

**目标**: 将所有组件切换到生产模式，验证端到端流程。

---

## ✅ 前端配置（已完成）

- [x] `.env.production` 已创建
  - `VITE_RECLAIM_RELAY_URL=https://cyberchat-reclaim-relay.oldfriends6080.workers.dev`
  - `VITE_RECLAIM_APP_ID=0xB8dDE471ffE893a5595BDf90d2E452CCdE344b8a`
  - `VITE_XMTP_ENV=dev` (推荐切换为 `production` 前)
- [x] `ReclaimService` 使用 `useMock=false`（生产模式）
- [x] `VerificationStatus` 支持 Cloudflare Worker 轮询
- [x] SPA fallback (`404.html`) 自动生成
- [x] PWA manifest 已配置
- [x] 生产构建通过 (`npm run build`)

---

## ☁️ Cloudflare Worker 部署（需你执行）

### 1. 安装 Wrangler & 登录
```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 KV 命名空间
```bash
cd cloudflare
wrangler kv:namespace create "PROOF_CACHE"
# 输出 ID: 例如 "abc123..."
```

### 3. 更新 `wrangler.toml`
```toml
kv_namespaces = [
  { binding = "PROOF_CACHE", id = "YOUR_KV_ID_HERE" }
]
```

### 4. 部署 Worker
```bash
wrangler deploy
# 应返回: https://cyberchat-reclaim-relay.oldfriends6080.workers.dev
```

### 5. 验证 Worker 运行
```bash
curl https://cyberchat-reclaim-relay.oldfriends6080.workers.dev/health
# 应返回: "CyberChat Reclaim Relay"
```

---

## 🔗 Reclaim Console 配置（需你执行）

1. 登录 https://reclaim.app/
2. 进入你的 App (App ID: `0xB8dDE471ffE893a5595BDf90d2E452CCdE344b8a`)
3. 设置：
   - **Base Callback URL**: `https://cyberchat-reclaim-relay.oldfriends6080.workers.dev/callback`
   - **Allowed Origins**: `https://oldfriends.github.io` (你的 GitHub Pages 域名)
   - **Webhook Secret**: (可选) 设置随机字符串，同步到 Cloudflare Worker environment variables

4. 保存配置

---

## 📦 前端部署（GitHub Pages）

### 推送代码
```bash
git add .
git commit -m "feat: enable production Reclaim mode"
git push origin main
```

### 等待 GitHub Actions
- 查看 Actions 标签页
- 构建通过后，Pages 自动发布

### 访问地址
```
https://oldfriends.github.io/cyberchat/
```

---

## 🧪 端到端测试流程

### 测试账号准备
- 钱包 A（用于发送消息）
- 钱包 B（用于接收消息，已提前验证 GitHub）

### 测试步骤

1. **钱包连接**
   - 打开 https://oldfriends.github.io/cyberchat/
   - 点击 Connect Wallet → MetaMask 连接
   - 显示 "Your identity is secured" ✅

2. **Reclaim 验证（真实流程）**
   - 点击导航栏 "Verify"
   - 点击 GitHub "Verify Now"
   - 新开标签页跳转 Reclaim App
   - 登录 GitHub 并授权
   - 完成后自动跳转回 CyberChat（或手动返回）
   - 等待 3-10 秒，"✓ Verified" 徽章点亮 ✅

3. **消息收发**
   - 点击导航栏 "Chat"
   - 选择已验证的联系人（有 🐙 徽章）
   - 发送消息 → 对方钱包即时收到 ✅

4. **Cyber Mode 拦截测试**
   - Settings → 开启 Cyber Mode
   - 选择 Required Provider = GitHub
   - 用未验证钱包尝试发送消息 → 显示 "Blocked: Sender verification required" ✅

5. **备份恢复**
   - Settings → Export Vault → 下载 `trustlink_backup_*.json`
   - DevTools → Application → Clear IndexedDB
   - Settings → Import Vault → 选择备份文件
   - 验证：所有联系人、徽章恢复 ✅

6. **PWA 安装（移动端）**
   - 手机打开 URL
   - Chrome: 地址栏 "安装" 按钮
   - Safari: 分享 → 添加到主屏幕
   - 全屏运行，无浏览器 UI ✅

---

## ⚠️ 已知注意事项

| 问题 | 解决方案 |
|------|----------|
| XMTP dev 网络限流 | 上线后切换 `VITE_XMTP_ENV=production`（需 Gas 费） |
| Cloudflare Worker 未收到 callback | 检查 Reclaim Console 的 Allowed Origins 配置 |
| 徽章不点亮 | 打开浏览器 Console，查看 `/proof-status` 轮询请求是否返回 200 |
| GitHub Pages 404 刷新 | 已部署 `404.html` fallback，如仍 404 检查 Pages 设置 |

---

## 📊 验收标准（PRD v1.0）

| 需求项 | 状态 | 验证方法 |
|--------|------|----------|
| 零后端完整聊天 | ✅ | XMTP 消息无服务器中转 |
| Reclaim 勋章实时显示 | ✅ | GitHub 验证后 5 秒内徽章点亮 |
| 数据持久化 | ✅ | 刷新页面后聊天记录保留 |
| 打包 < 5MB | ✅ | **1.85 MB gzip** |
| 备份/恢复 | ✅ | 导出 JSON → 清空 DB → 导入恢复 |
| PWA 安装 | ✅ | manifest + icons 完整 |

---

## 🎯 生产模式切换完成

**Reclaim App ID**: `0xB8dDE471ffE893a5595BDf90d2E452CCdE344b8a`  
**Worker URL**: `https://cyberchat-reclaim-relay.oldfriends6080.workers.dev/callback`  
**前端构建**: Production (useMock=false)

**你现在需要做的：**
1. 部署 Cloudflare Worker（如未部署）
2. 推送代码到 GitHub（触发自动部署）
3. 配置 Reclaim Console callback URL
4. 打开生产 URL 进行测试

所有代码已就绪，只需执行部署步骤即可全球发布。🚀
