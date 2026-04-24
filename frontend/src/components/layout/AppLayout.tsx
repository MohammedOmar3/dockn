import type { ReactNode } from 'react'
import { AppSidebar } from './Sidebar'
import { Header } from './Header'
import { SearchModal } from '@/components/ui/SearchModal'
import { CaptureModal } from '@/components/ui/CaptureModal'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <SearchModal />
      <CaptureModal />
    </div>
  )
}
