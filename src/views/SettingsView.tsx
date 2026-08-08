import { useEffect, useState, type ReactNode } from 'react'

import { Icon, type IconName } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useTheme } from '@/hooks/useMisc'
import { LOCALE_LABELS, LOCALES, useT, type MessageKey } from '@/lib/i18n'
import { findLanguage } from '@/lib/langs'
import { getVoicesFor, onVoicesChanged, speak, ttsSupported } from '@/lib/tts'
import { useCards, useDeckProfile } from '@/store/selectors'
import { useDeck } from '@/store/useDeck'

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
  bg: 'Просто си почивах вкъщи.',
  ru: 'Просто отдыхал дома.',
}

/** `languageOnly` — клавіші, що працюють лише в мовних парах. */
const HOTKEYS: [string, MessageKey, boolean?][] = [
  ['Space', 'settings.hkFlip'],
  ['1 / ←', 'rating.again'],
  ['2 / ↓', 'rating.hard'],
  ['3 / →', 'rating.good'],
  ['4 / ↑', 'rating.easy'],
  ['S', 'settings.hkSpeak', true],
  ['E', 'settings.hkEdit'],
  ['Esc', 'settings.hkClose'],
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
  const { isLanguage, targetLang } = useDeckProfile()
  const { theme, toggle } = useTheme()
  const toast = useToast()
  const t = useT()

  const [voices, setVoices] = useState(() => getVoicesFor(targetLang))
  const [confirm, setConfirm] = useState<'progress' | 'seed' | null>(null)

  // Голоси залежать від мови колоди й вантажаться асинхронно.
  useEffect(() => {
    setVoices(getVoicesFor(targetLang))
    return onVoicesChanged(() => setVoices(getVoicesFor(targetLang)))
  }, [targetLang])

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
      <Section icon="cards" title={t('settings.learning')}>
        <Slider
          label={t('settings.newPerDay')}
          value={settings.newPerDay}
          min={0}
          max={60}
          step={5}
          onChange={(newPerDay) => setSettings({ newPerDay })}
        />
        <Slider
          label={t('settings.reviewsPerDay')}
          value={settings.reviewsPerDay}
          min={20}
          max={400}
          step={20}
          onChange={(reviewsPerDay) => setSettings({ reviewsPerDay })}
        />
        {isLanguage && (
          <Toggle
            label={t('settings.reverse')}
            hint={t('settings.reverseHint')}
            checked={settings.reverse}
            onChange={(reverse) => setSettings({ reverse })}
          />
        )}
        <Toggle
          label={t('settings.clozeBlur')}
          hint={t('settings.clozeBlurHint')}
          checked={settings.clozeBlur}
          onChange={(clozeBlur) => setSettings({ clozeBlur })}
        />
      </Section>

      <Section icon="zap" title={t('settings.sprint')}>
        <Slider
          label={t('settings.sprintSeconds')}
          value={settings.speedSessionSeconds}
          min={30}
          max={300}
          step={30}
          format={(v) => `${v} с`}
          onChange={(speedSessionSeconds) => setSettings({ speedSessionSeconds })}
        />
        <Slider
          label={t('settings.sprintSize')}
          value={settings.speedSessionSize}
          min={5}
          max={30}
          step={5}
          onChange={(speedSessionSize) => setSettings({ speedSessionSize })}
        />
      </Section>

      {isLanguage && (
        <Section icon="volume" title={t('settings.speech')}>
          {ttsSupported ? (
            <>
              <Toggle
                label={t('settings.autoSpeak')}
                hint={t('settings.autoSpeakHint')}
                checked={settings.autoSpeak}
                onChange={(autoSpeak) => setSettings({ autoSpeak })}
              />
              <Slider
                label={t('settings.rate')}
                value={settings.speechRate}
                min={0.6}
                max={1.4}
                step={0.05}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={(speechRate) => setSettings({ speechRate })}
              />
              <Field label={t('settings.voice', { lang: findLanguage(targetLang).label })}>
                <div className="flex gap-2">
                  <select
                    className="field flex-1"
                    value={settings.voiceURI ?? ''}
                    onChange={(e) => setSettings({ voiceURI: e.target.value || null })}
                  >
                    <option value="">{t('settings.voiceDefault')}</option>
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
                    <Icon name="play" size={14} /> {t('settings.voiceTest')}
                  </button>
                </div>
                {!voices.length && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {t('settings.noVoice')}
                  </p>
                )}
              </Field>
            </>
          ) : (
            <p className="text-[13px] text-ink-400">
              {t('settings.noTts')}
            </p>
          )}
        </Section>
      )}

      <Section icon="settings" title={t('settings.interface')}>
        <Field label={t('settings.language')}>
          <select
            className="field"
            value={settings.locale}
            onChange={(e) => setSettings({ locale: e.target.value as (typeof LOCALES)[number] })}
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          label={t('settings.dark')}
          checked={theme === 'dark'}
          onChange={toggle}
          hint={t('settings.darkHint')}
        />
        <Toggle
          label={t('settings.haptics')}
          hint={t('settings.hapticsHint')}
          checked={settings.hapticFeedback}
          onChange={(hapticFeedback) => setSettings({ hapticFeedback })}
        />
      </Section>

      <Section icon="keyboard" title={t('settings.hotkeys')}>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {HOTKEYS.filter(([, , languageOnly]) => isLanguage || !languageOnly).map(([key, action]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-[13px]">
              <dt className="text-ink-500 dark:text-ink-400">{t(action)}</dt>
              <dd className="kbd shrink-0">{key}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section icon="layers" title={t('settings.data')} hint={t('common.cardsCount', { count: cardCount })}>
        <div className="flex flex-wrap gap-2">
          <button className="btn-soft" onClick={onOpenImport}>
            <Icon name="upload" size={16} /> {t('settings.importExport')}
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
              toast(t('settings.progressReset'), 'info')
            }}
          >
            <Icon name="rotate" size={16} />
            {confirm === 'progress' ? t('settings.resetProgressConfirm') : t('settings.resetProgress')}
          </button>

          {/* Стартовий набір — англійські фрази; у предметній колоді він би затер картки. */}
          {isLanguage && (
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
                toast(t('settings.seedRestored'), 'info')
              }}
            >
              <Icon name="undo" size={16} />
              {confirm === 'seed' ? t('settings.restoreSeedConfirm') : t('settings.restoreSeed')}
            </button>
          )}
        </div>
        <p className="text-[11px] text-ink-400">
          {t('settings.storageNote')}
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
