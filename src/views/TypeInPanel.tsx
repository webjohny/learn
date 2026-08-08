import { motion } from 'framer-motion'
import { useRef, useState } from 'react'

import { RatingBar } from '@/components/RatingBar'
import { Icon } from '@/components/ui/Icon'
import { useT, type MessageKey } from '@/lib/i18n'
import { diffWords, similarity, stripCloze } from '@/lib/text'
import type { Card, Grade } from '@/types'

/** Індекс = `Grade`, тож порядок збігається з 0..3. */
const GRADE_KEYS: MessageKey[] = ['rating.again', 'rating.hard', 'rating.good', 'rating.easy']

interface TypeInPanelProps {
  card: Card
  revealed: boolean
  onReveal: () => void
  onRate: (grade: Grade) => void
  reverse: boolean
}

/** Активне пригадування: користувач набирає фразу, ми показуємо посимвольну точність. */
export function TypeInPanel({ card, revealed, onReveal, onRate, reverse }: TypeInPanelProps) {
  const t = useT()
  const expected = reverse ? card.front : card.back
  const [value, setValue] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const check = () => {
    if (revealed || !value.trim()) return
    setScore(similarity(value, expected))
    onReveal()
  }

  const suggested: Grade = score === null ? 0 : score >= 0.97 ? 2 : score >= 0.8 ? 1 : 0
  const percent = score === null ? 0 : Math.round(score * 100)

  return (
    <div className="space-y-2.5">
      {!revealed ? (
        <>
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                check()
              }
            }}
            rows={2}
            autoFocus
            placeholder={t('typeIn.placeholder')}
            className="field resize-none text-base"
          />
          <div className="flex gap-2">
            <button className="btn-soft flex-1" onClick={onReveal}>
              {t('typeIn.dontKnow')}
            </button>
            <button className="btn-primary flex-[2]" onClick={check} disabled={!value.trim()}>
              <Icon name="check" size={16} /> {t('typeIn.check')}
              <span className="kbd ml-1 hidden border-white/25 bg-white/15 text-white sm:inline-flex">
                Enter
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          {score !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface space-y-2 p-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-500 dark:text-ink-400">{t('typeIn.yourAnswer')}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    percent >= 97
                      ? 'text-emerald-500'
                      : percent >= 80
                        ? 'text-amber-500'
                        : 'text-rose-500'
                  }`}
                >
                  {t('typeIn.match', { percent })}
                </span>
              </div>
              <p className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm leading-relaxed">
                {diffWords(value, expected).map((word, i) => (
                  <span
                    key={i}
                    className={
                      word.ok
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 line-through decoration-rose-500/50'
                    }
                  >
                    {word.word}
                  </span>
                ))}
              </p>
              <p className="border-t border-ink-200/70 pt-2 text-sm text-ink-500 dark:border-white/8 dark:text-ink-400">
                {t('typeIn.expected')} <span className="text-ink-900 dark:text-ink-100">{stripCloze(expected)}</span>
              </p>
            </motion.div>
          )}

          <div className="space-y-1.5">
            {score !== null && (
              <p className="text-center text-[11px] text-ink-400">
                {t('typeIn.suggested')}{' '}
                <span className="font-semibold">
                  {t(GRADE_KEYS[suggested])}
                </span>
              </p>
            )}
            <RatingBar card={card} onRate={onRate} />
          </div>
        </>
      )}
    </div>
  )
}
