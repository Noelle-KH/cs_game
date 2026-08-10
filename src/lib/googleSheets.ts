import { google } from 'googleapis'

export interface SheetExportRow {
  email: string
  displayName: string
  date: string
  mode: string
  score: number
  maxScore: number
  scorePercentage: string
  passed: string
  attemptCount: number | string
}

/**
 * 取得 Google Sheets 服務客戶端認證（使用 Service Account 金鑰）
 */
function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY)?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Service Account Credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)')
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

/**
 * 將單筆成績資料追加 (append) 到指定 Google Sheet 頁籤中
 * 依據 architecture.md 規範欄位：
 * Email | 顯示名稱 | 考試日期 | 模式 | 得分 | 總分 | 得分率 | 是否通過 | 累計考試次數
 */
export async function appendScoreToGoogleSheet(
  spreadsheetId: string,
  rowData: SheetExportRow
): Promise<{ success: boolean; updatedRange?: string }> {
  try {
    const sheets = getSheetsClient()

    const values = [
      [
        rowData.email,
        rowData.displayName,
        rowData.date,
        rowData.mode,
        rowData.score,
        rowData.maxScore,
        rowData.scorePercentage,
        rowData.passed,
        rowData.attemptCount,
      ]
    ]

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:I', // 預設寫入 Sheet1 或試算表的第一頁
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    })

    return {
      success: true,
      updatedRange: response.data.updates?.updatedRange || undefined,
    }
  } catch (error) {
    console.error('[GoogleSheets] Append score failed:', error)
    throw error
  }
}
