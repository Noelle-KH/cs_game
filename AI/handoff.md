# 🔁 Handoff — 每日開發進度交接

> **使用規則**
> - 每次開發**開始前**：閱讀「目前狀態」與「本次待辦」
> - 每次開發**結束後**：填寫「今日完成」、「遭遇問題」、「下次待辦」
> - 最新的一筆記錄永遠在**最上方**
> - 格式參考最下方的模板

---

## 📋 目前狀態（最新）

**專案階段**：✅ 申論模式 (`/exam/essay/*`) 全面雲端化串接完成、本月申論任務完成狀態與雲端自動解鎖防重複考邏輯修復
**分支**：`main` / `feat/phase1-auth`
**PRD 規範**：v1.1
**最後更新**：2026-08-19

### 已完成
- [x] PRD 撰寫與確認（v1.1）
- [x] AI 開發規範資料夾（context / architecture / decisions / handoff）
- [x] Next.js 16 + TypeScript 專案初始化與路由配置 (`proxy.ts`)
- [x] Firebase Client / Admin SDK 設定與 auth 狀態處理
- [x] 首次 Google 登入自訂姓名頁面 (`/setup`) 與 AuthContext 競態修復
- [x] 假資料全面刪除潔淨（大廳歷史紀錄、預設題庫全數清空）
- [x] 題庫後台 Excel 匯入優化 (`/admin/questions`) 與 Firestore `questions` 雲端分批讀寫
- [x] 綜合模式考試隨機洗牌去重、考卷實時寫入雲端 Firestore `exams` 集合
- [x] 主管閱卷後台 (`/admin/grade`)：自動隱藏選擇題、問答題配分上限更正為單題 5 分（總分 100 分）
- [x] 錯題回顧 (`/exam/quiz/[examId]/review`) 與成績結果頁 (`/exam/quiz/[examId]/result`) 雲端資料與主管批改分數實時連動
- [x] 獨立系統權限與參數管理後台 (`/admin/settings`)：新增 Admin (系統管理員) 與 Supervisor (主管) 雙層級名單授權與破版修復
- [x] 申論模式 (`/exam/essay/*`) 全面雲端化串接（考卷改為寫入與讀取 Firestore `exams` 集合）
- [x] 驗證客服新人「每月申論任務限制」與鎖定考場自動解鎖邏輯

### 下次待辦
- [ ] 批改完成後自動觸發 Google Sheets 成績匯出 (/api/export-score) 整合與測試

---

## 📅 開發日誌

---

### 2026-08-19 | 申論模式考場與成績頁面全面雲端化 (`exams` 集合串接)

**負責人**：AI  
**開發時長**：約 1.0 小時

#### ✅ 今日完成
1. **申論大廳 (`/exam/essay/lobby`) 實時連動 Firestore**：
   - 移除舊版假歷史紀錄，改由 `getUserExamsFirestore(uid)` 實時拉取當前考生的雲端申論歷史。
   - 開始申論考試時透過 `createExamFirestore` 於 Firestore `exams` 集合建立 `in_progress` 雲端考卷。
   - 動態計算當月提交狀態（`hasSubmittedThisMonth`）與考場鎖定狀態。
2. **每月申論次數限制與防重複考試優化**：
   - 當考生本月已完成申論考試（主管已批改或已提交），申論大廳按鈕自動顯示 `✅ 本月申論任務已完成` 並鎖定禁用。
   - 提示區顯示 `🎉 本月申論考核任務已達標！下個月將開放新的申論特訓。`，並於 `handleStart` 函數加入防護阻擋。
3. **申論考場作答頁 (`/exam/essay/[examId]`) 交卷串接**：
   - 考卷提交時改呼叫 `submitExamFirestore` 將考生作答紀錄實時更新寫入雲端 `exams` 集合。
4. **申論成績與評分預覽頁 (`/exam/essay/[examId]/result`) 實時同步**：
   - 頁面改為經由 `getExamByIdFirestore(examId)` 取得真實考卷資料，支援即時呈現「待主管批改」與主管批改後的「最終總分、通過橫幅與各題評語」。
5. 全面通過 `npx tsc --noEmit` 型別驗證。

#### ⚠️ 遭遇問題
- **TypeScript `effectiveUserDoc` 可能為 null 錯誤**：在 React Effect 內直接引用被判斷可能為 null 的物件，已建立區域變數 `currentUid` 安全解包處理。

#### ⏭️ 下次開始
1. 批改完成後自動觸發 Google Sheets 成績匯出 (/api/export-score)
2. 驗證客服新人「每月申論任務限制」與鎖定考場邏輯

---

### 2026-08-18 | 綜合考場與主管批改雲端化、錯題回顧與 Admin/Supervisor 雙層授權重構

**負責人**：AI  
**開發時長**：約 3.5 小時

#### ✅ 今日完成
1. **Google 帳號登入與自訂姓名流程優化**：
   - 強制新註冊 Google 帳號預設 displayName 留空，確保停留在 `/setup` 讓使用者手動輸入真實姓名。
   - 修正 AuthContext 中的 `userDocLoaded` State 鎖定，解決登入跳轉時的競態條錯。
