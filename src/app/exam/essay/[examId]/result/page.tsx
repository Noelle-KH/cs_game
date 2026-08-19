'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearEssayLock } from '@/lib/examSession'
import { getExamByIdFirestore, CloudExamDoc } from '@/lib/examStore'
import styles from './page.module.css'

const IS_DEV = process.env.NODE_ENV === 'development'

export default function EssayResultPage({
  params,
}: {
  params: Promise<{ examId: string }>
}) {
  const { examId } = use(params)
  const router = useRouter()
  const [exam, setExam] = useState<CloudExamDoc | null>(null)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    async function loadCloudExam() {
      const data = await getExamByIdFirestore(examId)
      if (!data && !IS_DEV) {
        router.replace('/exam/essay/lobby')
        return
      }
      setExam(data)
      setShowContent(true)
    }
    loadCloudExam()
  }, [examId, router])

  // DEV：清除鎖定按鈕（模擬主管批改完成）
  function handleDevClearLock() {
    clearEssayLock()
    alert('✅ DEV：已清除申論鎖定，現在可以回大廳重新開始新場次')
  }

  if (!exam) {
    return (
      <div className={styles.loading}>
        <p className="pixel-title animate-float">載入中...</p>
      </div>
    )
  }

  const answeredCount = exam.answers.filter(
    (a) => a.userAnswer.trim().length > 0
  ).length
  const expiredCount = exam.answers.filter((a) => !a.userAnswer.trim()).length
  const skippedCount = exam.answers.length - answeredCount

  return (
    <main className={`pixel-bg ${styles.main}`}>
      <div className={`container ${styles.content}`}>

        {/* ── 主卡片 ── */}
        <div className={`pixel-panel animate-slide-in ${styles.resultCard}`}>

          {/* 通過 / 未通過 / 等待批改 Banner */}
          {exam.status === 'graded' ? (
            <div className={`${styles.pendingBanner} ${exam.passed ? styles.bannerPassed : styles.bannerFailed}`}>
              <div className={styles.bannerIconWrap}>
                <span className={styles.bannerIcon}>
                  {exam.passed ? '🏆' : '📝'}
                </span>
              </div>
              <div className={styles.bannerTextWrap}>
                <p className={`pixel-title ${styles.bannerTitle}`}>
                  主管已完成閱卷批改！ (總得分：{exam.score} / 100)
                </p>
                <p className={styles.bannerSub}>
                  {exam.passed
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
              {exam.submittedAt ? new Date(exam.submittedAt).toLocaleString('zh-TW') : '已提交'}
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
              <span className={styles.statSub}>/ {exam.answers.length} 題</span>
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
                {exam.answers.map((ans, idx) => {
                  const q = ans.questionDoc
                  const hasAnswer = ans.userAnswer.trim().length > 0
                  return (
                    <div
                      key={ans.questionId}
                      className={`${styles.previewItem} ${
                        !hasAnswer ? styles.itemSkipped : styles.itemAnswered
                      }`}
                    >
                      <div className={styles.previewHeader}>
                        <span className={styles.previewNum}>第 {idx + 1} 題</span>
                        <span className={`${styles.previewStatus} ${
                          !hasAnswer ? styles.statusSkipped : styles.statusAnswered
                        }`}>
                          {!hasAnswer ? '⬜ 未答 / 超時' : '✅ 已答'}
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

                      {/* 批改結果 */}
                      {ans.score !== undefined && (
                        <div className={styles.gradeResult}>
                          <span className={styles.gradeScore}>評分：{ans.score} / 10</span>
                          {ans.feedback && (
                            <p className={styles.gradeComment}>💬 {ans.feedback}</p>
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
