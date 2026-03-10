import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'

const LoginPage             = lazy(() => import('./pages/auth/LoginPage'))
const DashboardPage         = lazy(() => import('./pages/dashboard/DashboardPage'))
const OrdersPage            = lazy(() => import('./pages/orders/OrdersPage'))
const NewOrderPage          = lazy(() => import('./pages/orders/OrdersPage').then(m => ({ default: m.NewOrderPage })))
const TablesPage            = lazy(() => import('./pages/tables/TablesPage'))
const BillingPage           = lazy(() => import('./pages/billing/BillingPage'))
const BillScreen            = lazy(() => import('./pages/billing/BillScreen'))
const MenuPage              = lazy(() => import('./pages/menu/MenuPage'))
const InventoryPage         = lazy(() => import('./pages/inventory/InventoryPage'))
const ReportsPage           = lazy(() => import('./pages/reports/ReportsPage'))
const StaffPage             = lazy(() => import('./pages/staff/StaffPage'))
const SettingsPage          = lazy(() => import('./pages/settings/SettingsPage'))
const TablesSettingsPage    = lazy(() => import('./pages/settings/TablesSettingsPage'))
const PrinterSettingsPage   = lazy(() => import('./pages/settings/PrinterSettingsPage'))
const DiscountsSettingsPage = lazy(() => import('./pages/settings/DiscountsSettingsPage'))
const KDSPage               = lazy(() => import('./pages/kds/KDSPage'))

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
        <Suspense> fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'DM Sans,sans-serif', color:'#A8917A', fontSize:14 }}>Loading...</div>}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kds" element={<KDSPage />} />

          <Route path="/dashboard"  element={<Page module="dashboard" ><DashboardPage  /></Page>} />
          <Route path="/orders"     element={<Page module="orders"    ><OrdersPage     /></Page>} />
          <Route path="/orders/new" element={<Page module="orders"    ><NewOrderPage   /></Page>} />
          <Route path="/tables"     element={<Page module="tables"    ><TablesPage     /></Page>} />
          <Route path="/billing"             element={<Page module="billing"><BillingPage  /></Page>} />
<Route path="/billing/order/:orderId" element={<Page module="billing"><BillScreen /></Page>} />
          <Route path="/menu"       element={<Page module="menu"      ><MenuPage       /></Page>} />
          <Route path="/inventory"  element={<Page module="inventory" ><InventoryPage  /></Page>} />
          <Route path="/reports"    element={<Page module="reports"   ><ReportsPage    /></Page>} />
          <Route path="/staff"      element={<Page module="staff"     ><StaffPage      /></Page>} />
          <Route path="/settings"          element={<Page module="settings"><SettingsPage         /></Page>} />
          <Route path="/settings/printer" element={<ProtectedRoute><PrinterSettingsPage /></ProtectedRoute>} />
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}