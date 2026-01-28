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
import AdminReservationDetails from './pages/AdminReservationDetails';
import AdminSpaces from './pages/AdminSpaces';
import AdminNewUser from './pages/AdminNewUser';
import AdminUsers from './pages/AdminUsers';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminEmailTemplates from './pages/AdminEmailTemplates';
import AdminOperations from './pages/AdminOperations';
import UserProfile from './pages/UserProfile';
import AdminUserProfile from './pages/AdminUserProfile';


function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
      <Route
        path="/user/perfil"
        element={
          <ProtectedRoute roles={['CLIENT']}>
            <UserProfile />
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
        path="/admin/email-templates"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminEmailTemplates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/operaciones"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminOperations />
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
        path="/admin/reservas/:id"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminReservationDetails />
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
          <ProtectedRoute roles={['ADMIN']}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/usuarios/:id"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminUserProfile />
          </ProtectedRoute>
        }
      />

      {/* CATCH ALL */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
