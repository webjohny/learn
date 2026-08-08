/** Точка входу для test/scheduler.mjs. */
export { schedule, isDue, isNew, previewIntervals, RELEARN_MINUTES, DAY, MINUTE } from '@/lib/sm2'
export { buildQueue } from '@/hooks/useStudySession'
export { normalizeCard } from '@/lib/deck'
