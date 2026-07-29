'use client'

import styles from './TimerBar.module.css'

interface TimerBarProps {
  /** 剩餘秒數 */
  timeLeft: number
  /** 總秒數（用於計算百分比） */
  totalTime: number
  /** 是否顯示倒數文字 */
  showLabel?: boolean
}

export default function TimerBar({ timeLeft, totalTime, showLabel = true }: TimerBarProps) {
  const percent = Math.max(0, (timeLeft / totalTime) * 100)
  const isDanger = timeLeft <= 60
  const isWarning = timeLeft <= 120 && timeLeft > 60

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timeLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className={styles.wrapper}>
      {showLabel && (
        <div className={styles.labels}>
          <span className={`${styles.label} ${isDanger ? styles.labelDanger : isWarning ? styles.labelWarning : ''}`}>
            ⏱️ 剩餘時間
          </span>
          <span className={`${styles.timeText} ${isDanger ? styles.timeDanger : isWarning ? styles.timeWarning : ''}`}>
            {timeLabel}
          </span>
        </div>
      )}
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isDanger ? styles.fillDanger : isWarning ? styles.fillWarning : ''}`}
          style={{ width: `${percent}%` }}
        />
        {/* 像素刻度線 */}
        {[25, 50, 75].map((mark) => (
          <div
            key={mark}
            className={styles.tick}
            style={{ left: `${mark}%` }}
          />
        ))}
      </div>
    </div>
  )
}