2. **綜合模式隨機去重與 Fisher-Yates 抽題**：
   - 採用 `Map<string, QuestionDoc>` 防重機制與正統 Fisher-Yates 隨機洗牌，保證綜合大廳抽出的 20 題皆無重複。
3. **雲端考場 `exams` Collection 全面串接**：
   - 建立 `src/lib/examStore.ts` 服務，支援 `createExamFirestore`、`submitExamFirestore`、`gradeExamFirestore` 與 `getUserExamsFirestore`。
   - 修正過濾 `undefined` 屬性（如問答題未批改時的 `isCorrect`），解決 Cloud Firestore `updateDoc` 被阻擋的 Error。
4. **主管閱卷後台優化 (`/admin/grade`)**：
   - 自動隱藏電腦已評分的選擇題，僅展示問答題供主管打分。
   - 將綜合模式問答題配分上限與初始預設值更正為單題 5 分 (選擇題 45 分 + 問答題 55 分 = 100 分)。
5. **錯題回顧與成績結果頁實時同步**：
   - 升級 `/exam/quiz/[examId]/result` 與 `/exam/quiz/[examId]/review` 改為實時拉取雲端考卷狀態，主管批改完成後返回成績頁自動解鎖最新總分與通過橫幅。
   - 歷次成績 (`/profile/results`) 自動過濾中途離開作廢的 `in_progress` 考卷。
6. **系統權限後台權限層級劃分 (`/admin/settings`)**：
   - 新增 Admin (系統管理員) 與 Supervisor (主管) 名單授權清單。
   - 主管視角自動隱藏 `⚙️ 系統權限與參數管理` 按鈕，並修正提示彈窗 (`.toast`) 的最高 z-index 與圖層遮擋。

#### ⚠️ 遭遇問題
- **Firestore updateDoc Unsupported undefined value**：問答題預設 `isCorrect: undefined` 導致寫入拋錯，透過建立 `sanitizedAnswers` 過濾器清除 undefined 欄位解決。
- **Result 頁面舊 Local Storage 快取問題**：交卷後導回結果頁因未拉取雲端更新導致卡在「待審核中」，改為即時呼叫 `getExamByIdFirestore` 解決。

#### ⏭️ 下次開始
1. 申論模式 (`/exam/essay/*`) 全面雲端化串接 (Firestore `exams` 集合)
2. 成績自動匯出至 Google Sheets (/api/export-score)
3. 客服新人每月申論任務頻率限制實測

---

### 2026-08-17 | 假資料清空、/admin/settings 權限設定頁、Firestore 題庫與 Auth 雲端串接

**負責人**：AI  
**開發時長**：約 2.5 小時

#### ✅ 今日完成
1. **假資料全面刪除**：
   - 清空 `DEFAULT_MOCK_HISTORY`、`DEMO_QUESTIONS` 與 `/admin/grade` 預設 pending 考卷，使系統恢復潔淨狀態。
2. **開發獨立系統權限與參數設定頁 (`/admin/settings`)**：
   - 支援線上動態新增/移除 Admin Email 授權清單。
   - 支援設定合格門檻分數 (預設 90 分)、綜合/申論題數上限與單題限時秒數。
3. **權限邊界嚴格隔離**：
   - 修正首頁主管選單，只有真正的管理者角色 (`userDoc.role === 'admin'`) 才能看到與存取 `/admin/settings`。
   - 在 Settings 頁面頂層加入動態 Route Guard 攔截非 Admin 存取。
4. **Firestore 題庫雲端串接與 Excel 匯入優化**：
   - 將 `questionStore.ts` 升級為讀寫 Firestore `questions` 集合。
   - 解決上傳時間過長與卡住問題：實現每批 200 筆 `writeBatch` 分批上傳，並在 Modal 加入即時寫入進度提示 (`🚀 正在寫入雲端 Firestore (X / Y 筆)...`)。
   - 驗證成功完成 Excel 題庫批量導入雲端。
5. **Google 帳號登入與 Firestore `users` 集合成員同步**：
   - 升級 `AuthContext.tsx` 與 `/setup` 頁面，首次使用 Google 登入自動於 Firestore `users/{uid}` 建立使用者文件與角色。

#### ⚠️ 遭遇問題
- **Firestore Permission / Database 未建立問題**：初期上傳卡住係因 Firebase 控制台中未創建 Cloud Firestore Database。指示使用者在 Firebase Console 啟用資料庫與 Test Rules 後即成功匯入。

#### ⏭️ 下次開始
1. 考試 Sessions 改寫入 Firestore `exams` 集合
2. 主管批改頁面與排行榜改讀寫 Firestore `exams` 雲端考卷

---

---

### 2026-08-17 | 綜合模式問答題改主管人工批改重構、錯題回顧與後台整合

**負責人**：AI  
**開發時長**：約 2.0 小時

#### ✅ 今日完成
1. **技術決策寫入 (DEC-008)**：
   - 決議將綜合模式的問答題由「自動比對」改為「主管人工批改」，並採取 **方案 A（未完成主管批改前暫不寫入排行榜與 Google Sheets）**。
