# 🔁 Handoff — 每日開發進度交接

> **使用規則**
> - 每次開發**開始前**：閱讀「目前狀態」與「本次待辦」
> - 每次開發**結束後**：填寫「今日完成」、「遭遇問題」、「下次待辦」
> - 最新的一筆記錄永遠在**最上方**
> - 格式參考最下方的模板

---

## 📋 目前狀態（最新）

**專案階段**：🚧 Phase 1 進行中（Auth 系統完成，考試流程待開發）
**分支**：`feat/phase1-auth`
**PRD 版本**：v1.1
**最後更新**：2026-07-28

### 已完成
- [x] PRD 撰寫與確認（v1.1）
- [x] AI 開發規範資料夾（context / architecture / decisions / handoff）
- [x] Git 版本控制初始化（main 分支）
- [x] Next.js 16 + TypeScript 專案初始化
- [x] Firebase Client / Admin SDK 設定
- [x] TypeScript 型別定義（所有 Firestore collection）
- [x] AuthContext（Google 登入、userDoc 同步、角色）
- [x] 路由守衛 proxy.ts（Next.js 16 規範）
- [x] globals.css 像素風格 Design Token 系統
- [x] 登入頁面（`/login`）
- [x] 首次設定顯示名稱頁面（`/setup`）
- [x] 首頁大廳（`/`，含綜合/申論模式卡片）
- [x] Dev server 啟動確認（http://localhost:3000）

### 下次待辦
- [ ] **Firebase Console 設定**：建立專案、啟用 Google Auth、建立 Firestore
- [ ] **填寫 `.env.local`**：從 Firebase Console 複製設定值
- [ ] 綜合模式考試大廳頁面（`/exam/quiz/lobby`）
- [ ] 綜合模式作答頁面（`/exam/quiz/[examId]`）
- [ ] 每題倒數計時元件（TimerBar）
- [ ] 選擇題 / 問答題作答元件

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
