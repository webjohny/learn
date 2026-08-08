import { NavLink } from 'react-router-dom'

import { NAV } from '@/components/AppHeader'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/lib/i18n'

/** Нижня навігація — тільки мобільні; на десктопі використовуються таби в шапці. */
export function BottomNav() {
  const t = useT()
  return (
    <nav className="safe-b sticky bottom-0 z-30 border-t border-ink-200/70 bg-ink-50/90 px-2 pt-1.5 backdrop-blur-xl sm:hidden dark:border-white/8 dark:bg-ink-950/90">
      <div className="flex items-stretch justify-around">
        {NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400'
              }`
            }
          >
            <Icon name={item.icon} size={20} />
            <span className="text-[10px] leading-none font-medium">{t(item.label)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
