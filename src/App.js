import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage             from './pages/auth/LoginPage'
import DashboardPage         from './pages/dashboard/DashboardPage'
import OrdersPage, { NewOrderPage } from './pages/orders/OrdersPage'
import TablesPage            from './pages/tables/TablesPage'
import BillingPage           from './pages/billing/BillingPage'
import BillScreen            from './pages/billing/BillScreen'
import MenuPage              from './pages/menu/MenuPage'
import InventoryPage         from './pages/inventory/InventoryPage'
import ReportsPage           from './pages/reports/ReportsPage'
import StaffPage             from './pages/staff/StaffPage'
import SettingsPage          from './pages/settings/SettingsPage'
import TablesSettingsPage    from './pages/settings/TablesSettingsPage'
import PrinterSettingsPage   from './pages/settings/PrinterSettingsPage'
import DiscountsSettingsPage from './pages/settings/DiscountsSettingsPage'
import KDSPage               from './pages/kds/KDSPage'

function Page({ module, children }) {
  return (
    <ProtectedRoute>
      <Layout>
        {module
          ? <RoleRoute module={module}>{children}</RoleRoute>
          : children
        }
      </Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kds" element={<KDSPage />} />
          <Route path="/dashboard"  element={<Page module="dashboard" ><DashboardPage  /></Page>} />
          <Route path="/orders"     element={<Page module="orders"    ><OrdersPage     /></Page>} />
          <Route path="/orders/new" element={<Page module="orders"    ><NewOrderPage   /></Page>} />
          <Route path="/tables"     element={<Page module="tables"    ><TablesPage     /></Page>} />
          <Route path="/billing"              element={<Page module="billing"><BillingPage /></Page>} />
          <Route path="/billing/order/:orderId" element={<Page module="billing"><BillScreen /></Page>} />
          <Route path="/menu"       element={<Page module="menu"      ><MenuPage       /></Page>} />
          <Route path="/inventory"  element={<Page module="inventory" ><InventoryPage  /></Page>} />
          <Route path="/reports"    element={<Page module="reports"   ><ReportsPage    /></Page>} />
          <Route path="/staff"      element={<Page module="staff"     ><StaffPage      /></Page>} />
          <Route path="/settings"           element={<Page module="settings"><SettingsPage /></Page>} />
          <Route path="/settings/printer"   element={<ProtectedRoute><PrinterSettingsPage /></ProtectedRoute>} />
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}