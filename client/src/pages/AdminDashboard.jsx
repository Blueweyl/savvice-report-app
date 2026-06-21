import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';

export default function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ department_id: '', status: '' });

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data));
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

  const counts = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    approved: reports.filter((r) => r.status === 'approved').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Admin Dashboard</h2>

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

      <div className="flex gap-4 mb-6">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
