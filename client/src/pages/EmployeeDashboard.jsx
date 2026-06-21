import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';

export default function EmployeeDashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/reports/my').then((res) => {
      setReports(res.data);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  const counts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    approved: reports.filter((r) => r.status === 'approved').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading reports...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Reports</h2>
        <Link
          to="/reports/new"
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-lg font-medium transition"
        >
          + New Report
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === s
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No reports found.</p>
          <Link to="/reports/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Submit your first report
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Activity</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Team</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Bound</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {report.report_date ? new Date(report.report_date).toLocaleDateString() : new Date(report.created_at).toLocaleDateString()}
                  </td>
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
