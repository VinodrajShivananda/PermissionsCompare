import { Navigate, Outlet } from 'react-router-dom';
import { useSalesforce } from '../auth/SalesforceContext';

export function ProtectedRoute() {
  const { session, isLoading } = useSalesforce();

  if (isLoading) {
    return (
      <div className="callback-page">
        <div className="card">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
