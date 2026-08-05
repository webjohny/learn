import { useState } from 'react'

import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { ImportDialog } from '@/components/ImportDialog'
import { useAutoSync } from '@/hooks/useAutoSync'
import { useTheme } from '@/hooks/useMisc'
import { BrowseView } from '@/views/BrowseView'
import { SettingsView } from '@/views/SettingsView'
import { StatsView } from '@/views/StatsView'
import { StudyView } from '@/views/StudyView'

export type ViewKey = 'study' | 'browse' | 'stats' | 'settings'

export default function App() {
  const [view, setView] = useState<ViewKey>('study')
  const [importOpen, setImportOpen] = useState(false)
  useTheme()
  useAutoSync()

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader view={view} onNavigate={setView} onImport={() => setImportOpen(true)} />

      <main className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-4 py-3">
        {view === 'study' && <StudyView />}
        {view === 'browse' && <BrowseView />}
        {view === 'stats' && <StatsView />}
        {view === 'settings' && <SettingsView onOpenImport={() => setImportOpen(true)} />}
      </main>

      <BottomNav view={view} onNavigate={setView} />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
