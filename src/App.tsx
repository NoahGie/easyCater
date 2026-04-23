import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { EventsPage } from './pages/EventsPage'
import { CustomersPage } from './pages/CustomersPage'
import { CalendarPage } from './pages/CalendarPage'
import { CatalogPage } from './pages/CatalogPage'
import { StaffPage } from './pages/StaffPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { Layout } from './components/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="equipment" element={<EquipmentPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
