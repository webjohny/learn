import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { ImportDialog } from '@/components/ImportDialog'
import { useAutoSync } from '@/hooks/useAutoSync'
import { useTheme } from '@/hooks/useMisc'
import { AdminView } from '@/views/AdminView'
import { BrowseView } from '@/views/BrowseView'
import { QuizEditorView } from '@/views/QuizEditorView'
import { QuizListView } from '@/views/QuizListView'
import { QuizRunView } from '@/views/QuizRunView'
import { SettingsView } from '@/views/SettingsView'
import { StatsView } from '@/views/StatsView'
import { StudyView } from '@/views/StudyView'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

/** Стан і хуки живуть під роутером — інакше не дістати `useLocation`. */
function AppShell() {
  const [importOpen, setImportOpen] = useState(false)
  useTheme()
  useAutoSync()

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader onImport={() => setImportOpen(true)} />

      <main className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-4 py-3">
        <Routes>
          <Route path="/" element={<StudyView />} />
          <Route path="/browse" element={<BrowseView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/settings" element={<SettingsView onOpenImport={() => setImportOpen(true)} />} />
          <Route path="/quiz" element={<QuizListView />} />
          {/* Не-адміна екран сам відправить на головну — сервер віддає дані лише адміну. */}
          <Route path="/admin" element={<AdminView />} />
          <Route path="/quiz/:id/run" element={<QuizRunView />} />
          <Route path="/quiz/:id/edit" element={<QuizEditorView />} />
          {/* Невідомий шлях — на головну, щоб глибокий лінк з друкарською помилкою не давав пустоту. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
