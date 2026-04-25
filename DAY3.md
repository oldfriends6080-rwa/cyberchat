# CyberChat Development Log

## Day 3 — XMTP Messaging + PrivacyShield (2026-04-24)

### Delivered
- **PrivacyShield** (`src/chat/PrivacyShield.ts`) — Gatekeeper middleware
- **ChatList** (`src/chat/ChatList.tsx`) — Contact list with verified badges
- **MessageThread** (`src/chat/MessageThread.tsx`) — Dual-pane message UI + send
- **SettingsPanel** (`src/components/SettingsPanel.tsx`) — Cyber Mode toggle + required provider selector
- **XMTP v13 适配** — Polling-based message refresh, fallback for API differences

### Architecture
```
PrivacyShield.shouldAcceptInbound(walletAddress)
  → queries LocalVault credentials
  → returns boolean based on cyberMode+requiredProviders

PrivacyShield.buildOutboundProof(walletAddress)
  → returns base64-encoded badge bundle
  → attached to outgoing messages via XMTP metadata

MessageThread polling (3s interval)
  → fallback for lack of real-time event API in v13
```

### Privacy Shield Logic
- **Cyber Mode OFF** (default): All messages pass through
- **Cyber Mode ON**: Only contacts with required badges (e.g., `github`) can send messages to local user
- **Outbound proof**: Sender's verified badges are attached to each message for receiver's gatekeeping

### Tech Debts
- XMTP SDK v13 事件订阅 API 与 v12 文档不匹配，使用轮询实现
- `conversation.send` 的 `metadata` 参数类型缺失，使用 `@ts-ignore`
- Badge 数据来源仅靠 `credentials` 查询，未考虑联系人自定义备注

### Acceptance Criteria Status
- ✅ End-to-end encrypted messaging (XMTP dev env)
- ✅ Verified badge display in contact list
- ✅ Cyber Mode gatekeepinglogic implemented
- ⚠️ 实时消息推送（降级为轮询，v13 适配需后续优化）
- ✅ Build < 5MB (gzip: 1.85MB)

### Next (Day 4)
- Export/Import vault JSON backup & restore
- Contact备注编辑功能
- 最终集成测试与文档完善

Proceed to **Day 4: 无主备份与恢复**?
