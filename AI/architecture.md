# 🏗️ Architecture — 客服考核遊戲系統

> 開發前必讀。本文件定義技術棧、模組分層、資料模型與整合規範。
> 所有開發決策若與本文件衝突，須先更新 `decisions.md` 並在此文件留下變更紀錄。

---

## 一、技術棧（確認版）

| 層級 | 技術選型 | 說明 |
|------|----------|------|
| **前端** | Next.js 14（App Router）+ TypeScript | SSR 支援、SEO 友好、i18n 架構完善 |
| **樣式** | Vanilla CSS + CSS Modules | 像素風格需高度客製化，避免 Tailwind 干擾 |
| **後端 / DB** | Firebase（Firestore + Auth + Functions） | 整合 Google OAuth、即時資料同步、無伺服器部署 |
| **Google 整合** | Google Sheets API v4 | 題庫讀取（手動觸發）+ 成績寫入（自動） |
| **部署** | Vercel（前端）+ Firebase Functions（後端邏輯） | 快速 CI/CD，免費額度足夠初期使用 |
| **語言架構** | next-intl（i18n） | 繁中為主，預留英文 namespace |
| **身份驗證** | Firebase Auth + Google Provider | Google OAuth，Firestore 儲存角色資訊 |

---

## 二、系統模組劃分

```
cs_game/
├── AI/                         ← 開發規範文件（本資料夾）
├── prd.md                      ← 產品需求文件
└── app/                        ← Next.js 應用根目錄
    ├── (auth)/                 ← 登入 / 首次設定顯示名稱
    ├── (exam)/                 ← 考試流程
    │   ├── lobby/              ← 選擇考試模式
    │   ├── quiz/               ← 綜合模式作答
    │   └── essay/              ← 申論模式作答
    ├── (result)/               ← 交卷結果 / 錯題回顧
    ├── (leaderboard)/          ← 排行榜
    ├── (profile)/              ← 個人成績 / 設定
    ├── (admin)/                ← 主管後台
    │   ├── grade/              ← 申論批改
    │   ├── questions/          ← 題庫管理（含手動同步）
    │   └── results/            ← 查看所有考生成績
    └── (super-admin)/          ← 系統管理員
        ├── roles/              ← 角色權限管理
        └── settings/           ← 系統參數（Sheets ID 等）
```

---

## 三、Firebase Firestore 資料模型

### 3.1 Collection: `users`
```
users/{uid}
  ├── email: string           # Google 帳號 Email（唯一識別）
  ├── displayName: string     # 手動填寫的顯示名稱
  ├── role: "examinee" | "supervisor" | "admin"
  ├── createdAt: timestamp
  └── lastLoginAt: timestamp
```

### 3.2 Collection: `questions`
```
questions/{questionId}
  ├── type: "choice" | "qa" | "essay"
  ├── difficulty: "basic" | "medium" | "advanced"
  ├── context: string         # 情境描述（可空）
  ├── content: string         # 題目主文
  ├── options: {              # 選擇題用
  │     A: string, B: string, C: string, D: string
  │   }
  ├── answer: string          # 選擇題 → A/B/C/D；問答題 → 標準答案
  ├── explanation: string     # 答案解析
  ├── enabled: boolean        # 是否啟用（對應 Google Sheets 的啟用狀態）
  ├── sourceId: string        # 對應 Google Sheets 的題目 ID
  └── syncedAt: timestamp     # 最後同步時間
```

### 3.3 Collection: `exams`
```
exams/{examId}
  ├── uid: string             # 考生 UID
  ├── mode: "quiz" | "essay"
  ├── status: "in-progress" | "submitted" | "graded"
  ├── startedAt: timestamp
  ├── submittedAt: timestamp
  ├── gradedAt: timestamp     # 申論題批改完成時間
  ├── totalScore: number      # 實際得分
  ├── maxScore: number        # 滿分（固定 100）
  ├── passed: boolean         # 是否通過（≥ 90 分）
  └── answers: [              # 作答記錄陣列
        {
          questionId: string,
          userAnswer: string,
          isCorrect: boolean,       # 選擇 / 問答用
          score: number,            # 申論用（主管評分）
          comment: string,          # 申論用（主管評語）
          timeExpired: boolean      # 是否因倒數結束自動提交
        }
      ]
```

