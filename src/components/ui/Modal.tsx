import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useT } from '@/lib/i18n'
import { useOverlayRegistration } from '@/store/useOverlay'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** Ширина контенту; на мобільному завжди на всю ширину */
  size?: 'sm' | 'md' | 'lg'
}

const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const t = useT()
  // Поки вікно відкрите, гарячі клавіші навчання мають мовчати.
  useOverlayRegistration(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink-200 bg-white shadow-2xl sm:rounded-3xl dark:border-white/10 dark:bg-ink-900 ${widths[size]}`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <header className="flex items-start gap-3 border-b border-ink-200/70 px-5 py-4 dark:border-white/8">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">{title}</h2>
                {description && (
                  <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p>
                )}
              </div>
              <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label={t('common.close')}>
                <Icon name="x" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <footer className="safe-b flex flex-wrap items-center justify-end gap-2 border-t border-ink-200/70 px-5 py-3 sm:pb-3 dark:border-white/8">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
