import { useMemo } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { dayKey, formatDuration, formatRelative, lastNDays, shiftDay } from '@/lib/date'
import { isNew } from '@/lib/sm2'
import { useCards, useDays, useLog, useMaturity, useToday } from '@/store/selectors'
import { useQuizzes } from '@/store/useQuizzes'

const HISTORY_DAYS = 14
const FORECAST_DAYS = 7
const WEEKDAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export function StatsView() {
  const days = useDays()
  const cards = useCards()
  const log = useLog()
  const today = useToday()
  const maturity = useMaturity()

  const history = useMemo(
    () => lastNDays(HISTORY_DAYS).map((date) => ({ date, reviews: days[date]?.reviews ?? 0 })),
    [days],
  )
  const maxReviews = Math.max(1, ...history.map((d) => d.reviews))

  const forecast = useMemo(() => {
    const buckets = Array.from({ length: FORECAST_DAYS }, (_, i) => ({
      date: shiftDay(dayKey(), i),
      count: 0,
    }))
    const index = new Map(buckets.map((b, i) => [b.date, i]))

    for (const card of cards) {
      if (card.suspended || isNew(card) || !card.nextReview) continue
      const key = dayKey(card.nextReview)
      const slot = index.get(key)
      if (slot !== undefined) buckets[slot].count++
      else if (new Date(card.nextReview).getTime() < Date.now()) buckets[0].count++
    }
    return buckets
  }, [cards])

  const maxForecast = Math.max(1, ...forecast.map((f) => f.count))

  const totals = useMemo(() => {
    const reviews = Object.values(days).reduce((sum, d) => sum + d.reviews, 0)
    const correct = Object.values(days).reduce((sum, d) => sum + d.correct, 0)
    const seconds = Object.values(days).reduce((sum, d) => sum + d.seconds, 0)
    return {
      reviews,
      accuracy: reviews ? Math.round((correct / reviews) * 100) : 0,
      seconds,
      activeDays: Object.values(days).filter((d) => d.reviews > 0).length,
    }
  }, [days])

  const hardest = useMemo(() => {
    const misses = new Map<string, number>()
    for (const entry of log) {
      if (entry.grade === 0) misses.set(entry.cardId, (misses.get(entry.cardId) ?? 0) + 1)
    }
    return [...misses.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ card: cards.find((c) => c.id === id), count }))
      .filter((item): item is { card: NonNullable<typeof item.card>; count: number } =>
        Boolean(item.card),
      )
  }, [log, cards])

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile icon="flame" value={today.streak} label="днів поспіль" tone="orange" />
        <Tile icon="clock" value={formatDuration(today.seconds)} label="практики сьогодні" />
        <Tile icon="target" value={`${today.accuracy}%`} label="точність сьогодні" tone="emerald" />
        <Tile icon="cards" value={today.reviews} label="повторень сьогодні" tone="brand" />
      </div>

      <section className="surface p-4">
        <SectionTitle icon="chart" title="Активність за 2 тижні" hint={`${totals.reviews} повторень усього`} />
        <div className="mt-4 flex h-32 items-stretch gap-1.5">
          {history.map((day) => {
            const height = day.reviews ? Math.max(8, (day.reviews / maxReviews) * 100) : 3
            const isToday = day.date === dayKey()
            return (
              <div
                key={day.date}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="text-[10px] font-medium tabular-nums text-ink-400 opacity-0 transition-opacity group-hover:opacity-100">
                  {day.reviews}
                </span>
                <div className="flex min-h-0 w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-md transition-all ${
                      day.reviews
                        ? isToday
                          ? 'bg-gradient-to-t from-brand-600 to-sky-400'
                          : 'bg-brand-500/45'
                        : 'bg-ink-900/8 dark:bg-white/8'
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.reviews}`}
                  />
                </div>
                <span className="text-[9px] text-ink-400">
                  {WEEKDAYS[new Date(day.date).getDay()]}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="surface p-4">
          <SectionTitle icon="layers" title="Стан колоди" hint={`${maturity.total} карток`} />
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-ink-900/8 dark:bg-white/8">
            <Segment value={maturity.mature} total={maturity.total} className="bg-emerald-500" />
            <Segment value={maturity.young} total={maturity.total} className="bg-brand-500" />
            <Segment value={maturity.fresh} total={maturity.total} className="bg-ink-400/60" />
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            <Legend color="bg-emerald-500" label="Засвоєні (21+ днів)" value={maturity.mature} />
            <Legend color="bg-brand-500" label="У процесі" value={maturity.young} />
            <Legend color="bg-ink-400/60" label="Ще не вивчені" value={maturity.fresh} />
          </ul>
        </section>

        <section className="surface p-4">
          <SectionTitle icon="clock" title="Прогноз на тиждень" hint="скільки карток чекає" />
          <div className="mt-4 flex h-24 items-stretch gap-1.5">
            {forecast.map((day, i) => (
              <div
                key={day.date}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="text-[10px] font-medium tabular-nums text-ink-400">
                  {day.count || ''}
                </span>
                <div className="flex min-h-0 w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-md ${day.count ? 'bg-sky-500/55' : 'bg-ink-900/8 dark:bg-white/8'}`}
                    style={{
                      height: `${day.count ? Math.max(10, (day.count / maxForecast) * 100) : 4}%`,
                    }}
                  />
                </div>
                <span className="text-[9px] text-ink-400">{i === 0 ? 'сьог' : `+${i}`}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="surface p-4">
          <SectionTitle icon="award" title="Загалом" />
          <dl className="mt-3 space-y-2 text-[13px]">
            <Row label="Повторень" value={totals.reviews} />
            <Row label="Середня точність" value={`${totals.accuracy}%`} />
            <Row label="Час практики" value={formatDuration(totals.seconds)} />
            <Row label="Активних днів" value={totals.activeDays} />
          </dl>
        </section>

        <section className="surface p-4">
          <SectionTitle icon="zap" title="Найскладніші фрази" hint="за кількістю «Забув»" />
          {hardest.length ? (
            <ul className="mt-3 space-y-2">
              {hardest.map(({ card, count }) => (
                <li key={card.id} className="flex items-start gap-2 text-[13px]">
                  <span className="mt-0.5 shrink-0 rounded-md bg-rose-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-rose-500">
                    {count}×
                  </span>
                  <span className="min-w-0 flex-1 truncate">{card.back.replace(/\*\[|\]\*/g, '')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-ink-400">
              Поки що жодної забутої картки — так тримати.
            </p>
          )}
        </section>
      </div>

      <QuizStats />
    </div>
  )
}

/**
 * Окрема секція: вікторини не пов'язані з картками, тож їхні числа не
 * зливаються з метриками SM-2 вище.
 */
function QuizStats() {
  const quizzes = useQuizzes((s) => s.quizzes)
  const runs = useQuizzes((s) => s.runs)

  const recent = useMemo(
    () => [...runs].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 5),
    [runs],
  )

  const totals = useMemo(() => {
    const score = runs.reduce((sum, r) => sum + r.score, 0)
    const total = runs.reduce((sum, r) => sum + r.total, 0)
    return { runs: runs.length, accuracy: total ? Math.round((score / total) * 100) : 0 }
  }, [runs])

  const titleOf = (quizId: string) =>
    quizzes.find((q) => q.id === quizId)?.title ?? 'Видалена вікторина'

  return (
    <section className="surface p-4">
      <SectionTitle
        icon="target"
        title="Вікторини"
        hint={totals.runs ? `${totals.runs} прогонів · ${totals.accuracy}% точності` : undefined}
      />
      {recent.length ? (
        <ul className="mt-3 space-y-2">
          {recent.map((run) => (
            <li key={run.id} className="flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{titleOf(run.quizId)}</span>
              <span className="shrink-0 text-[11px] text-ink-400">
                {formatRelative(run.finishedAt)}
              </span>
              <span className="shrink-0 rounded-md bg-brand-500/12 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                {run.score}/{run.total}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-ink-400">
          Жодного прогону. Вікторини живуть окремо від карток — на прогрес колоди вони не впливають.
        </p>
      )}
    </section>
  )
}

function SectionTitle({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={16} className="text-ink-400" />
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <span className="ml-auto text-[11px] text-ink-400">{hint}</span>}
    </div>
  )
}

const tileTones = {
  default: 'text-ink-500 dark:text-ink-400',
  orange: 'text-orange-500',
  emerald: 'text-emerald-500',
  brand: 'text-brand-500',
}

function Tile({
  icon,
  value,
  label,
  tone = 'default',
}: {
  icon: IconName
  value: string | number
  label: string
  tone?: keyof typeof tileTones
}) {
  return (
    <div className="surface p-3.5">
      <Icon name={icon} size={17} className={tileTones[tone]} />
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-ink-400">{label}</div>
    </div>
  )
}

function Segment({ value, total, className }: { value: number; total: number; className: string }) {
  if (!value) return null
  return <div className={className} style={{ width: `${(value / Math.max(1, total)) * 100}%` }} />
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`size-2.5 rounded-full ${color}`} />
      <span className="flex-1 text-ink-500 dark:text-ink-400">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </li>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-500 dark:text-ink-400">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
