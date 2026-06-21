import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import EmployeeDashboard from './pages/EmployeeDashboard';
import NewReport from './pages/NewReport';
import AdminDashboard from './pages/AdminDashboard';
import ReportDetail from './pages/ReportDetail';
import Summary from './pages/Summary';
import Layout from './components/Layout';

function PrivateRoute({ children, role }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  if (!token || !user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute role="employee">
              <Layout><EmployeeDashboard /></Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/new"
          element={
            <PrivateRoute role="employee">
              <Layout><NewReport /></Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute role="admin">
              <Layout><AdminDashboard /></Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/summary"
          element={
            <PrivateRoute>
              <Layout><Summary /></Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/:id"
          element={
            <PrivateRoute>
              <Layout><ReportDetail /></Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
