import { useState, useEffect } from 'react';
import api from '../api';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'text-green-700 bg-green-50 border-green-300' },
  { value: 'absent', label: 'Absent', color: 'text-red-700 bg-red-50 border-red-300' },
  { value: 'leave', label: 'Leave', color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
  { value: 'rest_day', label: 'Rest Day', color: 'text-gray-700 bg-gray-50 border-gray-300' },
];

export default function Attendance() {
  const [tab, setTab] = useState('mark');
  const [areas, setAreas] = useState([]);
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    api.get('/attendance/areas').then(r => setAreas(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1e3a8a] text-white rounded-lg p-6 mb-6 shadow-lg">
        <h1 className="text-2xl font-bold">Manpower Attendance</h1>
        <p className="text-blue-200 mt-1">Track and manage daily workforce attendance</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('mark')}
          className={`flex-1 py-3 px-4 rounded-md font-semibold text-sm transition ${
            tab === 'mark'
              ? 'bg-[#1e3a8a] text-white shadow'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          Mark Attendance
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex-1 py-3 px-4 rounded-md font-semibold text-sm transition ${
            tab === 'report'
              ? 'bg-[#1e3a8a] text-white shadow'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          Attendance Report
        </button>
      </div>

      {tab === 'mark' ? (
        <MarkAttendance areas={areas} isAdmin={user?.role === 'admin'} />
      ) : (
        <AttendanceReport areas={areas} />
      )}
    </div>
  );
}

function MarkAttendance({ areas, isAdmin }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [area, setArea] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadAttendance() {
    setLoading(true);
    setMessage('');
    try {
      const params = { date };
      if (area) params.area = area;
      const r = await api.get('/attendance', { params });
      setEntries(r.data.map(e => ({
        manpower_id: e.manpower_id,
        name: e.name,
        position: e.position,
        designated_area: e.designated_area,
        status: e.status || 'absent',
        remarks: e.remarks || '',
      })));
    } catch (e) {
      setMessage('Failed to load attendance data');
    }
    setLoading(false);
  }

  function updateStatus(idx, status) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status } : e));
  }

  function updateRemarks(idx, remarks) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, remarks } : e));
  }

  function markAllPresent() {
    setEntries(prev => prev.map(e => ({ ...e, status: 'present' })));
  }

  async function saveAttendance() {
    if (!isAdmin) {
      setMessage('Only admins can save attendance');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        date,
        entries: entries.map(e => ({
          manpower_id: e.manpower_id,
          status: e.status,
          remarks: e.remarks || null,
        })),
      };
      const r = await api.post('/attendance', payload);
      setMessage(`Saved ${r.data.count} attendance records`);
    } catch (e) {
      setMessage(e.response?.data?.error || 'Failed to save');
    }
    setSaving(false);
  }

  const presentCount = entries.filter(e => e.status === 'present').length;
  const absentCount = entries.filter(e => e.status === 'absent').length;
  const leaveCount = entries.filter(e => e.status === 'leave').length;
  const restCount = entries.filter(e => e.status === 'rest_day').length;

  return (
    <div>
      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Area</label>
            <select
              value={area}
              onChange={e => setArea(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button
            onClick={loadAttendance}
            disabled={loading}
            className="bg-[#1e3a8a] hover:bg-[#1e3070] text-white px-5 py-2 rounded font-semibold text-sm transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load'}
          </button>
          {entries.length > 0 && (
            <>
              <button
                onClick={markAllPresent}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold text-sm transition"
              >
                Mark All Present
              </button>
              {isAdmin && (
                <button
                  onClick={saveAttendance}
                  disabled={saving}
                  className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-5 py-2 rounded font-bold text-sm transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {message && (
        <div className={`rounded p-3 mb-4 text-sm font-medium ${
          message.includes('Failed') || message.includes('Only')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {message}
        </div>
      )}

      {/* Summary Badges */}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
            Total: {entries.length}
          </span>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
            Present: {presentCount}
          </span>
          <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
            Absent: {absentCount}
          </span>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
            Leave: {leaveCount}
          </span>
          <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
            Rest Day: {restCount}
          </span>
        </div>
      )}

      {/* Attendance Table */}
      {entries.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a1a2e] text-white">
                <th className="px-3 py-3 text-left font-semibold">#</th>
                <th className="px-3 py-3 text-left font-semibold">Name</th>
                <th className="px-3 py-3 text-left font-semibold">Position</th>
                <th className="px-3 py-3 text-center font-semibold">Status</th>
                <th className="px-3 py-3 text-left font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.manpower_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-500 font-mono">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{entry.name}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{entry.position}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {STATUS_OPTIONS.map(opt => (
                        <label
                          key={opt.value}
                          className={`cursor-pointer px-2 py-1 rounded border text-xs font-semibold transition ${
                            entry.status === opt.value
                              ? opt.color + ' ring-2 ring-offset-1 ring-blue-400'
                              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`status-${entry.manpower_id}`}
                            value={opt.value}
                            checked={entry.status === opt.value}
                            onChange={() => updateStatus(idx, opt.value)}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={entry.remarks}
                      onChange={e => updateRemarks(idx, e.target.value)}
                      placeholder="Optional remarks"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Select a date and area, then click Load to view attendance</p>
        </div>
      )}
    </div>
  );
}

function AttendanceReport({ areas }) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo, setDateTo] = useState(today);
  const [area, setArea] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const params = { date_from: dateFrom, date_to: dateTo };
      if (area) params.area = area;
      const r = await api.get('/attendance/summary', { params });
      setData(r.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function exportExcel() {
    const token = localStorage.getItem('token');
    const isProd = window.location.port === '' || window.location.port === '443' || window.location.port === '80';
    const base = isProd ? '' : `http://${window.location.hostname}:3001`;
    let url = `${base}/api/attendance/export?date_from=${dateFrom}&date_to=${dateTo}&token=${token}`;
    if (area) url += `&area=${encodeURIComponent(area)}`;
    window.open(url, '_blank');
  }

  function getPercentColor(pct) {
    if (pct >= 80) return 'text-green-700 bg-green-50';
    if (pct >= 50) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  }

  return (
    <div>
      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Area</label>
            <select
              value={area}
              onChange={e => setArea(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="bg-[#1e3a8a] hover:bg-[#1e3070] text-white px-5 py-2 rounded font-semibold text-sm transition disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {data.length > 0 && (
            <button
              onClick={exportExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold text-sm transition"
            >
              Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Report Table */}
      {data.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a1a2e] text-white">
                <th className="px-3 py-3 text-left font-semibold">#</th>
                <th className="px-3 py-3 text-left font-semibold">Name</th>
                <th className="px-3 py-3 text-left font-semibold">Position</th>
                <th className="px-3 py-3 text-left font-semibold">Area</th>
                <th className="px-3 py-3 text-center font-semibold">Present</th>
                <th className="px-3 py-3 text-center font-semibold">Absent</th>
                <th className="px-3 py-3 text-center font-semibold">Leave</th>
                <th className="px-3 py-3 text-center font-semibold">Rest Day</th>
                <th className="px-3 py-3 text-center font-semibold">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const total = row.total_present + row.total_absent + row.total_leave + row.total_rest_day;
                const workDays = total - row.total_rest_day;
                const pct = workDays > 0 ? Math.round((row.total_present / workDays) * 100) : 0;
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{row.position}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{row.designated_area}</td>
                    <td className="px-3 py-2 text-center font-semibold text-green-700">{row.total_present}</td>
                    <td className="px-3 py-2 text-center font-semibold text-red-700">{row.total_absent}</td>
                    <td className="px-3 py-2 text-center font-semibold text-yellow-700">{row.total_leave}</td>
                    <td className="px-3 py-2 text-center font-semibold text-gray-600">{row.total_rest_day}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded font-bold text-xs ${getPercentColor(pct)}`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Select a date range and click Generate Report</p>
        </div>
      )}
    </div>
  );
}
