import { useEffect, useState, type ReactNode } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useTheme } from '@/hooks/useMisc'
import { findLanguage } from '@/lib/langs'
import { getVoicesFor, onVoicesChanged, speak, ttsSupported } from '@/lib/tts'
import { useCards } from '@/store/selectors'
import { useDeck } from '@/store/useDeck'
import { useSession } from '@/store/useSession'

/** Фраза для перевірки голосу — своя на кожну мову колоди. */
const SAMPLES: Record<string, string> = {
  en: 'Just kicked back at home with my wife.',
  de: 'Ich habe mich zu Hause einfach entspannt.',
  pl: 'Po prostu odpoczywałem w domu.',
  es: 'Simplemente me relajé en casa.',
  fr: 'Je me suis simplement détendu à la maison.',
  it: 'Mi sono semplicemente rilassato a casa.',
  pt: 'Simplesmente relaxei em casa.',
  nl: 'Ik heb gewoon thuis ontspannen.',
  cs: 'Prostě jsem odpočíval doma.',
  tr: 'Sadece evde dinlendim.',
  uk: 'Просто відпочивав удома з дружиною.',
}

const HOTKEYS: [string, string][] = [
  ['Space', 'перевернути картку'],
  ['1 / ←', 'Забув'],
  ['2 / ↓', 'Важко'],
  ['3 / →', 'Добре'],
  ['4 / ↑', 'Легко'],
  ['S', 'прослухати вимову'],
  ['E', 'редагувати поточну картку'],
  ['Esc', 'закрити вікно'],
]

interface SettingsViewProps {
  onOpenImport: () => void
}

