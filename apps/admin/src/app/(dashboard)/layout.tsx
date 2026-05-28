import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { ActiveEditionProvider } from '@/contexts/ActiveEditionContext'
import { ActiveOrganizationProvider } from '@/contexts/ActiveOrganizationContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ActiveOrganizationProvider>
        <ActiveEditionProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>
          </div>
        </ActiveEditionProvider>
      </ActiveOrganizationProvider>
    </AuthGuard>
  )
}
