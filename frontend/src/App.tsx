import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthGuard, GuestGuard } from '@/components/layout/AuthGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Dashboard from '@/pages/Dashboard'
import Notes from '@/pages/Notes'
import Tasks from '@/pages/Tasks'
import Logs from '@/pages/Logs'
import Whiteboards from '@/pages/Whiteboards'
import Settings from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
})

function AppRoutes() {
  return (
    <Routes>
      {/* Guest-only */}
      <Route
        path="/login"
        element={
          <GuestGuard>
            <Login />
          </GuestGuard>
        }
      />
      <Route
        path="/register"
        element={
          <GuestGuard>
            <Register />
          </GuestGuard>
        }
      />

      {/* Protected */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/notes"
        element={
          <AuthGuard>
            <AppLayout>
              <Notes />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/tasks"
        element={
          <AuthGuard>
            <AppLayout>
              <Tasks />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/logs"
        element={
          <AuthGuard>
            <AppLayout>
              <Logs />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/whiteboards"
        element={
          <AuthGuard>
            <AppLayout>
              <Whiteboards />
            </AppLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <AppLayout>
              <Settings />
            </AppLayout>
          </AuthGuard>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
