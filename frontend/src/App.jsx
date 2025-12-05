import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardUser from './pages/DashboardUser';
import DashboardAdmin from './pages/DashboardAdmin';
import ProtectedRoute from './components/ProtectedRoute';
import SpaceCalendar from './pages/SpaceCalendar';
import UserReservations from './pages/UserReservations';
import UserNewReservation from './pages/UserNewReservation';
import AdminSettings from './pages/AdminSettings';
import AdminNewReservation from './pages/AdminNewReservation';
import AdminSpaces from './pages/AdminSpaces';
import AdminNewUser from './pages/AdminNewUser';
import AdminUsers from './pages/AdminUsers';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* RUTAS USUARIO */}
      <Route
        path="/user"
        element={
          <ProtectedRoute roles={['CLIENT']}>
            <DashboardUser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/reservas"
        element={
          <ProtectedRoute roles={['CLIENT']}>
            <UserReservations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/reservar"
        element={
          <ProtectedRoute roles={['CLIENT']}>
            <UserNewReservation />
          </ProtectedRoute>
        }
      />

      {/* RUTAS ADMIN */}
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

      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminSettings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/espacios"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminSpaces />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/reservas/nueva"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminNewReservation />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/usuarios/nuevo"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminNewUser />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/usuarios"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminUsers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/usuarios/:id"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminNewUser />
          </ProtectedRoute>
        }
      />
      
      {/* CATCH ALL AL FINAL */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
