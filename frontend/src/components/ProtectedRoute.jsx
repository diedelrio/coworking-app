// frontend/src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';

export default function ProtectedRoute({ children, roles }) {
  const location = useLocation();
  const user = getCurrentUser();

  // No logueado
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Si la ruta requiere roles y el usuario no coincide
  if (roles && roles.length > 0) {
    if (!roles.includes(user.role)) {
      return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: '#ffecec',
              color: '#8a0000',
            }}
          >
            Solo admins
          </div>
        </div>
      );
    }
  }

  return children;
}
