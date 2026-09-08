import { Navigate, Outlet } from 'react-router-dom';
import { useSalesforce } from '../auth/SalesforceContext';

export function ProtectedRoute() {
  const { session, isLoading } = useSalesforce();

  if (isLoading) {
    return (
      <div className="app">
        <div className="login-page">
          <div className="login-card">
            <div className="loading-spinner">Restoring session...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
