const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: 題庫導入模板
  const ws1 = workbook.addWorksheet('題庫導入模板');
  
  ws1.columns = [
    { header: '題型 (type)', key: 'type', width: 16 },
    { header: '難易度 (difficulty)', key: 'difficulty', width: 22 },
    { header: '情境描述 (context)', key: 'context', width: 30 },
    { header: '題目主文 (content)', key: 'content', width: 40 },
    { header: '選項A (optionA)', key: 'optionA', width: 25 },
    { header: '選項B (optionB)', key: 'optionB', width: 25 },
    { header: '選項C (optionC)', key: 'optionC', width: 25 },
    { header: '選項D (optionD)', key: 'optionD', width: 25 },
    { header: '答案 (answer)', key: 'answer', width: 30 },
    { header: '解析 (explanation)', key: 'explanation', width: 35 },
    { header: '是否啟用 (enabled)', key: 'enabled', width: 18 }
  ];

  // 美化標題列 (Header Style)
  const headerRow = ws1.getRow(1);
  headerRow.font = { name: 'Microsoft JhengHei', bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // 預設範例資料
  const sampleRows = [
    {
      type: 'choice',
      difficulty: 'basic',
      context: '當顧客對出貨進度發問時',
      content: '下列何者為最佳第一句回應？',
      optionA: '這不是我們部門管的',
      optionB: '非常抱歉讓您久等了，這邊馬上為您查詢！',
      optionC: '請你自己上網看物流資訊',
      optionD: '系統壞了我也查不到',
      answer: 'B',
      explanation: '應先同理顧客並給予積極輔助的態度。',
      enabled: 'Y'
    },
    {
      type: 'choice',
      difficulty: 'medium',
      context: '顧客反映收到商品瑕疵時',
      content: '客服人員處理退換貨的第一優先步驟為何？',
      optionA: '要求顧客先自行郵寄回公司',
      optionB: '安撫顧客情緒並確認訂單細節與照片記錄',
      optionC: '直接告知系統無法辦理退貨',
      optionD: '轉接給技術人員處理',
      answer: 'B',
      explanation: '優先安撫顧客情緒並核對事實照片記錄，以利後續處理。',
      enabled: 'Y'
    },
    {
      type: 'qa',
      difficulty: 'medium',
      context: '',
      content: '請簡述處理顧客退貨要求時的三個標準步驟。',
      optionA: '無',
      optionB: '無',
      optionC: '無',
      optionD: '無',
      answer: '1. 核對訂單與退貨原因 2. 說明退貨政策與退款時程 3. 協助產生退貨標籤或派單取件',
      explanation: '需涵蓋核對、說明與協助三大要素。',
      enabled: 'Y'
    },
    {
      type: 'essay',
      difficulty: 'advanced',
      context: '客服遇到情緒高漲且要求不合理的 VIP 客戶時',
      content: '請分析如何處理此類情境，並寫出因應對策與話術擬定。',
      optionA: '無',
      optionB: '無',
      optionC: '無',
      optionD: '無',
      answer: '評分重點：1. 展現同理心 2. 設定合理界線 3. 升級處置機制',
      explanation: '此題無固定答案，主管批改時請依據評分重點給分。',
      enabled: 'Y'
    }
  ];

  sampleRows.forEach(row => ws1.addRow(row));

  // 設定 100 列的 Data Validation 下拉選單 (A列, B列, I列, K列)
  for (let i = 2; i <= 200; i++) {
    // 題型 (type): choice, qa, essay
    ws1.getCell(`A${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"choice,qa,essay"'],
      showErrorMessage: true,
      errorTitle: '輸入錯誤',
      error: '請從下拉選單選擇：choice (選擇題)、qa (問答題)、essay (申論題)'
    };

    // 難易度 (difficulty): basic, medium, advanced
    ws1.getCell(`B${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"basic,medium,advanced"'],
      showErrorMessage: true,
      errorTitle: '輸入錯誤',
      error: '請從下拉選單選擇：basic (基礎)、medium (中等)、advanced (進階)'
    };

    // 答案 (answer) 提示/下拉（選擇題可選 A, B, C, D）
    ws1.getCell(`I${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"A,B,C,D"'],
      showErrorMessage: false // 非強制限定，因為問答與申論題需輸入文字答案
    };

    // 是否啟用 (enabled): Y, N
    ws1.getCell(`K${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Y,N"'],
      showErrorMessage: true,
      errorTitle: '輸入錯誤',
      error: '請選擇 Y (啟用) 或 N (停用)'
    };
  }

  // Sheet 2: 填寫說明與規範
  const ws2 = workbook.addWorksheet('填寫說明與規範');
  ws2.columns = [
    { header: '欄位名稱', key: 'name', width: 22 },
    { header: '必填', key: 'required', width: 15 },
    { header: '下拉選單選項', key: 'options', width: 30 },
    { header: '範例', key: 'example', width: 30 },
    { header: '說明', key: 'desc', width: 50 }
  ];

  const headerRow2 = ws2.getRow(1);
  headerRow2.font = { name: 'Microsoft JhengHei', bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };

  ws2.addRows([
    { name: '題型 (type)', required: '是', options: 'choice | qa | essay', example: 'choice', desc: '【下拉選單】choice: 選擇題, qa: 問答題, essay: 申論題' },
    { name: '難易度 (difficulty)', required: '是', options: 'basic | medium | advanced', example: 'basic', desc: '【下拉選單】basic: 基礎, medium: 中等, advanced: 進階' },
    { name: '情境描述 (context)', required: '否', options: '無', example: '當顧客對出貨進度發問時', desc: '題目情境背景說明，可留空' },
    { name: '題目主文 (content)', required: '是', options: '無', example: '下列何者為最佳第一句回應？', desc: '題目本文內容' },
    { name: '選項 A~D', required: '選擇題必填', options: '無', example: '非常抱歉...', desc: '選擇題為必填，問答/申論題可填「無」或留空' },
    { name: '答案 (answer)', required: '是', options: 'A, B, C, D (適用選擇題)', example: 'B', desc: '選擇題可下拉選 A/B/C/D；問答題填標準解答；申論題填評分重點' },
    { name: '解析 (explanation)', required: '否', options: '無', example: '應先同理顧客...', desc: '測驗結束後顯示給考生的錯題解析' },
    { name: '是否啟用 (enabled)', required: '是', options: 'Y | N', example: 'Y', desc: '【下拉選單】Y: 啟用納入考題, N: 停用' }
  ]);

  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const templatePath = path.join(publicDir, 'question_import_template.xlsx');

  await workbook.xlsx.writeFile(templatePath);
  console.log('Successfully written Excel file with ExcelJS data validation to:', templatePath);
}

generateTemplate().catch(console.error);
