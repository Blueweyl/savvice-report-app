import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';

const API_BASE = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

function AccountStatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
    </span>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ department_id: '', status: '' });

  // User management state
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data));
    loadPendingUsers();
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.department_id) params.set('department_id', filters.department_id);
    if (filters.status) params.set('status', filters.status);

    api.get(`/reports/all?${params.toString()}`).then((res) => {
      setReports(res.data);
      setLoading(false);
    });
  }, [filters]);

  function loadPendingUsers() {
    api.get('/auth/pending').then((res) => setPendingUsers(res.data)).catch(() => {});
  }

  function loadAllUsers() {
    setUsersLoading(true);
    const params = userStatusFilter ? `?status=${userStatusFilter}` : '';
    api.get(`/auth/users${params}`).then((res) => {
      setUsers(res.data);
      setUsersLoading(false);
    }).catch(() => setUsersLoading(false));
  }

  useEffect(() => {
    if (showUserManagement) {
      loadAllUsers();
    }
  }, [showUserManagement, userStatusFilter]);

  async function handleUserStatus(userId, newStatus) {
    setActionLoading(userId);
    try {
      await api.patch(`/auth/users/${userId}/status`, { account_status: newStatus });
      loadPendingUsers();
      if (showUserManagement) loadAllUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  }

  const handleExport = useCallback((format) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const params = new URLSearchParams();
    params.set('token', token);
    if (filters.department_id) params.set('department_id', filters.department_id);

    const url = `${API_BASE}/api/export/${format}?${params.toString()}`;
    window.open(url, '_blank');
  }, [filters]);

  async function handleDeleteReport(reportId) {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;
    try {
      await api.delete(`/reports/${reportId}`);
      setReports(reports.filter((r) => r.id !== reportId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete report');
    }
  }

  const counts = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    approved: reports.filter((r) => r.status === 'approved').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Admin Dashboard</h2>

      {/* Pending Registrations Banner */}
      {pendingUsers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-yellow-800 font-medium">
              {pendingUsers.length} pending registration{pendingUsers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={() => setShowUserManagement(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
          >
            Review
          </button>
        </div>
      )}

      {/* User Management Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowUserManagement(!showUserManagement)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            showUserManagement
              ? 'bg-[#1a1a2e] text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          User Management
          {pendingUsers.length > 0 && (
            <span className="bg-yellow-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* User Management Section */}
      {showUserManagement && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">User Management</h3>
            <div className="flex items-center gap-3">
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={() => setShowUserManagement(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {usersLoading ? (
            <div className="text-center py-8 text-gray-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Role</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Registered</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.department_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{user.role}</td>
                      <td className="px-4 py-3"><AccountStatusBadge status={user.account_status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {user.account_status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUserStatus(user.id, 'approved')}
                              disabled={actionLoading === user.id}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition disabled:opacity-50"
                            >
                              {actionLoading === user.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleUserStatus(user.id, 'rejected')}
                              disabled={actionLoading === user.id}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition disabled:opacity-50"
                            >
                              {actionLoading === user.id ? '...' : 'Reject'}
                            </button>
                          </div>
                        )}
                        {user.account_status === 'approved' && user.role !== 'admin' && (
                          <button
                            onClick={() => handleUserStatus(user.id, 'rejected')}
                            disabled={actionLoading === user.id}
                            className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs font-medium transition disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                        {user.account_status === 'rejected' && (
                          <button
                            onClick={() => handleUserStatus(user.id, 'approved')}
                            disabled={actionLoading === user.id}
                            className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-xs font-medium transition disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-gray-800">{counts.total}</div>
          <div className="text-sm text-gray-500">Total Reports</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 text-center">
          <div className="text-3xl font-bold text-yellow-700">{counts.pending}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{counts.approved}</div>
          <div className="text-sm text-green-600">Approved</div>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
          <div className="text-3xl font-bold text-red-700">{counts.rejected}</div>
          <div className="text-sm text-red-600">Rejected</div>
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <select
          value={filters.department_id}
          onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name} Department</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => navigate('/summary')}
            className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#1a1a2e] text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Summary Report
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No reports found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Submitted By</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Dept / Activity</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Team</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Bound</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Review</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {report.report_date ? new Date(report.report_date).toLocaleDateString() : new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{report.author_name}</td>
                  <td className="px-4 py-3">
                    <Link to={`/reports/${report.id}`} className="text-blue-600 hover:underline font-medium text-sm">
                      {report.activity_name}
                    </Link>
                    <p className="text-xs text-gray-500">{report.department_name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {report.location_from && report.location_to
                      ? `${report.location_from} → ${report.location_to}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{report.team || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {report.status_bound === 'done' && <span className="text-green-600 font-semibold text-xs">DONE</span>}
                    {report.status_bound === 'on_going' && <span className="text-orange-500 font-semibold text-xs">ON GOING</span>}
                    {(!report.status_bound || report.status_bound === 'pending') && <span className="text-gray-500 font-semibold text-xs">PENDING</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
                  <td className="px-4 py-3">
                    {report.status === 'rejected' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition"
                        title="Delete report"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
