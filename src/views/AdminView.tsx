import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { GrantCardsDialog } from '@/components/GrantCardsDialog'
import { Icon, type IconName } from '@/components/ui/Icon'
import {
  adminApi,
  type AdminOverview,
  type AdminUserDetail,
  type AdminUserSummary,
} from '@/lib/api'
import { formatDuration } from '@/lib/date'
import { useLocale, useT, type Translate } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/i18n/apiError'
import { pairLabel } from '@/lib/langs'
import { useSession } from '@/store/useSession'

/**
 * Панель власника: зведення по акаунтах і передача карток. Доступ вирішує
 * сервер (`AdminGuard`); тут ховаємо екран лише щоб не показувати порожнечу.
 */
export function AdminView() {
  const status = useSession((s) => s.status)
  const me = useSession((s) => s.user)
  const t = useT()

  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [grantOpen, setGrantOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextOverview, nextUsers] = await Promise.all([adminApi.overview(), adminApi.users()])
      setOverview(nextOverview)
      setUsers(nextUsers.users)
      setError(null)
    } catch (e) {
      setError(apiErrorMessage(e, t, t('admin.loadFailed')))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetail(await adminApi.user(id))
      } catch (e) {
        setError(apiErrorMessage(e, t, t('admin.loadFailed')))
      }
    },
    [t],
  )

  useEffect(() => {
    if (status === 'authed' && me?.isAdmin) void load()
  }, [status, me?.isAdmin, load])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(needle) ||
        user.displayName.toLowerCase().includes(needle),
    )
  }, [users, query])

  // Поки сесія піднімається, редирект був би хибним: `isAdmin` ще невідомий.
  if (status === 'loading') return <p className="p-6 text-sm text-ink-400">{t('common.loading')}</p>
  if (!me?.isAdmin) return <Navigate to="/" replace />

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <div className="flex items-center gap-2">
        <Icon name="award" size={17} className="text-brand-500" />
        <h2 className="text-sm font-semibold">{t('admin.title')}</h2>
        <span className="text-[11px] text-ink-400">{t('admin.hint')}</span>
        <button
          className="btn-soft ml-auto px-2.5 py-1.5 text-xs"
          onClick={() => {
            void load()
            if (selectedId) void loadDetail(selectedId)
          }}
          disabled={loading}
        >
          <Icon name="rotate" size={14} /> {t('admin.refresh')}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}

      {overview && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile icon="user" value={overview.totals.users} label={t('admin.users')} tone="brand" />
            <Tile
              icon="flame"
              value={overview.activeToday}
              label={t('admin.activeToday')}
              tone="orange"
            />
            <Tile icon="cards" value={overview.totals.cards} label={t('admin.totalCards')} />
            <Tile
              icon="chart"
              value={overview.totals.reviews}
              label={t('admin.totalReviews')}
              tone="emerald"
            />
          </div>

          <section className="surface p-4">
            <SectionTitle
              icon="chart"
              title={t('admin.activity')}
              hint={t('admin.activityHint', {
                reviews: overview.daily.reduce((sum, day) => sum + day.reviews, 0),
                peak: Math.max(0, ...overview.daily.map((day) => day.users)),
              })}
            />
            <Bars data={overview.daily.map((day) => ({ key: day.date, value: day.reviews }))} />
            <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
              <Row label={t('admin.activeWeek')} value={overview.activeWeek} />
              <Row label={t('admin.newUsersWeek')} value={overview.newUsersWeek} />
              <Row label={t('admin.totalDecks')} value={overview.totals.decks} />
              <Row label={t('admin.totalQuizzes')} value={overview.totals.quizzes} />
              <Row label={t('admin.totalTime')} value={formatDuration(overview.totals.seconds)} />
              <Row
                label={t('admin.avgAccuracy')}
                value={`${percent(overview.totals.correct, overview.totals.reviews)}%`}
              />
            </dl>
          </section>
        </>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="surface p-4">
          <SectionTitle
            icon="user"
            title={t('admin.usersList')}
            hint={String(visibleUsers.length)}
          />
          <input
            className="field mt-3"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.searchUsers')}
          />
          <ul className="mt-2 space-y-1">
            {visibleUsers.map((user) => (
              <li key={user.id}>
                <button
                  onClick={() => setSelectedId(user.id === selectedId ? null : user.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    user.id === selectedId
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'hover:bg-ink-900/4 dark:hover:bg-white/6'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{user.displayName}</span>
                      {user.isAdmin && <span className="chip">{t('admin.adminBadge')}</span>}
                      {user.id === me.id && (
                        <span className="text-[10px] text-ink-400">{t('admin.you')}</span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-ink-400">{user.email}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-ink-400">
                    <span className="block tabular-nums">
                      {user.cards} · {user.reviews}
                    </span>
                    <span className="block">{user.lastActiveDate ?? t('admin.never')}</span>
                  </span>
                </button>
              </li>
            ))}
            {!visibleUsers.length && (
              <li className="px-2.5 py-2 text-[13px] text-ink-400">{t('admin.noUsers')}</li>
            )}
          </ul>
        </section>

        {detail ? (
          <UserPanel detail={detail} t={t} onSend={() => setGrantOpen(true)} />
        ) : (
          <section className="surface grid place-items-center p-6 text-[13px] text-ink-400">
            {t('admin.pickUser')}
          </section>
        )}
      </div>

      {detail && (
        <GrantCardsDialog
          open={grantOpen}
          onClose={() => setGrantOpen(false)}
          user={detail.user}
          decks={detail.decks}
          onGranted={() => {
            void load()
            void loadDetail(detail.user.id)
          }}
        />
      )}
    </div>
  )
}

function UserPanel({
  detail,
  t,
  onSend,
}: {
  detail: AdminUserDetail
  t: Translate
  onSend: () => void
}) {
  const locale = useLocale()
  const { user, decks, daily, recentRuns } = detail
  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale) : t('admin.never')

  return (
    <section className="surface space-y-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{user.displayName}</h3>
          <p className="truncate text-[11px] text-ink-400">{user.email}</p>
          <p className="text-[11px] text-ink-400">
            {t('admin.registered', { when: formatDate(user.createdAt) })} ·{' '}
            {t('admin.lastSession', { when: formatDate(user.lastSessionAt) })}
          </p>
        </div>
        <button className="btn-primary shrink-0 px-2.5 py-1.5 text-xs" onClick={onSend}>
          <Icon name="upload" size={14} /> {t('admin.sendCards')}
        </button>
      </div>

      <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
        <Row label={t('admin.totalCards')} value={user.cards} />
        <Row label={t('admin.totalReviews')} value={user.reviews} />
        <Row label={t('admin.accuracy')} value={`${percent(user.correct, user.reviews)}%`} />
        <Row label={t('admin.practiceTime')} value={formatDuration(user.seconds)} />
      </dl>

      <div>
        <SectionTitle icon="chart" title={t('admin.userActivity')} />
        <Bars data={daily.map((day) => ({ key: day.date, value: day.reviews }))} compact />
      </div>

      <div>
        <SectionTitle icon="layers" title={t('admin.userDecks')} />
        <ul className="mt-2 space-y-1.5 text-[13px]">
          {decks.map((deck) => (
            <li key={deck.id} className="flex items-center gap-2">
              <span className="shrink-0">{pairLabel(deck.sourceLang, deck.targetLang)}</span>
              <span className="min-w-0 flex-1 truncate">{deck.name}</span>
              <span className="shrink-0 text-[11px] text-ink-400">
                {t('admin.deckCards', { cards: deck.cards, due: deck.due })}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionTitle icon="target" title={t('admin.userQuizzes')} />
        {recentRuns.length ? (
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {recentRuns.map((run) => (
              <li key={run.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {run.title ?? t('admin.quizDeleted')}
                </span>
                <span className="shrink-0 rounded-md bg-brand-500/12 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                  {run.score}/{run.total}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-ink-400">{t('admin.noQuizRuns')}</p>
        )}
      </div>
    </section>
  )
}

function percent(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0
}

function Bars({
  data,
  compact = false,
}: {
  data: { key: string; value: number }[]
  compact?: boolean
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className={`mt-3 flex items-stretch gap-1 ${compact ? 'h-16' : 'h-28'}`}>
      {data.map((item) => (
        <div key={item.key} className="flex min-h-0 flex-1 items-end" title={`${item.key}: ${item.value}`}>
          <div
            className={`w-full rounded-sm ${
              item.value ? 'bg-brand-500/50' : 'bg-ink-900/8 dark:bg-white/8'
            }`}
            style={{ height: `${item.value ? Math.max(8, (item.value / max) * 100) : 3}%` }}
          />
        </div>
      ))}
    </div>
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

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-500 dark:text-ink-400">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
