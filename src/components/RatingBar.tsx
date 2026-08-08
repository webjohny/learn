import { motion } from 'framer-motion'

import { useT, type MessageKey } from '@/lib/i18n'
import { previewIntervals } from '@/lib/sm2'
import type { Card, Grade } from '@/types'

interface RatingOption {
  grade: Grade
  label: MessageKey
  hint: string
  className: string
}

const OPTIONS: RatingOption[] = [
  {
    grade: 0,
    label: 'rating.again',
    hint: '1',
    className:
      'border-rose-500/25 bg-rose-500/10 text-rose-600 hover:bg-rose-500/18 dark:text-rose-300',
  },
  {
    grade: 1,
    label: 'rating.hard',
    hint: '2',
    className:
      'border-amber-500/25 bg-amber-500/10 text-amber-600 hover:bg-amber-500/18 dark:text-amber-300',
  },
  {
    grade: 2,
    label: 'rating.good',
    hint: '3',
    className:
      'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/18 dark:text-emerald-300',
  },
  {
    grade: 3,
    label: 'rating.easy',
    hint: '4',
    className:
      'border-sky-500/25 bg-sky-500/10 text-sky-600 hover:bg-sky-500/18 dark:text-sky-300',
  },
]

interface RatingBarProps {
  card: Card
  onRate: (grade: Grade) => void
  /** Показувати прогноз наступного показу під кожною кнопкою */
  showIntervals?: boolean
}

export function RatingBar({ card, onRate, showIntervals = true }: RatingBarProps) {
  const t = useT()
  const intervals = previewIntervals(card)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="grid grid-cols-4 gap-1.5 sm:gap-2"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.grade}
          onClick={() => onRate(option.grade)}
          className={`btn flex-col gap-0.5 border py-2.5 sm:py-3 ${option.className}`}
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold sm:text-sm">
            {t(option.label)}
            <span className="kbd hidden sm:inline-flex">{option.hint}</span>
          </span>
          {showIntervals && (
            <span className="text-[10px] font-medium opacity-70">{intervals[option.grade]}</span>
          )}
        </button>
      ))}
    </motion.div>
  )
}