2. **綜合模式交卷與結果頁重構 (`/exam/quiz/[examId]`)**：
   - 交卷時即時結算選擇題得分，問答題留待主管審核，考卷標記為 `submitted` 待審核狀態。
   - 結果頁新增「已交卷，等待主管審核中」藍色提示 Banner 與階段性選擇題得分展示。
3. **錯題回顧頁面連動 (`/exam/quiz/[examId]/review`)**：
   - 審核前隱藏參考答案並標記 `⏳ 待主管審核` 標籤；主管完成批改後 (`status: 'graded'`) 解鎖參考答案與顯示得分評語。
4. **主管批改後台大升級 (`/admin/grade`)**：
   - 支援「全部 / 綜合模式 (Quiz) / 申論模式 (Essay)」下拉式篩選。
   - 綜合模式批改卡片預載選擇題已得分數、題目範例 context、關鍵字參考答案與 0~20 分獨立打分評語區塊。
   - 新增試驗用綜合待批改假資料（皮卡丘、小火龍）。
5. **排行榜與成績匯出過濾 (`historyStore.ts` & `/api/export-score`)**：
   - `getQuizLeaderboard()` 嚴格限定僅採計 `status === 'graded'` 之考卷，寫入 Google Sheets 移至主管提交評分時觸發。
6. **建置與型別驗證**：
   - 補齊本機測試可用 Demo 題庫（避免無題目導頁失敗），通過 `npx next build` 靜態頁面打包（17 個路由通過）與 `npx tsc --noEmit` 檢查。

#### ⚠️ 遭遇問題
- **Turbopack Panic Error (500 Error)**：因 OneDrive 背景自動同步機制與 Turbopack 快取發起鎖定衝突，導致開發伺服器 Panic。已清除 `.next` 目錄並確認 Webpack 編譯穩定。
- **DEV Fallback TypeScript Error**：`MOCK_SESSION` 缺少 `status` 與 `choiceScore` 欄位導致 TS2739 錯誤，已補齊全欄位修復。

#### ⏭️ 下次開始
1. 開發獨立的「`/admin/settings` 系統權限與 Admin 名單後台」
2. 處理登入權限與真實帳號測試（Firestore `users` 集合同步與權限控管）
3. 串接 Firebase Firestore 真實讀寫

---

### 2026-08-14 | 考題清空、隨機抽題上限、問答比對計分、錯題優化與權限後台規劃

**負責人**：AI  
**開發時長**：約 2.0 小時

#### ✅ 今日完成
1. **假題庫清空**：
   - 清空 [`src/lib/mockData.ts`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/lib/mockData.ts) 中的預設測試題庫，保持潔淨狀態供真實題庫匯入。
2. **管理員權限自動判定與 DEV 快速測試保留**：
   - [`src/contexts/AuthContext.tsx`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/contexts/AuthContext.tsx) 加入 `checkIsAdmin` 邏輯，可比對 `NEXT_PUBLIC_ADMIN_EMAILS` 給予 `admin` 角色。
   - [`/login`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/login/page.tsx) 頁面升級 DEV 快速模擬按鈕（可選擇 **🚀 免登入 考生** 或 **👑 免登入 主管**）。
3. **隨機抽題與題數限制**：
   - 綜合模式考試隨機洗牌抽題，限制最多 20 題；申論模式隨機洗牌抽題，限制最多 10 題。
4. **問答題與正解比對與同權重計分**：
   - 取消舊版固定 60/40 配分，改為每題等權重配分 `100 / 總題數`。
   - 問答題新增答案自動比對邏輯（清除標點符號與大小寫後進行包含/吻合檢查）。
5. **錯題回顧與結果統計修正**：
   - 在 Session 答案中附帶當次作答的完整題目資訊 `questionDoc`，解決匯入題庫在錯題頁找不到問題的狀況。
   - 更新錯題頁「答錯」篩選，使其包含答錯的選擇題與未通過比對的問答題。
   - 結果頁精準顯示「問答題得分數 / 問答題總數」。
6. **獨立權限管理後台定案**：
   - 與使用者確認選擇 **方案 B**，將建立獨立的 `/admin/settings` 頁面管理系統權限與 Admin Email 名單。

#### ⚠️ 遭遇問題
- **React Hydration Error**：擴充套件（如沉浸式翻譯）注入 `data-immersive-translate-page-theme` 觸發 Hydration mismatch，已在 [`layout.tsx`](file:///C:/Users/iexs1/OneDrive/%E6%96%87%E4%BB%B6/Program/cs_game/src/app/layout.tsx) 加入 `suppressHydrationWarning` 解決。
- **React Rules of Hooks**：條件式 return 下方呼叫 `useState` 觸發鉤子順序錯誤，已將所有 Hooks 提升至組件頂層。

#### ⏭️ 下次開始
1. 開發獨立的「`/admin/settings` 系統權限與 Admin 名單後台」
2. 處理登入權限與真實帳號測試（Firestore `users` 集合同步與權限控管）
3. 串接 Firebase Firestore 真實讀寫

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
