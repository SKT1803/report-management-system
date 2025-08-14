import { Navigate } from 'react-router-dom';
import { getToken, getUser } from '../../utils/auth';

export function RedirectIfAuth({ children }) {
  const token = getToken();
  const user = getUser();
  if (token && user) {
    const role = user.role;
    const to =
      role === 'admin' ? '/admin' :
      role === 'superadmin' ? '/superadmin' :
      '/employee';
    return <Navigate to={to} replace />;
  }
  return children;
}

export function RequireAuth({ children }) {
  const token = getToken();
  return token ? children : <Navigate to="/" replace />;
}

export function RequireRole({ roles = [], children }) {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) return <Navigate to="/" replace />;
  return roles.includes(user.role) ? children : <Navigate to="/" replace />;
}