### 3.4 Collection: `notifications`
```
notifications/{notifId}
  ├── uid: string             # 接收者 UID
  ├── type: "graded"          # 申論批改完成通知
  ├── examId: string
  ├── read: boolean
  └── createdAt: timestamp
```

### 3.5 Collection: `settings` (singleton)
```
settings/global
  ├── sheetsId_questions: string    # 題庫 Google Sheet ID
  ├── sheetsId_results: string      # 成績 Google Sheet ID
  ├── passThreshold: number         # 通過門檻（固定 90）
  ├── quizQuestionCount: number     # 綜合模式題數（固定 20）
  ├── essayQuestionCount: number    # 申論模式題數（固定 10）
  ├── quizTimePerQuestion: number   # 綜合每題秒數（固定 300）
  └── essayTimePerQuestion: number  # 申論每題秒數（固定 600）
```

---

## 四、計時機制規範

> ⚠️ 所有計時以**伺服器時間**為基準，不接受前端偽造。

- 考試開始時，Firebase Function 記錄 `startedAt`
- 每題作答時，前端送出答案前需驗證伺服器端剩餘時間
- 若前端超時未送出，Firebase Function 自動標記為空白作答並推進至下一題
- 全場計時與每題計時同步顯示，但**以每題倒數為強制推進依據**

---

## 五、Google Sheets 整合規範

### 5.1 題庫同步（讀取）
- 觸發方式：主管在後台點擊「同步題庫」按鈕
- 執行主體：Firebase Function `syncQuestions`
- 流程：讀取 Sheets → 比對 `sourceId` → 新增 / 更新 Firestore `questions` collection
- 僅同步 `啟用狀態 = Y` 的題目

### 5.2 成績匯出（寫入）
- 觸發時機：
  - 綜合模式：考生交卷後自動執行
  - 申論模式：主管送出批改後自動執行
- 執行主體：Firebase Function `exportScore`
- 寫入欄位（依序）：
  `Email | 顯示名稱 | 考試日期 | 模式 | 得分 | 總分 | 得分率 | 是否通過 | 累計考試次數`

---

## 六、角色驗證規範

- 角色儲存於 Firestore `users/{uid}.role`
- 每次 API 請求由 Firebase Function 驗證 ID Token 並查詢角色
- 前端依角色動態顯示 / 隱藏路由（Next.js middleware）
- 角色分級：`examinee < supervisor < admin`

---

## 七、響應式斷點

| 裝置 | 斷點 |
|------|------|
| Mobile | `< 768px` |
| Tablet | `768px – 1024px` |
| Desktop | `> 1024px` |

---

## 八、樣式規範（像素風格）

- 使用 CSS Modules，檔案命名：`ComponentName.module.css`
- 像素字型：`Cubic 11`（優先）或 `Zpix`，透過 `@font-face` 載入
- 圖片資源：使用 pixel art PNG（不縮放，保持像素銳利度）
  - CSS：`image-rendering: pixelated`
- 動畫使用 CSS `@keyframes`，避免使用 JS 動畫函式庫
- 設計 Token（CSS 變數）統一定義於 `app/globals.css`：
  ```css
  :root {
    --color-maple-red: #cc3d3d;
    --color-sky-blue: #5ba4cf;
    --color-warm-orange: #f4a24a;
    --color-parchment: #fdf6e3;
    --color-dark-bg: #1a1a2e;
    --font-pixel: 'Cubic 11', monospace;
    --border-pixel: 3px solid currentColor;
    --transition-snap: 80ms steps(2, end);
  }
  ```

---

## 九、開發規範

1. **每次開發前**：閱讀 `context.md`、`architecture.md`、`handoff.md`
2. **每次開發後**：更新 `handoff.md`（今日完成、遭遇問題、下次待辦）
3. **重大決策**：記錄於 `decisions.md`，說明選型理由與取捨
4. **Commit 規範**：`feat:` / `fix:` / `docs:` / `refactor:` / `style:` 開頭
5. **型別安全**：所有 Firestore 資料須定義 TypeScript interface（放於 `types/` 資料夾）
6. **環境變數**：機密資訊（API Keys、Sheet ID）一律放 `.env.local`，不進版控
