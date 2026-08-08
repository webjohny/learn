import { Link, NavLink } from 'react-router-dom'

import { AccountMenu } from '@/components/AccountMenu'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useTheme } from '@/hooks/useMisc'
import { formatDuration } from '@/lib/date'
import { useT, type MessageKey } from '@/lib/i18n'
import { useCounts, useToday } from '@/store/selectors'

export interface NavItem {
  path: string
  label: MessageKey
  icon: IconName
}

export const NAV: NavItem[] = [
  { path: '/', label: 'nav.study', icon: 'cards' },
  { path: '/browse', label: 'nav.browse', icon: 'layers' },
  { path: '/stats', label: 'nav.stats', icon: 'chart' },
  { path: '/settings', label: 'nav.settings', icon: 'settings' },
]

interface AppHeaderProps {
  onImport: () => void
}

export function AppHeader({ onImport }: AppHeaderProps) {
  const counts = useCounts()
  const today = useToday()
  const { theme, toggle } = useTheme()
  const t = useT()

  return (
    <header className="safe-t sticky top-0 z-30 border-b border-ink-200/70 bg-ink-50/85 backdrop-blur-xl dark:border-white/8 dark:bg-ink-950/80">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-left">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-500 text-white shadow-lg shadow-brand-500/25">
            <Icon name="cards" size={18} />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold">Phrase Deck</span>
            <span className="block text-[11px] text-ink-400">{t('header.subtitle')}</span>
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2">
          <Stat icon="target" value={counts.queued} label={t('header.due')} tone="brand" />
          <Stat
            icon="flame"
            value={today.streak}
            label={t('header.streak', { count: today.streak })}
            tone={today.streak > 0 ? 'flame' : 'muted'}
          />
          <Stat
            icon="clock"
            value={formatDuration(today.seconds)}
            label={t('header.today')}
            tone="muted"
            wide
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Вікторини — окремий тренажер, тому не в NAV: активний стан
              малюємо самі, підсвітка табів сюди не дістає. */}
          <NavLink
            to="/quiz"
            className={({ isActive }) =>
              `btn gap-1.5 px-2.5 py-1.5 text-xs ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-brand-500/30 text-brand-600 hover:bg-brand-500/10 dark:text-brand-400'
              }`
            }
            title={t('nav.quizzesHint')}
          >
            <Icon name="target" size={15} />
            <span className="hidden sm:inline">{t('nav.quizzes')}</span>
          </NavLink>
          <AccountMenu />
          <button className="btn-ghost px-2" onClick={onImport} title={t('header.import')}>
            <Icon name="upload" />
          </button>
          <button
            className="btn-ghost px-2"
            onClick={toggle}
            title={theme === 'dark' ? t('header.themeLight') : t('header.themeDark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </div>

      <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 sm:flex">
        {NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            // `end` лише для '/', інакше головна підсвічувалась би на всіх шляхах.
            end={item.path === '/'}
            className={({ isActive }) =>
              [
                'btn gap-2 px-3 py-1.5 text-[13px]',
                isActive
                  ? 'bg-ink-900/6 text-ink-900 dark:bg-white/10 dark:text-white'
                  : 'text-ink-500 hover:bg-ink-900/4 dark:text-ink-400 dark:hover:bg-white/6',
              ].join(' ')
            }
          >
            <Icon name={item.icon} size={16} />
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

const tones = {
  brand: 'text-brand-600 dark:text-brand-400',
  flame: 'text-orange-500 dark:text-orange-400',
  muted: 'text-ink-500 dark:text-ink-400',
}

function Stat({
  icon,
  value,
  label,
  tone,
  wide = false,
}: {
  icon: IconName
  value: number | string
  label: string
  tone: keyof typeof tones
  wide?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl bg-ink-900/4 px-2.5 py-1.5 dark:bg-white/6 ${wide ? 'hidden xs:flex' : ''}`}
    >
      <Icon name={icon} size={15} className={tones[tone]} />
      <span className="text-[13px] leading-none font-semibold tabular-nums">{value}</span>
      <span className="hidden text-[11px] leading-none text-ink-400 sm:inline">{label}</span>
    </div>
  )
}
