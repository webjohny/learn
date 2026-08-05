import { NAV } from '@/components/AppHeader'
import { Icon } from '@/components/ui/Icon'
import type { ViewKey } from '@/App'

interface BottomNavProps {
  view: ViewKey
  onNavigate: (view: ViewKey) => void
}

/** Нижня навігація — тільки мобільні; на десктопі використовуються таби в шапці. */
export function BottomNav({ view, onNavigate }: BottomNavProps) {
  return (
    <nav className="safe-b sticky bottom-0 z-30 border-t border-ink-200/70 bg-ink-50/90 px-2 pt-1.5 backdrop-blur-xl sm:hidden dark:border-white/8 dark:bg-ink-950/90">
      <div className="flex items-stretch justify-around">
        {NAV.map((item) => {
          const active = view === item.key
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
                active ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400'
              }`}
            >
              <Icon name={item.icon} size={20} />
              <span className="text-[10px] leading-none font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
