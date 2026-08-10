import { NextRequest, NextResponse } from 'next/server'
import { appendScoreToGoogleSheet, SheetExportRow } from '@/lib/googleSheets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      spreadsheetId,
      email,
      displayName,
      date,
      mode,
      score,
      maxScore = 100,
      passed,
      attemptCount = 1,
    } = body

    // 優先從請求參數取得 Sheet ID，若無則從環境變數取得
    const targetSheetId = spreadsheetId || process.env.GOOGLE_SHEETS_RESULTS_ID

    if (!email || !displayName || score === undefined || passed === undefined) {
      return NextResponse.json(
        { error: '缺少必要的成績資料欄位 (email, displayName, score, passed)' },
        { status: 400 }
      )
    }

    const scoreNum = Number(score)
    const maxNum = Number(maxScore)
    const percentageText = `${Math.round((scoreNum / maxNum) * 100)}%`
    const passedText = Boolean(passed) ? 'PASS' : 'FAIL'
    const dateText = date || new Date().toLocaleString('zh-TW', { hour12: false })

    const rowData: SheetExportRow = {
      email,
      displayName,
      date: dateText,
      mode: mode === 'essay' ? '申論模式' : '綜合模式',
      score: scoreNum,
      maxScore: maxNum,
      scorePercentage: percentageText,
      passed: passedText,
      attemptCount,
    }

    // 若尚未設定 Sheet ID 或未配置環境變數 Service Account 金鑰，回傳模擬寫入成功（全系統安全相容）
    if (!targetSheetId || (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !process.env.FIREBASE_ADMIN_CLIENT_EMAIL)) {
      console.warn('[API export-score] 未檢測到 Google Sheets 配置，改以 DEV 模擬匯出日誌處理：', rowData)
      return NextResponse.json({
        success: true,
        isMock: true,
        message: 'Google Sheet ID 或 Service Account 未設定，已寫入 DEV 模擬日誌。',
        data: rowData,
      })
    }

    const result = await appendScoreToGoogleSheet(targetSheetId, rowData)

    return NextResponse.json({
      success: true,
      isMock: false,
      message: '成功自動寫入成績至 Google Sheets',
      updatedRange: result.updatedRange,
      data: rowData,
    })
  } catch (error: any) {
    console.error('[API export-score] Error:', error)
    return NextResponse.json(
      { error: error?.message || '寫入 Google Sheets 時發生錯誤' },
      { status: 500 }
    )
  }
}
