# 🔁 Handoff — 每日開發進度交接

> **使用規則**
> - 每次開發**開始前**：閱讀「目前狀態」與「本次待辦」
> - 每次開發**結束後**：填寫「今日完成」、「遭遇問題」、「下次待辦」
> - 最新的一筆記錄永遠在**最上方**
> - 格式參考最下方的模板

---

## 📋 目前狀態（最新）

**專案階段**：🚧 成績自動寫入 / 匯出至 Google Sheets 已完成，準備串接 Firebase 真實資料
**分支**：`feat/phase1-auth`
**PRD 版本**：v1.1
**最後更新**：2026-08-10

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
- [x] 首頁大廳（`/`，含綜合/申論模式卡片與主管批改快捷按鈕）
- [x] Dev 環境 auth bypass（proxy.ts + AuthContext timeout + mock user）
- [x] 共用假題庫 `src/lib/mockData.ts` + SessionStorage 工具 `src/lib/examSession.ts`
- [x] `TimerBar` 共用元件（`src/components/TimerBar/`）
- [x] 綜合模式考試大廳（`/exam/quiz/lobby`）
- [x] 綜合模式作答頁（`/exam/quiz/[examId]`，含計時、選擇題/問答題）
- [x] 成績結果頁（`/exam/quiz/[examId]/result`）
- [x] 錯題回顧頁（`/exam/quiz/[examId]/review`）
- [x] React state-in-render bug 修復（setter callback 不含 side effect）
- [x] Phase 2：申論模式大廳（`/exam/essay/lobby`）
- [x] Phase 2：申論模式作答頁（`/exam/essay/[examId]`，每題 10 分鐘，含 Lock 機制）
- [x] Phase 2：申論模式結果頁（`/exam/essay/[examId]/result`，等待批改狀態與作答預覽）
- [x] Phase 2：主管批改後台（`/admin/grade`，支援作答檢視、逐題評分打分、評語填寫與解鎖）
- [x] 題庫匯入規劃與 Excel 標準範本生成（`public/question_import_template.xlsx`，含原生 Data Validation 下拉選單）
- [x] Phase 2：題庫管理與 Excel 匯入/編輯/軟刪除後台（`/admin/questions`）
- [x] Phase 3：冒險排行榜頁面（`/leaderboard`，支援綜合最高分榜與申論榮譽榜）
- [x] Phase 3：個人歷史成績與錯題記錄頁（`/profile/results`，支援統計摘要與申論評語檢視）
- [x] Phase 3：主管專屬團隊考核進度與狀況總覽（`/admin/users`）
- [x] 客製化像素風格二次確認彈窗（`ConfirmModal`，應用於離開考試防誤觸）
- [x] Phase 1：成績自動寫入 / 匯出至 Google Sheets（`src/lib/googleSheets.ts` 與 `/api/export-score`）

### 下次待辦
- [ ] 串接 Firebase 真實資料（替換 mockData + examSession + questionStore + historyStore → Firestore）

### 尚未開始
- [ ] Phase 3：像素風格精緻化與動效強化

---

## 📅 開發日誌

---

### 2026-08-10 | 成績自動寫入 / 匯出至 Google Sheets 功能開發

**負責人**：AI  
**開發時長**：約 1 小時

#### ✅ 今日完成
1. **Google Sheets 寫入核心庫 (`src/lib/googleSheets.ts`)**：
   - 使用 `googleapis` JWT Service Account 認證機制，實現將成績列自動追加 (`append`) 至試算表的功能。
   - 符合 `architecture.md` 欄位規範：`Email | 顯示名稱 | 考試日期 | 模式 | 得分 | 總分 | 得分率 | 是否通過 | 累計考試次數`。
2. **成績匯出 API Route (`/api/export-score`)**：
   - 建立伺服器端端點 `/api/export-score`，支援驗證欄位、計算得分率與相容性處置。
   - 內建未配置環境變數時的 DEV 模擬降級機制（Console log 警告），確保無環境變數時系統依然能順暢運行不崩潰。
3. **綜合模式與申論批改整合**：
   - 綜合模式結果頁 [`/exam/quiz/[examId]/result`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/exam/quiz/%5BexamId%5D/result/page.tsx)：考生交卷瀏覽成績時自動觸發 API 匯出成績。
   - 主管申論批改後台 [`/admin/grade`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/admin/grade/page.tsx)：主管提交評分與評語時，自動計算總分並呼叫 API 寫入 Google Sheets。
