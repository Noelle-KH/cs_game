# 🍁 客服考核遊戲系統 (CS Quiz Adventure)

> 一套專為客服新人設計的**線上考核遊戲**，結合楓之谷像素點陣風格（Pixel Art），整合 Google OAuth 身份認證、Cloud Firestore 雲端考場、主管人工審核批改與 Google Sheets 成績自動同步匯出。

---

## 🎮 系統簡介與特色

本系統旨在將枯燥的客服規章考核轉化為充滿樂趣與學習競賽感的點陣風格遊戲體驗：

- **⚔️ 雙重考核模式**：
  - **綜合模式 (Quiz)**：20 題選擇題與情境簡答題，限時 100 分鐘。選擇題自動算分，問答題由主管審核，支援無限刷題競速榜。
  - **申論模式 (Essay)**：10 題深度情境問答，每題獨立計時。交卷後由主管人工審核打分並撰寫個人化評語（限制每月至少完成一次）。
- **👑 雙層管理權限**：
  - **主管 (Supervisor)**：線上批改申論與問答題、團隊考核進度總覽（Users）、題庫維護與 Excel 批量導入（Questions）。
  - **系統管理員 (Admin)**：最高權限，可進行線上 Admin/Supervisor Email 授權管理、系統分數與題數門檻設定、Google Sheets 成績手動補同步。
- **📊 資料庫與表單連雲**：
  - 交卷與批改資料實時同步至 Cloud Firestore。
  - 主管批改完成後自動觸發後端將成績寫入指定 Google Sheets 試算表。

---

## 🛠️ 技術選型 (Tech Stack)

| 層級 | 技術方案 |
| :--- | :--- |
| **前端框架** | Next.js 16 (App Router) + TypeScript |
| **UI 樣式** | Vanilla CSS + CSS Modules + Design Tokens (楓之谷像素點陣風格) |
| **字體與資源** | Cubic 11 像素中文字體 (`/fonts/Cubic_11_1.013_R.ttf`) |
| **後端 / DB** | Firebase (Cloud Firestore + Authentication) |
| **Google 整合** | Google Sheets API v4 (googleapis + JWT Service Account) |
| **Excel 導入** | ExcelJS + xlsx (支援自動產生 Data Validation 下拉選單範本) |
| **線上部署** | Vercel (前端與 Serverless Routes) |

---

## 🚀 快速開始 (Quick Start)

### 1. 本地環境準備與安裝

```bash
# 1. 複製專案
git clone https://github.com/your-username/cs_game.git
cd cs_game

# 2. 安裝套件
npm install
```

### 2. 環境變數設定 (`.env.local`)

在專案根目錄建立 `.env.local` 檔案並填入以下配置：

```env
# ── Firebase Client 配置 ──
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="cs-game.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="cs-game"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="cs-game.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:..."

# ── 預設管理者名單 ──
NEXT_PUBLIC_ADMIN_EMAILS="admin@example.com"
NEXT_PUBLIC_SUPERVISOR_EMAILS="supervisor@example.com"

# ── Google Sheets 成績自動寫入配置 ──
GOOGLE_SHEETS_RESULTS_ID="您的_Google_Sheet_ID"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-sa@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

開啟瀏覽器造訪 [http://localhost:3000](http://localhost:3000) 即可開始體驗！

---

## 📁 專案架構目錄 (Directory Structure)

```
cs_game/
├── AI/                         # AI 開發規範文件 (context / architecture / decisions / handoff)
├── public/                     # 靜態資源 (Fonts, Pixel Art Assets, Excel 導入範本)
└── src/
    ├── app/                    # Next.js App Router 路由頁面
    │   ├── (auth)/             # 登入與首次姓名設定 (/login, /setup)
    │   ├── admin/              # 主管與管理員後台
    │   │   ├── grade/          # 考卷審核與批改
    │   │   ├── questions/      # 題庫管理與 Excel 匯入
    │   │   ├── settings/       # 系統權限與參數管理
    │   │   └── users/          # 團隊考生考核總覽
    │   ├── api/                # API Routes (Google Sheets 匯出 /api/export-score)
    │   ├── exam/               # 考核模式考場 (quiz / essay)
    │   ├── leaderboard/        # 冒險英雄榜
    │   └── profile/            # 個人成績與錯題回顧
    ├── contexts/               # React AuthContext 全域身份監聽
    ├── lib/                    # 核心服務庫 (firebase, examStore, questionStore, googleSheets)
    └── types/                  # TypeScript 型別定義
```

---

## 📄 授權與維護 (License)

Distributed under the MIT License. See `LICENSE` for more information.
