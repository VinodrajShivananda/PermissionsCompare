import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SalesforceProvider } from './auth/SalesforceContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { CompareUsersPage } from './pages/CompareUsersPage';
import { CompareProfilesPage } from './pages/CompareProfilesPage';
import { ComparePermissionSetsPage } from './pages/ComparePermissionSetsPage';
import { ComparePermissionSetGroupsPage } from './pages/ComparePermissionSetGroupsPage';

function App() {
  return (
    <SalesforceProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/compare/users" element={<CompareUsersPage />} />
              <Route path="/compare/profiles" element={<CompareProfilesPage />} />
              <Route path="/compare/permission-sets" element={<ComparePermissionSetsPage />} />
              <Route path="/compare/permission-set-groups" element={<ComparePermissionSetGroupsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SalesforceProvider>
  );
}

export default App;
