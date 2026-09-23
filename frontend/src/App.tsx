import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import TenantsPage from './pages/TenantsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import InvoicesPage from './pages/InvoicesPage';
import LoginPage, { RequireAdmin } from './pages/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
