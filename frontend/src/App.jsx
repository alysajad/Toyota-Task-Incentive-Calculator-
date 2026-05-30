import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LayoutDashboard, Car, Layers, UserCheck, CalendarRange, History } from 'lucide-react'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { ToastProvider } from './components/Toast'
import { AppShell } from './layout/AppShell'

import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import AdminDashboard from './features/admin/AdminDashboard'
import CarInventory from './features/admin/CarInventory'
import SlabEditor from './features/admin/SlabEditor'
import Approvals from './features/admin/Approvals'
import OfficerDashboard from './features/officer/OfficerDashboard'
import HistoryPage from './features/officer/HistoryPage'

const ADMIN_NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/cars', icon: Car, label: 'Car Inventory' },
  { to: '/admin/slabs', icon: Layers, label: 'Slab Editor' },
  { to: '/admin/approvals', icon: UserCheck, label: 'Approvals' },
]

const OFFICER_NAV = [
  { to: '/dashboard', icon: CalendarRange, label: 'Calculator', end: true },
  { to: '/dashboard/history', icon: History, label: 'History' },
]

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="ADMIN">
                  <AppShell nav={ADMIN_NAV} />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="cars" element={<CarInventory />} />
              <Route path="slabs" element={<SlabEditor />} />
              <Route path="approvals" element={<Approvals />} />
            </Route>

            {/* Officer */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute role="SALES_OFFICER">
                  <AppShell nav={OFFICER_NAV} />
                </ProtectedRoute>
              }
            >
              <Route index element={<OfficerDashboard />} />
              <Route path="history" element={<HistoryPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