4. 通過 `npx tsc --noEmit` 型別檢查。

#### ⚠️ 遭遇問題
- 無

#### ⏭️ 下次開始
1. 串接 Firebase 真實資料（將模擬存取轉寫為 Firestore 讀寫與權限規範）

---

### 2026-08-05 | 題庫 Excel 匯入/編輯後台、排行榜、個人成績與主管團隊總覽頁面開發

**負責人**：AI  
**開發時長**：約 3.5 小時

#### ✅ 今日完成
1. **標準 Excel 題庫模板產生**：
   - 使用 `exceljs` 自動於 `public/question_import_template.xlsx` 生成含有原生 Data Validation 下拉選單（`type`, `difficulty`, `enabled`, `answer`）的規範 Excel 範本。
2. **題庫管理後台 (`/admin/questions`)**：
   - 支援題型/難易度/關鍵字篩選、線上單筆 Modal 編輯/新增、單鍵切換啟用與軟刪除機制。
   - 支援 **Excel 批量匯入 (追加模式 Append / 比對更新模式 Upsert)**，且具備智慧比對（優先 `id`，備案 `type + content`）。
   - 全面優化暗色系與高對比點陣配色（標題藍/橘/綠/紫 Badge 與焦點光暈）。
3. **冒險排行榜 (`/leaderboard`)**：
   - 提供「綜合刷題高分榜」與「申論榮譽榜」雙頁籤切換，以及前三名金銀銅牌頒獎台視覺展現。
4. **個人歷史成績與錯題/閱卷檢視 (`/profile/results`)**：
   - 提供 4 項統計指標（累計場數、PASS數、通過率、最高分）與詳細考卷列表。
   - 申論題結果頁 (`/exam/essay/[examId]/result`) 支援主管批改後動態展示分數 (0-10) 與個別指導評語。
5. **主管權限與團隊考核進度總覽 (`/admin/users`)**：
   - 主管大廳隱藏考題測驗，增設「團隊考核狀況與進度總覽」後台，顯示團隊人數、當月申論完成/待批改/未提交狀態與累計考次。
6. **自訂像素點陣確認彈窗 (`ConfirmModal`)**：
   - 替換預設 `window.confirm`，在兩大考試模式中提供安全離開考場的防誤觸對話框。
7. 通過 `npx tsc --noEmit` 型別檢查與測試。

#### ⚠️ 遭遇問題
- **SheetJS 下拉選單相容性**：改用 `exceljs` 解決原生 Excel Data Validation 相容性。
- **React 重複 key 警告**：`addHistoryRecord` 加入 ID 嚴格過濾去重修復。
- **Quiz 導頁缺漏狀態**：補齊 `setSession(effective)` 修復交卷後卡在載入畫面的問題。

#### ⏭️ 下次開始
1. 串接 Firebase 真實資料（將模擬存取轉寫為 Firestore 讀寫）
2. 實現成績自動寫入 / 匯出至 Google Sheets 功能

---

### 2026-08-04 | 主管申論批改後台與大廳 UX 升級

**負責人**：AI  
**開發時長**：約 2.5 小時

#### ✅ 今日完成
- 開發主管批改後台頁面 [`/admin/grade`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/admin/grade/page.tsx) 及專用樣式模組 [`grade.module.css`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/admin/grade/grade.module.css)。
- 支援考卷動態載入：自動抓取考生的 Session 考卷資料（例如剛剛考完的申論題）以及模擬考卷清單。
- 實現評分與評語互動：主管可針對每題進行 0-10 分打分、輸入給考生的個別指導評語。
- 實現自動計分與考卷解鎖機制：送出批改後自動計算總分與是否通過（≥90分），並清除了考生的申論考試鎖定（Essay Lock），方便考生繼續體驗後續流程。
- 全面升級首頁大廳 [`page.tsx`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/page.tsx) UX 體驗：
  - 新增導覽列 **考生 / 主管視角切換器**（Role Toggle Group），切換至主管時自動顯示管理選單。
  - 新增 **楓之谷 NPC「教官 皮卡丘」像素對話框** 與動態冒險提醒。
  - 新增 **本月申論任務完成/待審核狀態警示條**。