export function SettingsView({ onOpenImport }: SettingsViewProps) {
  const settings = useDeck((s) => s.settings)
  const setSettings = useDeck((s) => s.setSettings)
  const resetAllProgress = useDeck((s) => s.resetAllProgress)
  const loadSeed = useDeck((s) => s.loadSeed)
  const cardCount = useCards().length
  const targetLang = useSession((s) => s.activeDeckMeta()?.targetLang ?? 'en-US')
  const { theme, toggle } = useTheme()
  const toast = useToast()

  const [voices, setVoices] = useState(() => getVoicesFor(targetLang))
  const [confirm, setConfirm] = useState<'progress' | 'seed' | null>(null)

  // Голоси залежать від мови колоди й вантажаться асинхронно.
  useEffect(() => {
    setVoices(getVoicesFor(targetLang))
    return onVoicesChanged(() => setVoices(getVoicesFor(targetLang)))
  }, [targetLang])

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <Section icon="cards" title="Навчання">
        <Slider
          label="Нових карток на день"
          value={settings.newPerDay}
          min={0}
          max={60}
          step={5}
          onChange={(newPerDay) => setSettings({ newPerDay })}
        />
        <Slider
          label="Максимум повторень на день"
          value={settings.reviewsPerDay}
          min={20}
          max={400}
          step={20}
          onChange={(reviewsPerDay) => setSettings({ reviewsPerDay })}
        />
        <Toggle
          label="Зворотний напрям"
          hint="Спочатку англійська, потім переклад"
          checked={settings.reverse}
          onChange={(reverse) => setSettings({ reverse })}
        />
        <Toggle
          label="Ховати ключові слова"
          hint="Фрагменти в *[дужках]* показуються під блюром до кліку"
          checked={settings.clozeBlur}
          onChange={(clozeBlur) => setSettings({ clozeBlur })}
        />
      </Section>

      <Section icon="zap" title="Спринт">
        <Slider
          label="Тривалість сесії"
          value={settings.speedSessionSeconds}
          min={30}
          max={300}
          step={30}
          format={(v) => `${v} с`}
          onChange={(speedSessionSeconds) => setSettings({ speedSessionSeconds })}
        />
        <Slider
          label="Карток у сесії"
          value={settings.speedSessionSize}
          min={5}
          max={30}
          step={5}
          onChange={(speedSessionSize) => setSettings({ speedSessionSize })}
        />
      </Section>

      <Section icon="volume" title="Озвучення">
        {ttsSupported ? (
          <>
            <Toggle
              label="Автоозвучення відповіді"
              hint="Англійська фраза читається одразу після перевороту"
              checked={settings.autoSpeak}
              onChange={(autoSpeak) => setSettings({ autoSpeak })}
            />
            <Slider
              label="Швидкість мовлення"
              value={settings.speechRate}
              min={0.6}
              max={1.4}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(speechRate) => setSettings({ speechRate })}
            />
            <Field label={`Голос — ${findLanguage(targetLang).label}`}>
              <div className="flex gap-2">
                <select
                  className="field flex-1"
                  value={settings.voiceURI ?? ''}
                  onChange={(e) => setSettings({ voiceURI: e.target.value || null })}
                >
                  <option value="">Системний за замовчуванням</option>
                  {voices.map((voice: SpeechSynthesisVoice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <button
                  className="btn-soft shrink-0"
                  onClick={() =>
                    speak(SAMPLES[targetLang.split('-')[0]] ?? 'This is a test.', {
                      rate: settings.speechRate,
                      voiceURI: settings.voiceURI,
                      lang: targetLang,
                    })
                  }
                >
                  <Icon name="play" size={14} /> Тест
                </button>
              </div>
              {!voices.length && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  У системі немає голосу для цієї мови — озвучення буде недоступне.
                </p>
              )}
            </Field>
          </>
        ) : (
          <p className="text-[13px] text-ink-400">
            Браузер не підтримує Web Speech API — озвучення недоступне.
          </p>
        )}
      </Section>

      <Section icon="settings" title="Інтерфейс">
        <Toggle
          label="Темна тема"
          checked={theme === 'dark'}
          onChange={toggle}
          hint="Перемикається також кнопкою в шапці"
        />
        <Toggle
          label="Вібровідгук"
          hint="Коротка вібрація при свайпі та оцінці (мобільні)"
          checked={settings.hapticFeedback}
          onChange={(hapticFeedback) => setSettings({ hapticFeedback })}
        />
      </Section>

      <Section icon="keyboard" title="Гарячі клавіші">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {HOTKEYS.map(([key, action]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-[13px]">
              <dt className="text-ink-500 dark:text-ink-400">{action}</dt>
              <dd className="kbd shrink-0">{key}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section icon="layers" title="Дані" hint={`${cardCount} карток`}>
        <div className="flex flex-wrap gap-2">
          <button className="btn-soft" onClick={onOpenImport}>
            <Icon name="upload" size={16} /> Імпорт / експорт
          </button>

          <button
            className={`btn ${
              confirm === 'progress'
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'btn-soft text-amber-600 dark:text-amber-400'
            }`}
            onClick={() => {
              if (confirm !== 'progress') return setConfirm('progress')
              resetAllProgress()
              setConfirm(null)
              toast('Прогрес скинуто, картки залишились', 'info')
            }}
          >
            <Icon name="rotate" size={16} />
            {confirm === 'progress' ? 'Точно скинути прогрес?' : 'Скинути прогрес'}
          </button>

          <button
            className={`btn ${
              confirm === 'seed'
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'btn-soft text-rose-600 dark:text-rose-400'
            }`}
            onClick={() => {
              if (confirm !== 'seed') return setConfirm('seed')
              loadSeed()
              setConfirm(null)
              toast('Стартову колоду відновлено', 'info')
            }}
          >
            <Icon name="undo" size={16} />
            {confirm === 'seed' ? 'Замінити всі картки?' : 'Повернути стартову колоду'}
          </button>
        </div>
        <p className="text-[11px] text-ink-400">
          Дані зберігаються локально в браузері (localStorage). Регулярно робіть бекап.
        </p>
      </Section>
    </div>
  )
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconName
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="surface space-y-3.5 p-4">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={16} className="text-ink-400" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="ml-auto text-[11px] text-ink-400">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-ink-400">{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v: number) => String(v),
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums text-brand-600 dark:text-brand-400">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-900/10 accent-brand-600 dark:bg-white/12"
      />
    </div>
  )
}
