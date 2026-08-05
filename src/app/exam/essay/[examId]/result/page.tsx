'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadEssaySession,
  EssayExamSession,
  clearEssayLock,
} from '@/lib/examSession'
import { MOCK_ESSAY_QUESTIONS_MAP } from '@/lib/mockData'
import styles from './page.module.css'

const IS_DEV = process.env.NODE_ENV === 'development'

export default function EssayResultPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = use(params)
  const router = useRouter()
  const [session, setSession] = useState<EssayExamSession | null>(null)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const data = loadEssaySession(examId)
    if (!data && !IS_DEV) {
      router.replace('/exam/essay/lobby')
      return
    }
    const effective = data ?? MOCK_SUBMITTED_SESSION(examId)
    setSession(effective)
    const t = setTimeout(() => setShowContent(true), 300)
    return () => clearTimeout(t)
  }, [examId, router])

  // DEV：清除鎖定按鈕（模擬主管批改完成）
  function handleDevClearLock() {
    clearEssayLock()
    alert('✅ DEV：已清除申論鎖定，現在可以回大廳重新開始新場次')
  }

  if (!session) {
    return (
      <div className={styles.loading}>
        <p className="pixel-title animate-float">載入中...</p>
      </div>
    )
  }

  const answeredCount = session.answers.filter(
    (a) => a.userAnswer.trim().length > 0
  ).length
  const expiredCount = session.answers.filter((a) => a.timeExpired).length
  const skippedCount = session.answers.length - answeredCount

  return (
    <main className={`pixel-bg ${styles.main}`}>
      <div className={`container ${styles.content}`}>

        {/* ── 主卡片 ── */}
        <div className={`pixel-panel animate-slide-in ${styles.resultCard}`}>

          {/* 通過 / 未通過 / 等待批改 Banner */}
          {session.status === 'graded' ? (
            <div className={`${styles.pendingBanner} ${session.answers.reduce((acc, a) => acc + (a.score || 0), 0) >= 90 ? styles.bannerPassed : styles.bannerFailed}`}>
              <div className={styles.bannerIconWrap}>
                <span className={styles.bannerIcon}>
                  {session.answers.reduce((acc, a) => acc + (a.score || 0), 0) >= 90 ? '🏆' : '📝'}
                </span>
              </div>
              <div className={styles.bannerTextWrap}>
                <p className={`pixel-title ${styles.bannerTitle}`}>
                  主管已完成閱卷批改！ (總得分：{session.answers.reduce((acc, a) => acc + (a.score || 0), 0)} / 100)
                </p>
                <p className={styles.bannerSub}>
                  {session.answers.reduce((acc, a) => acc + (a.score || 0), 0) >= 90
                    ? '恭喜通過本月申論考核！請於下方查看主管針對各題給予的指導評語。'
                    : '本月申論分數未達 90 分通過門檻，請仔細檢視主管評語與改進建議。'}
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.pendingBanner}>
              <div className={styles.bannerIconWrap}>
                <span className={styles.bannerIcon}>📨</span>
              </div>
              <div className={styles.bannerTextWrap}>
                <p className={`pixel-title ${styles.bannerTitle}`}>申論已成功提交！</p>
                <p className={styles.bannerSub}>
                  你的作答已送出，正在等待主管批改評分。<br />
                  批改完成後你將收到系統通知，請耐心等候。
                </p>
              </div>
            </div>
          )}

          {/* 時間戳 */}
          <div className={styles.timestampRow}>
            <span className={styles.timestampLabel}>📅 提交時間</span>
            <span className={styles.timestampValue}>
              {new Date(session.submittedAt).toLocaleString('zh-TW')}
            </span>
          </div>

          {/* 統計摘要 */}
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>✅</span>
              <span className={`pixel-title ${styles.statValue} ${styles.colorGreen}`}>
                {answeredCount}
              </span>
              <span className={styles.statLabel}>已作答</span>
              <span className={styles.statSub}>/ {session.answers.length} 題</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>⏱️</span>
              <span className={`pixel-title ${styles.statValue} ${expiredCount > 0 ? styles.colorRed : styles.colorGreen}`}>
                {expiredCount}
              </span>
              <span className={styles.statLabel}>超時略過</span>
              <span className={styles.statSub}>題</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>📝</span>
              <span className={`pixel-title ${styles.statValue} ${skippedCount > 0 ? styles.colorOrange : styles.colorGreen}`}>
                {skippedCount}
              </span>
              <span className={styles.statLabel}>未作答</span>
              <span className={styles.statSub}>題</span>
            </div>
          </div>

          {/* 作答預覽列表 */}
          {showContent && (
            <div className={styles.previewSection}>
              <h2 className={`pixel-title ${styles.previewTitle}`}>📋 作答內容預覽</h2>
              <div className={styles.previewList}>
                {session.answers.map((ans, idx) => {
                  const q = MOCK_ESSAY_QUESTIONS_MAP[ans.questionId]
                  const hasAnswer = ans.userAnswer.trim().length > 0
                  return (
                    <div
                      key={ans.questionId}
                      className={`${styles.previewItem} ${
                        ans.timeExpired ? styles.itemExpired :
                        !hasAnswer ? styles.itemSkipped :
                        styles.itemAnswered
                      }`}
                    >
                      <div className={styles.previewHeader}>
                        <span className={styles.previewNum}>第 {idx + 1} 題</span>
                        <span className={`${styles.previewStatus} ${
                          ans.timeExpired ? styles.statusExpired :
                          !hasAnswer ? styles.statusSkipped :
                          styles.statusAnswered
                        }`}>
                          {ans.timeExpired ? '⏱️ 超時' : !hasAnswer ? '⬜ 未答' : '✅ 已答'}
                        </span>
                        <span className={styles.previewWordCount}>
                          {ans.userAnswer.length} 字
                        </span>
                      </div>
                      {q && (
                        <p className={styles.previewQuestion}>
                          {q.content.length > 60 ? q.content.slice(0, 60) + '…' : q.content}
                        </p>
                      )}
                      {hasAnswer ? (
                        <p className={styles.previewAnswer}>
                          {ans.userAnswer.length > 100
                            ? ans.userAnswer.slice(0, 100) + '…'
                            : ans.userAnswer}
                        </p>
                      ) : (
                        <p className={styles.previewEmpty}>（未作答）</p>
                      )}

                      {/* 批改結果（假資料範例，實際由後端填入） */}
                      {ans.score !== undefined && (
                        <div className={styles.gradeResult}>
                          <span className={styles.gradeScore}>評分：{ans.score} / 10</span>
                          {ans.comment && (
                            <p className={styles.gradeComment}>💬 {ans.comment}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 提醒文字 */}
          <div className={styles.reminderBox}>
            <p className={styles.reminderText}>
              🔒 本場申論正在批改中，完成前無法開始新場次。<br />
              批改完成後可至「我的成績」頁查看詳細評語。
            </p>
          </div>

          {/* 操作按鈕 */}
          <div className={styles.actions}>
            <button
              id="btn-home"
              className={`btn-pixel btn-secondary ${styles.actionBtn}`}
              onClick={() => router.push('/')}
            >
              🏠 回首頁
            </button>
            <button
              id="btn-go-lobby"
              className={`btn-pixel btn-ghost ${styles.actionBtn}`}
              onClick={() => router.push('/exam/essay/lobby')}
            >
              📝 回申論大廳
            </button>
          </div>

          {/* DEV 工具 */}
          {IS_DEV && (
            <div className={styles.devTools}>
              <p className={styles.devLabel}>⚠️ DEV TOOLS</p>
              <button
                className={`btn-pixel btn-ghost ${styles.devBtn}`}
                onClick={handleDevClearLock}
              >
                模擬主管批改完成（清除鎖定）
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

// ── DEV fallback session ─────────────────────────────────────────
function MOCK_SUBMITTED_SESSION(examId: string): EssayExamSession {
  return {
    examId,
    mode: 'essay',
    displayName: '開發測試員',
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    answers: [
      { questionId: 'eq-001', userAnswer: '我會首先向客戶誠摯道歉，並表示理解他的等待。接著快速確認問題並給予明確的後續時間承諾，讓客戶知道我正在積極協助他。', timeExpired: false },
      { questionId: 'eq-002', userAnswer: '先確認訂單資訊與配送地址是否正確，再聯繫物流公司查詢包裹狀態，同時告知客戶預計回覆時間，並在確認後主動聯繫客戶。', timeExpired: false },
      { questionId: 'eq-003', userAnswer: '理解客戶的挫折感，說明公司政策的原因，同時提供維修服務並加快時程，若客戶仍不接受再向主管請求特例授權。', timeExpired: false },
      { questionId: 'eq-004', userAnswer: '向每位客戶說明目前發現系統異常正在緊急處理，提供預計回覆時間，並建立追蹤清單確保問題解決後主動通知每位客戶。', timeExpired: false },
      { questionId: 'eq-005', userAnswer: '放慢語速，使用更簡單的詞彙，一次只說一個步驟。主動詢問客戶是否跟上，並給予充足時間操作。同時保持耐心，讓客戶感到被尊重。', timeExpired: false },
      { questionId: 'eq-006', userAnswer: '', timeExpired: true },
      { questionId: 'eq-007', userAnswer: '開場時先感謝客戶長期支持，再清楚說明政策變更內容與原因，強調公司提供的新方案優勢，最後以感謝作結並確認客戶是否有疑問。', timeExpired: false },
      { questionId: 'eq-008', userAnswer: '私下和善地與同事分享我的觀察，以「客戶反饋」而非「批評」的角度切入，共同討論如何改善溝通方式，展現團隊合作精神。', timeExpired: false },
      { questionId: 'eq-009', userAnswer: '先向緊急投訴的客戶說明需要 1 分鐘完成手邊事務，請等候中客戶稍等，處理完緊急案件後立即回頭服務等候的客戶，並說明原因。', timeExpired: false },
      { questionId: 'eq-010', userAnswer: '我這個月在「同理心表達」與「問題解決效率」上表現較好。最需改善的是「複雜問題的結構化說明」。下個月計劃每週練習一個情境案例的標準話術。', timeExpired: false },
    ],
  }
}