- 在登入頁面 [`/login`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/login/page.tsx) 新增 **`🚀 [DEV] 模擬免登入進大廳`** 按鈕，方便快速測試整個系統流程。
- 通過 `npm run build` 與 TypeScript 型別檢查驗證。

#### ⚠️ 遭遇問題
- Next.js Client Component 需顯式宣告 `'use client'`（已修復）。

#### ⏭️ 下次開始
1. 串接 Firebase 真實資料（替換 mockData + examSession → Firestore 讀寫與 Firebase Functions）
2. 實現成績自動寫入 / 匯出至 Google Sheets 功能

---

### 2026-08-03 | 申論模式完整考試流程（假資料）

**負責人**：AI  
**開發時長**：約 1.5 小時

#### ✅ 今日完成
- 新增 10 道客服情境申論假題目至 `src/lib/mockData.ts`（`MOCK_ESSAY_QUESTIONS`）
- 擴充 SessionStorage 工具 `src/lib/examSession.ts`：支援申論考試存取與「同時只能一場」的 `ESSAY_LOCK_KEY` 鎖定機制
- 申論模式考試大廳 `/exam/essay/lobby`：
  - 天空藍像素風格（與綜合模式楓葉紅有所區隔）
  - 本月未提交提醒橫幅
  - 歷史成績卡片（含「等待批改」與「通過/未通過」狀態）
  - 當有未批改時場時限制無法開始新考試，並提供 DEV 清除鎖定按鈕
- 申論模式作答頁 `/exam/essay/[examId]`：
  - 獨立倒數計時（正式 10 分鐘 / 題，DEV 60 秒 / 題）
  - 純文字輸入框與即時動態字數統計（低於 50 字提示）
  - 每題確認作答機制，末題提交後鎖定場次並帶入結果頁
- 申論模式結果頁 `/exam/essay/[examId]/result`：
  - 顯示「等待主管批改中」橫幅與提交時間
  - 作答統計摘要（已答/超時/未答）
  - 作答內容預覽清單
  - DEV 模式提供「模擬主管批改完成（清除鎖定）」功能

#### ⚠️ 遭遇問題
- 無

#### ⏭️ 下次開始
1. 串接 Firebase 真實資料（替換 mockData + examSession → Firestore 讀寫與 Firebase Functions）
2. 開發主管批改後台 `/admin/grade`

---

### 2026-07-29 | 綜合模式完整考試流程（假資料）

**負責人**：AI  
**開發時長**：約 3 小時

#### ✅ 今日完成
- Dev 環境 auth bypass（proxy.ts + AuthContext timeout + 頁面 mock user）
- 共用假題庫 `src/lib/mockData.ts`（8 題：5 選擇 + 3 問答）
- SessionStorage 工具 `src/lib/examSession.ts`（模擬 Firestore 讀寫）
- `TimerBar` 共用元件（`src/components/TimerBar/`，含警示/危險色階）
- 綜合模式考試大廳 `/exam/quiz/lobby`（假歷史成績、開始按鈕）
- 綜合模式作答頁 `/exam/quiz/[examId]`（計時、選擇題/問答題、超時自動換題）
- 成績結果頁 `/exam/quiz/[examId]/result`（分數動畫、4 項統計）
- 錯題回顧頁 `/exam/quiz/[examId]/review`（篩選、選項正解對照、問答題參考答案）

#### ⚠️ 遭遇問題
- Next.js 16 Client Component 動態路由需用 `use(params)` 解包 Promise
- Firebase `onAuthStateChanged` 在 config 未設定時不觸發，需加 2 秒 timeout fallback
- React 報錯：在 state setter callback 內呼叫 `router.push()`，導致「Cannot update Router while rendering ExamPage」；修復方式：將計時器拆為兩個獨立 effect，用 render-time ref 同步最新 state，在 `phase=saving` 的 useEffect 內才呼叫導頁

#### ⏭️ 下次開始
1. Phase 2：申論模式大廳 `/exam/essay/lobby`
2. Phase 2：申論模式作答頁 `/exam/essay/[examId]`（每題 10 分鐘、同時只能一場）
3. 或視情況優先接 Firebase 真實資料

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
