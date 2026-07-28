# 🔁 Handoff — 每日開發進度交接

> **使用規則**
> - 每次開發**開始前**：閱讀「目前狀態」與「本次待辦」
> - 每次開發**結束後**：填寫「今日完成」、「遭遇問題」、「下次待辦」
> - 最新的一筆記錄永遠在**最上方**
> - 格式參考最下方的模板

---

## 📋 目前狀態（最新）

**專案階段**：📐 規劃完成，尚未開始開發  
**PRD 版本**：v1.1（所有 Open Questions 已確認）  
**最後更新**：2026-07-28

### 已完成
- [x] PRD 撰寫與確認（v1.1）
- [x] AI 開發規範資料夾建立（context / architecture / decisions / handoff）
- [x] 技術棧確認（Next.js 14 + Firebase + Vanilla CSS）
- [x] Firestore 資料模型設計完成
- [x] 7 項技術決策記錄至 decisions.md

### 尚未開始
- [ ] Phase 1：專案初始化（Next.js + Firebase 設定）
- [ ] Phase 1：Google OAuth 登入流程
- [ ] Phase 1：首次登入顯示名稱設定頁
- [ ] Phase 1：綜合模式考試流程（含計時）
- [ ] Phase 1：交卷結果頁 + 錯題回顧
- [ ] Phase 1：成績匯出至 Google Sheets
- [ ] Phase 2：申論模式作答流程
- [ ] Phase 2：主管批改後台
- [ ] Phase 3：排行榜頁面
- [ ] Phase 3：像素風格精緻化

---

## 📅 開發日誌

---

### 2026-07-28 | 規劃階段

**負責人**：—  
**開發時長**：—

#### ✅ 今日完成
- PRD v1.0 初稿撰寫
- PRD v1.1 更新（8 個 Open Questions 全數確認）
- 建立 `AI/` 資料夾與四份規範文件：
  - `context.md`：專案背景與業務規則速查
  - `architecture.md`：技術棧、資料模型、模組結構、開發規範
  - `decisions.md`：7 項技術決策紀錄（DEC-001 ~ DEC-007）
  - `handoff.md`：本文件

#### ⚠️ 遭遇問題
- 無

#### ⏭️ 下次開始
1. 初始化 Next.js 14 專案（`npx create-next-app@latest ./`）
2. 安裝 Firebase SDK 並設定 `.env.local`
3. 建立 Firebase Auth + Google Provider 登入頁面
4. 建立 Firestore `users` collection 與首次登入顯示名稱設定流程
5. 設定 Next.js middleware 進行角色驗證與路由保護

---

## 📝 Handoff 模板

複製以下模板，貼在日誌區最上方使用：

```markdown
### YYYY-MM-DD | 功能描述

**負責人**：
**開發時長**：

#### ✅ 今日完成
-

#### ⚠️ 遭遇問題
-（若無問題請填「無」）

#### ⏭️ 下次開始
1.
2.
```
