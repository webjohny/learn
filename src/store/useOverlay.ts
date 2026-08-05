import { useEffect } from 'react'
import { create } from 'zustand'

interface OverlayState {
  /** Скільки модальних вікон зараз відкрито. */
  count: number
  open: () => void
  close: () => void
}

const useOverlayStore = create<OverlayState>()((set) => ({
  count: 0,
  open: () => set((s) => ({ count: s.count + 1 })),
  close: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}))

/**
 * Реєструє відкрите вікно, поки компонент змонтований і `active`.
 * Потрібно, щоб гарячі клавіші навчання не спрацьовували «крізь» модалку.
 */
export function useOverlayRegistration(active: boolean) {
  useEffect(() => {
    if (!active) return
    const { open, close } = useOverlayStore.getState()
    open()
    return close
  }, [active])
}

export function useOverlayOpen(): boolean {
  return useOverlayStore((s) => s.count > 0)
}
