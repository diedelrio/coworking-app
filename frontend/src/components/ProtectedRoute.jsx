import { Navigate } from 'react-router-dom';

function getUser() {
  const data = localStorage.getItem('user');
  return data ? JSON.parse(data) : null;
}

export default function ProtectedRoute({ roles, children }) {
  const user = getUser();

  if (!user) return <Navigate to="/login" />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/login" />;
  }

  return children;
}
