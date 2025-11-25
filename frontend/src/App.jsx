import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardUser from './pages/DashboardUser';
import DashboardAdmin from './pages/DashboardAdmin';
import ProtectedRoute from './components/ProtectedRoute';
import SpaceCalendar from './pages/SpaceCalendar';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/user"
        element={
          <ProtectedRoute roles={['CLIENT']}>
            <DashboardUser />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <DashboardAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/calendar"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <SpaceCalendar />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;

