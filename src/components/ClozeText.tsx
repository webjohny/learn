import { useEffect, useState } from 'react'

import { useT } from '@/lib/i18n'
import { parseCloze } from '@/lib/text'

interface ClozeTextProps {
  text: string
  /** Ховати cloze-фрагменти під блюром до кліку */
  blur: boolean
  className?: string
}

/** Рендерить фразу, ховаючи `*[фрагменти]*` під блюром до кліку по них. */
export function ClozeText({ text, blur, className = '' }: ClozeTextProps) {
  const segments = parseCloze(text)
  const t = useT()
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  useEffect(() => setRevealed(new Set()), [text, blur])

  return (
    <span className={className}>
      {segments.map((segment, i) => {
        if (!segment.cloze) return <span key={i}>{segment.text}</span>

        const isHidden = blur && !revealed.has(i)
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!isHidden) return
              setRevealed((prev) => new Set(prev).add(i))
            }}
            className={[
              'relative -mx-0.5 rounded-md px-1 py-0.5 align-baseline transition-all duration-300',
              isHidden
                ? 'cursor-pointer bg-brand-500/20 text-transparent blur-[6px] select-none'
                : 'cursor-default bg-brand-500/15 text-brand-600 dark:text-brand-400',
            ].join(' ')}
            aria-label={isHidden ? t('card.revealHidden') : segment.text}
            tabIndex={isHidden ? 0 : -1}
          >
            {segment.text}
          </button>
        )
      })}
    </span>
  )
}
