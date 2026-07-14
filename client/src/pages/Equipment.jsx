import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const STATUS_OPTIONS = [
  { value: 'deployed', label: 'Deployed', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'standby', label: 'Standby', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'breakdown', label: 'Breakdown', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
];

function getStatusColor(status) {
  const opt = STATUS_OPTIONS.find(s => s.value === status);
  return opt ? opt.color : 'bg-gray-100 text-gray-800 border-gray-300';
}

function getUtilizationColor(pct) {
  if (pct >= 80) return 'text-green-700 bg-green-50';
  if (pct >= 50) return 'text-yellow-700 bg-yellow-50';
  return 'text-red-700 bg-red-50';
}

export default function Equipment() {
  const [activeTab, setActiveTab] = useState('tracking');

  // --- Daily Tracking state ---
  const [trackDate, setTrackDate] = useState(new Date().toISOString().split('T')[0]);
  const [trackData, setTrackData] = useState([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackSaving, setTrackSaving] = useState(false);
  const [message, setMessage] = useState('');

  // --- Equipment Report state ---
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Set default date range for report: first and last day of current month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setDateFrom(firstDay);
    setDateTo(lastDay);
  }, []);

  // Load daily tracking
  const loadTracking = useCallback(async () => {
    setTrackLoading(true);
    try {
      const res = await api.get('/equipment-tracking', { params: { date: trackDate } });
      setTrackData(res.data.map(item => ({
        ...item,
        status: item.status || 'deployed',
        hours_used: item.hours_used || 0,
        remarks: item.remarks || '',
      })));
    } catch (err) {
      console.error('Error loading equipment tracking:', err);
      setMessage('Error loading equipment data: ' + (err.response?.data?.error || err.message));
    }
    setTrackLoading(false);
  }, [trackDate]);

  // Auto-load on date change
  useEffect(() => {
    if (activeTab === 'tracking') {
      loadTracking();
    }
  }, [activeTab, loadTracking]);

  // Update a tracking entry field
  function updateEntry(equipmentId, field, value) {
    setTrackData(prev => prev.map(item =>
      item.equipment_id === equipmentId ? { ...item, [field]: value } : item
    ));
  }

  // Mark all as deployed
  function markAllDeployed() {
    setTrackData(prev => prev.map(item => ({ ...item, status: 'deployed' })));
    setMessage('All equipment marked as Deployed');
    setTimeout(() => setMessage(''), 3000);
  }

  // Save tracking
  async function saveTracking() {
    setTrackSaving(true);
    try {
      const entries = trackData.map(item => ({
        billing_equipment_id: item.equipment_id,
        status: item.status,
        hours_used: parseFloat(item.hours_used) || 0,
        remarks: item.remarks || '',
      }));
      await api.post('/equipment-tracking', { date: trackDate, entries });
      setMessage('Equipment tracking saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error saving: ' + (err.response?.data?.error || err.message));
    }
    setTrackSaving(false);
  }

  // Generate report
  async function generateReport() {
    if (!dateFrom || !dateTo) {
      setMessage('Please select both From and To dates');
      return;
    }
    setReportLoading(true);
    try {
      const res = await api.get('/equipment-tracking/summary', { params: { date_from: dateFrom, date_to: dateTo } });
      setReportData(res.data);
    } catch (err) {
      console.error('Error generating report:', err);
      setMessage('Error generating report: ' + (err.response?.data?.error || err.message));
    }
    setReportLoading(false);
  }

  // Export Excel
  function exportExcel() {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;
    window.open(`${baseUrl}/api/equipment-tracking/export?date_from=${dateFrom}&date_to=${dateTo}&token=${token}`, '_blank');
  }

  const tabs = [
    { key: 'tracking', label: 'Daily Tracking' },
    { key: 'report', label: 'Equipment Report' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">Equipment Management</h1>
        <p className="text-gray-500 text-sm mt-1">Track daily equipment status and generate utilization reports</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded text-sm font-medium ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? 'border-[#1e3a8a] text-[#1e3a8a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Daily Tracking */}
      {activeTab === 'tracking' && (
        <div>
          {/* Date picker and actions */}
          <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Date:</label>
              <input
                type="date"
                value={trackDate}
                onChange={e => setTrackDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={loadTracking}
              className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-4 py-1.5 rounded text-sm font-medium transition"
            >
              Load
            </button>
            <button
              onClick={markAllDeployed}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-sm font-medium transition"
            >
              Mark All Deployed
            </button>
          </div>

          {/* Tracking table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {trackLoading ? (
              <div className="p-8 text-center text-gray-500">Loading equipment...</div>
            ) : trackData.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No equipment found. Make sure billing equipment is set up.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1e3a8a] text-white">
                        <th className="px-3 py-3 text-center font-medium w-10">#</th>
                        <th className="px-3 py-3 text-left font-medium">Equipment Name</th>
                        <th className="px-3 py-3 text-left font-medium">Body No.</th>
                        <th className="px-3 py-3 text-left font-medium">Category</th>
                        <th className="px-3 py-3 text-center font-medium">Status</th>
                        <th className="px-3 py-3 text-center font-medium">Hours Used</th>
                        <th className="px-3 py-3 text-left font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackData.map((item, idx) => (
                        <tr key={item.equipment_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-center text-gray-500 font-mono text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{item.equipment_name}</td>
                          <td className="px-3 py-2 text-gray-600">{item.body_no || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{item.category || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={item.status}
                              onChange={e => updateEntry(item.equipment_id, 'status', e.target.value)}
                              className={`border rounded px-2 py-1 text-sm font-medium ${getStatusColor(item.status)}`}
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              value={item.hours_used}
                              onChange={e => updateEntry(item.equipment_id, 'hours_used', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.remarks}
                              onChange={e => updateEntry(item.equipment_id, 'remarks', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Optional remarks"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end">
                  <button
                    onClick={saveTracking}
                    disabled={trackSaving}
                    className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-6 py-2 rounded font-medium transition disabled:opacity-50"
                  >
                    {trackSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Equipment Report */}
      {activeTab === 'report' && (
        <div>
          {/* Date range picker */}
          <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={generateReport}
              disabled={reportLoading}
              className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-6 py-2 rounded font-medium transition disabled:opacity-50"
            >
              {reportLoading ? 'Generating...' : 'Generate'}
            </button>
            {reportData.length > 0 && (
              <button
                onClick={exportExcel}
                className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-6 py-2 rounded font-bold transition"
              >
                Export Excel
              </button>
            )}
          </div>

          {/* Report table */}
          {reportData.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                      <th className="px-3 py-3 text-left font-medium">Equipment Name</th>
                      <th className="px-3 py-3 text-left font-medium">Category</th>
                      <th className="px-3 py-3 text-center font-medium">
                        <span className="inline-block w-3 h-3 bg-green-400 rounded-full mr-1"></span>
                        Days Deployed
                      </th>
                      <th className="px-3 py-3 text-center font-medium">
                        <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mr-1"></span>
                        Days Standby
                      </th>
                      <th className="px-3 py-3 text-center font-medium">
                        <span className="inline-block w-3 h-3 bg-red-400 rounded-full mr-1"></span>
                        Days Breakdown
                      </th>
                      <th className="px-3 py-3 text-center font-medium">
                        <span className="inline-block w-3 h-3 bg-yellow-400 rounded-full mr-1"></span>
                        Days Maintenance
                      </th>
                      <th className="px-3 py-3 text-center font-medium">Utilization %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((item, idx) => {
                      const totalDays = item.days_deployed + item.days_standby + item.days_breakdown + item.days_maintenance;
                      const utilization = totalDays > 0 ? Math.round((item.days_deployed / totalDays) * 100) : 0;
                      return (
                        <tr key={item.equipment_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium">{item.equipment_name}</td>
                          <td className="px-3 py-2 text-gray-600">{item.category || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium min-w-[2rem]">
                              {item.days_deployed}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium min-w-[2rem]">
                              {item.days_standby}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block bg-red-100 text-red-800 px-2 py-0.5 rounded font-medium min-w-[2rem]">
                              {item.days_breakdown}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium min-w-[2rem]">
                              {item.days_maintenance}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {totalDays > 0 ? (
                              <span className={`inline-block px-3 py-0.5 rounded font-bold ${getUtilizationColor(utilization)}`}>
                                {utilization}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            !reportLoading && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-400 text-lg">Select a date range and click "Generate" to view equipment utilization report.</p>
              </div>
            )
          )}
        </div>
      )}

    </div>
  );
}
