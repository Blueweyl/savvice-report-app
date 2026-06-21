import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const API_BASE = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export default function Summary() {
  const [departments, setDepartments] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data));
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (departmentId) params.set('department_id', departmentId);

      const [summaryRes, reportsRes] = await Promise.all([
        api.get(`/reports/summary?${params.toString()}`),
        api.get(`/reports/all?${params.toString()}`).catch(() => ({ data: [] })),
      ]);
      setSummary(summaryRes.data);
      setReports(reportsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, departmentId]);

  const handleExport = useCallback((format) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const params = new URLSearchParams();
    params.set('token', token);
    if (departmentId) params.set('department_id', departmentId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    const url = `${API_BASE}/api/export/${format}?${params.toString()}`;
    window.open(url, '_blank');
  }, [departmentId, dateFrom, dateTo]);

  const avgPerReport = summary && summary.total_reports > 0
    ? (summary.total_accomplishment / summary.total_reports).toFixed(2)
    : '0.00';

  const maxDailyAccomplishment = summary?.by_date?.length
    ? Math.max(...summary.by_date.map(d => d.total_accomplishment))
    : 0;

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Summary / Analytics</h2>

      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="bg-[#1e3a8a] text-white px-4 py-2 rounded-t-lg -mx-6 -mt-6 mb-4 font-semibold text-sm">
          Select Date Range & Filters
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="bg-[#1e3a8a] hover:bg-[#1a1a2e] text-white px-6 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {!summary && !loading && (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500">Select a date range and click "Generate Report" to view the summary.</p>
        </div>
      )}

      {summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
              <div className="text-3xl font-bold text-[#1e3a8a]">{summary.total_reports}</div>
              <div className="text-sm text-gray-500 mt-1">Total Reports</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
              <div className="text-3xl font-bold text-[#f59e0b]">{summary.total_accomplishment.toFixed(2)}</div>
              <div className="text-sm text-gray-500 mt-1">Total Accomplishment (LN.M)</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
              <div className="text-3xl font-bold text-[#1a1a2e]">{avgPerReport}</div>
              <div className="text-sm text-gray-500 mt-1">Average per Report (LN.M)</div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 mb-6">
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

          {/* By Department Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
              By Department
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Reports</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Total Accomplishment (LN.M)</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.by_department.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">No data</td></tr>
                ) : (
                  summary.by_department.map((dept, i) => (
                    <tr key={dept.department_name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{dept.department_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{dept.report_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{dept.total_accomplishment.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {summary.total_accomplishment > 0
                          ? ((dept.total_accomplishment / summary.total_accomplishment) * 100).toFixed(1)
                          : '0.0'}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* By Activity Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
              By Activity
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Activity</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Reports</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Total Accomplishment (LN.M)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.by_activity.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">No data</td></tr>
                ) : (
                  summary.by_activity.map((act, i) => (
                    <tr key={`${act.activity_name}-${act.department_name}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{act.activity_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{act.department_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{act.report_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{act.total_accomplishment.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* By Team Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
              By Team
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Team</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Reports</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Total Accomplishment (LN.M)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.by_team.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">No data</td></tr>
                ) : (
                  summary.by_team.map((team, i) => (
                    <tr key={team.team} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{team.team}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{team.report_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{team.total_accomplishment.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Before & After Photos */}
          {reports.filter(r => r.photo_before || r.photo_after).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
              <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm flex items-center gap-2">
                <span>📷</span> Before & After Photos
              </div>
              <div className="p-4 space-y-4">
                {reports.filter(r => r.photo_before || r.photo_after).map((report) => {
                  const token = localStorage.getItem('token');
                  return (
                    <div key={report.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Link to={`/reports/${report.id}`} className="text-sm font-bold text-[#1e3a8a] hover:underline">
                            {report.activity_name}
                          </Link>
                          <p className="text-xs text-gray-500">
                            {report.department_name} — {report.team || 'No team'} — {report.report_date ? new Date(report.report_date).toLocaleDateString() : ''}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400">{report.author_name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Before</p>
                          {report.photo_before ? (
                            <img
                              src={`${API_BASE}/api/reports/${report.id}/photo/before?token=${token}`}
                              alt="Before"
                              className="rounded-lg border border-gray-200 max-h-48 mx-auto object-contain"
                            />
                          ) : (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-gray-300 text-sm">No photo</div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">After</p>
                          {report.photo_after ? (
                            <img
                              src={`${API_BASE}/api/reports/${report.id}/photo/after?token=${token}`}
                              alt="After"
                              className="rounded-lg border border-gray-200 max-h-48 mx-auto object-contain"
                            />
                          ) : (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-gray-300 text-sm">No photo</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Breakdown Chart */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
              Daily Breakdown
            </div>
            <div className="p-4">
              {summary.by_date.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">No data</p>
              ) : (
                <div className="space-y-3">
                  {summary.by_date.map((day) => {
                    const barWidth = maxDailyAccomplishment > 0
                      ? (day.total_accomplishment / maxDailyAccomplishment) * 100
                      : 0;
                    return (
                      <div key={day.report_date} className="flex items-center gap-4">
                        <div className="w-28 text-sm text-gray-600 shrink-0">
                          {formatDate(day.report_date)}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1e3a8a] transition-all duration-300"
                            style={{ width: `${Math.max(barWidth, 2)}%` }}
                          />
                        </div>
                        <div className="w-36 text-sm text-gray-600 text-right shrink-0">
                          <span className="font-medium">{day.total_accomplishment.toFixed(2)}</span> LN.M
                          <span className="text-gray-400 ml-1">({day.report_count})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
