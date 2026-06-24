import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatCurrency(val) {
  return parseFloat(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Billing() {
  const [activeTab, setActiveTab] = useState('equipment');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Equipment state
  const [equipment, setEquipment] = useState([]);
  const [eqDaysUsed, setEqDaysUsed] = useState({});
  const [eqLoading, setEqLoading] = useState(false);
  const [eqSaving, setEqSaving] = useState(false);

  // Manpower state
  const [manpower, setManpower] = useState([]);
  const [mpDaysUsed, setMpDaysUsed] = useState({});
  const [mpLoading, setMpLoading] = useState(false);
  const [mpSaving, setMpSaving] = useState(false);
  const [attendanceDays, setAttendanceDays] = useState({});  // { billing_manpower_id: days_present }
  const [autoFilling, setAutoFilling] = useState(false);

  // Summary state
  const [summary, setSummary] = useState(null);
  const [sumLoading, setSumLoading] = useState(false);

  const [message, setMessage] = useState('');

  // Load equipment
  const loadEquipment = useCallback(async () => {
    setEqLoading(true);
    try {
      const [eqRes, recRes] = await Promise.all([
        api.get('/billing/equipment'),
        api.get('/billing/records', { params: { month, year } }),
      ]);
      setEquipment(eqRes.data);
      const daysMap = {};
      recRes.data
        .filter(r => r.billing_type === 'equipment')
        .forEach(r => { daysMap[r.reference_id] = r.days_used; });
      setEqDaysUsed(daysMap);
    } catch (err) {
      console.error('Error loading equipment:', err);
    }
    setEqLoading(false);
  }, [month, year]);

  // Load manpower
  const loadManpower = useCallback(async () => {
    setMpLoading(true);
    try {
      const [mpRes, recRes] = await Promise.all([
        api.get('/billing/manpower'),
        api.get('/billing/records', { params: { month, year } }),
      ]);
      setManpower(mpRes.data);
      const daysMap = {};
      recRes.data
        .filter(r => r.billing_type === 'manpower')
        .forEach(r => { daysMap[r.reference_id] = r.days_used; });
      setMpDaysUsed(daysMap);
    } catch (err) {
      console.error('Error loading manpower:', err);
    }
    setMpLoading(false);
  }, [month, year]);

  // Load attendance days when manpower tab is active
  const loadAttendanceDays = useCallback(async () => {
    try {
      const res = await api.get('/billing/auto-days', { params: { month, year } });
      const daysMap = {};
      res.data.forEach(r => { daysMap[r.billing_manpower_id] = r.days_present; });
      setAttendanceDays(daysMap);
    } catch (err) {
      console.error('Error loading attendance days:', err);
    }
  }, [month, year]);

  // Auto-fill days_used from attendance
  async function autoFillFromAttendance() {
    setAutoFilling(true);
    try {
      const res = await api.get('/billing/auto-days', { params: { month, year } });
      const daysMap = {};
      const attMap = {};
      res.data.forEach(r => {
        daysMap[r.billing_manpower_id] = r.days_present;
        attMap[r.billing_manpower_id] = r.days_present;
      });
      setMpDaysUsed(prev => {
        const updated = { ...prev };
        Object.entries(daysMap).forEach(([id, days]) => {
          updated[id] = days;
        });
        return updated;
      });
      setAttendanceDays(attMap);
      setMessage('Days auto-filled from attendance records!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error auto-filling from attendance: ' + (err.response?.data?.error || err.message));
    }
    setAutoFilling(false);
  }

  // Load on tab change / month-year change
  useEffect(() => {
    if (activeTab === 'equipment') loadEquipment();
    else if (activeTab === 'manpower') {
      loadManpower();
      loadAttendanceDays();
    }
  }, [activeTab, loadEquipment, loadManpower, loadAttendanceDays]);

  // Save equipment records
  async function saveEquipmentRecords() {
    setEqSaving(true);
    try {
      const records = equipment.map(eq => ({
        billing_type: 'equipment',
        reference_id: eq.id,
        billing_month: month,
        billing_year: year,
        days_used: parseFloat(eqDaysUsed[eq.id]) || 0,
      }));
      await api.post('/billing/records', { records });
      setMessage('Equipment billing records saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error saving records: ' + (err.response?.data?.error || err.message));
    }
    setEqSaving(false);
  }

  // Save manpower records
  async function saveManpowerRecords() {
    setMpSaving(true);
    try {
      const records = manpower.map(mp => ({
        billing_type: 'manpower',
        reference_id: mp.id,
        billing_month: month,
        billing_year: year,
        days_used: parseFloat(mpDaysUsed[mp.id]) || 0,
      }));
      await api.post('/billing/records', { records });
      setMessage('Manpower billing records saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error saving records: ' + (err.response?.data?.error || err.message));
    }
    setMpSaving(false);
  }

  // Generate summary
  async function generateSummary() {
    setSumLoading(true);
    try {
      const res = await api.get('/billing/summary', { params: { month, year } });
      setSummary(res.data);
    } catch (err) {
      console.error('Error generating summary:', err);
      setMessage('Error generating summary: ' + (err.response?.data?.error || err.message));
    }
    setSumLoading(false);
  }

  // Export Excel
  function exportExcel() {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;
    window.open(`${baseUrl}/api/billing/export?month=${month}&year=${year}&token=${token}`, '_blank');
  }

  // Group equipment by category
  function groupByCategory(items) {
    const groups = {};
    items.forEach(item => {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }

  // Group manpower by team
  function groupByTeam(items) {
    const groups = {};
    items.forEach(item => {
      const team = item.team || 'Other';
      if (!groups[team]) groups[team] = [];
      groups[team].push(item);
    });
    return groups;
  }

  const tabs = [
    { key: 'equipment', label: 'Equipment' },
    { key: 'manpower', label: 'Manpower' },
    { key: 'summary', label: 'Billing Summary' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">Bridge Department Billing</h1>
        <p className="text-gray-500 text-sm mt-1">Manage equipment and manpower billing for the Bridge department</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded text-sm font-medium ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Month/Year selector */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Month:</label>
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Year:</label>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500 font-medium">
          Billing Period: {MONTH_NAMES[month]} {year}
        </span>
      </div>

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

      {/* Tab Content */}
      {activeTab === 'equipment' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {eqLoading ? (
            <div className="p-8 text-center text-gray-500">Loading equipment...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                      <th className="px-3 py-3 text-left font-medium">Category</th>
                      <th className="px-3 py-3 text-left font-medium">Equipment Name</th>
                      <th className="px-3 py-3 text-left font-medium">Body No.</th>
                      <th className="px-3 py-3 text-left font-medium">Assignment</th>
                      <th className="px-3 py-3 text-center font-medium">Unit</th>
                      <th className="px-3 py-3 text-right font-medium">Unit Rate</th>
                      <th className="px-3 py-3 text-center font-medium">Contracted Qty</th>
                      <th className="px-3 py-3 text-right font-medium">Daily Rate</th>
                      <th className="px-3 py-3 text-center font-medium">Days Used</th>
                      <th className="px-3 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupByCategory(equipment)).map(([category, items]) => (
                      items.map((eq, idx) => {
                        const days = parseFloat(eqDaysUsed[eq.id]) || 0;
                        const amount = parseFloat(eq.daily_rate) * days;
                        return (
                          <tr key={eq.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {idx === 0 && (
                              <td
                                className="px-3 py-2 font-semibold text-[#1e3a8a] bg-blue-50 border-l-4 border-[#1e3a8a]"
                                rowSpan={items.length}
                              >
                                {category}
                              </td>
                            )}
                            <td className="px-3 py-2">{eq.equipment_name}</td>
                            <td className="px-3 py-2 text-gray-600">{eq.body_no || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{eq.assignment || '-'}</td>
                            <td className="px-3 py-2 text-center">{eq.unit}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(eq.unit_rate)}</td>
                            <td className="px-3 py-2 text-center">{parseFloat(eq.contracted_qty)}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(eq.daily_rate)}</td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={eqDaysUsed[eq.id] ?? ''}
                                onChange={e => setEqDaysUsed(prev => ({ ...prev, [eq.id]: e.target.value }))}
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">
                              {formatCurrency(amount)}
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1a1a2e] text-white font-bold">
                      <td colSpan={9} className="px-3 py-3 text-right">EQUIPMENT TOTAL:</td>
                      <td className="px-3 py-3 text-right font-mono">
                        {formatCurrency(
                          equipment.reduce((sum, eq) => sum + parseFloat(eq.daily_rate) * (parseFloat(eqDaysUsed[eq.id]) || 0), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button
                  onClick={saveEquipmentRecords}
                  disabled={eqSaving}
                  className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-6 py-2 rounded font-medium transition disabled:opacity-50"
                >
                  {eqSaving ? 'Saving...' : 'Save Equipment Records'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'manpower' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {mpLoading ? (
            <div className="p-8 text-center text-gray-500">Loading manpower...</div>
          ) : (
            <>
              {/* Auto-fill button */}
              <div className="p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={autoFillFromAttendance}
                    disabled={autoFilling}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium text-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {autoFilling ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Auto-filling...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Auto-fill from Attendance
                      </>
                    )}
                  </button>
                  <span className="text-xs text-gray-500">
                    Fills "Days Used" with present-day counts from the Attendance system for {MONTH_NAMES[month]} {year}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                      <th className="px-3 py-3 text-left font-medium">Team</th>
                      <th className="px-3 py-3 text-left font-medium">Position</th>
                      <th className="px-3 py-3 text-left font-medium">Name</th>
                      <th className="px-3 py-3 text-left font-medium">Description</th>
                      <th className="px-3 py-3 text-right font-medium">Daily Rate</th>
                      <th className="px-3 py-3 text-center font-medium">Days Used</th>
                      <th className="px-3 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupByTeam(manpower)).map(([team, items]) => (
                      items.map((mp, idx) => {
                        const days = parseFloat(mpDaysUsed[mp.id]) || 0;
                        const amount = parseFloat(mp.daily_rate) * days;
                        const attDays = attendanceDays[mp.id];
                        return (
                          <tr key={mp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {idx === 0 && (
                              <td
                                className="px-3 py-2 font-semibold text-[#1e3a8a] bg-blue-50 border-l-4 border-[#1e3a8a]"
                                rowSpan={items.length}
                              >
                                {team}
                              </td>
                            )}
                            <td className="px-3 py-2">{mp.position}</td>
                            <td className="px-3 py-2 font-medium">{mp.name}</td>
                            <td className="px-3 py-2 text-gray-600 text-xs">{mp.description}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(mp.daily_rate)}</td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex flex-col items-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={mpDaysUsed[mp.id] ?? ''}
                                  onChange={e => setMpDaysUsed(prev => ({ ...prev, [mp.id]: e.target.value }))}
                                  className="w-20 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="0"
                                />
                                {attDays !== undefined && (
                                  <span className="text-xs text-gray-400 mt-0.5">
                                    Attendance: {attDays} {attDays === 1 ? 'day' : 'days'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">
                              {formatCurrency(amount)}
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1a1a2e] text-white font-bold">
                      <td colSpan={6} className="px-3 py-3 text-right">MANPOWER TOTAL:</td>
                      <td className="px-3 py-3 text-right font-mono">
                        {formatCurrency(
                          manpower.reduce((sum, mp) => sum + parseFloat(mp.daily_rate) * (parseFloat(mpDaysUsed[mp.id]) || 0), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button
                  onClick={saveManpowerRecords}
                  disabled={mpSaving}
                  className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-6 py-2 rounded font-medium transition disabled:opacity-50"
                >
                  {mpSaving ? 'Saving...' : 'Save Manpower Records'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'summary' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={generateSummary}
              disabled={sumLoading}
              className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-6 py-2 rounded font-medium transition disabled:opacity-50"
            >
              {sumLoading ? 'Generating...' : 'Generate Summary'}
            </button>
            {summary && (
              <button
                onClick={exportExcel}
                className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-6 py-2 rounded font-bold transition"
              >
                Export Excel
              </button>
            )}
          </div>

          {summary && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Equipment Section */}
              <div className="bg-[#1e3a8a] text-white px-4 py-3 font-bold text-sm">
                A.1 Equipment
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="px-3 py-2 text-left font-medium text-[#1e3a8a]">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-[#1e3a8a]">Equipment</th>
                      <th className="px-3 py-2 text-right font-medium text-[#1e3a8a]">Daily Rate</th>
                      <th className="px-3 py-2 text-center font-medium text-[#1e3a8a]">Days Used</th>
                      <th className="px-3 py-2 text-right font-medium text-[#1e3a8a]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.equipment.map((eq, idx) => (
                      <tr key={eq.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 text-gray-600">{eq.category}</td>
                        <td className="px-3 py-1.5">{eq.equipment_name}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(eq.daily_rate)}</td>
                        <td className="px-3 py-1.5 text-center">{parseFloat(eq.days_used)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(eq.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={4} className="px-3 py-2 text-right text-[#1e3a8a]">Equipment Subtotal:</td>
                      <td className="px-3 py-2 text-right font-mono text-[#1e3a8a]">{formatCurrency(summary.totals.equipmentTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Manpower Section */}
              <div className="bg-[#1e3a8a] text-white px-4 py-3 font-bold text-sm mt-0">
                A.2 Manpower
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="px-3 py-2 text-left font-medium text-[#1e3a8a]">Team</th>
                      <th className="px-3 py-2 text-left font-medium text-[#1e3a8a]">Position</th>
                      <th className="px-3 py-2 text-left font-medium text-[#1e3a8a]">Name</th>
                      <th className="px-3 py-2 text-right font-medium text-[#1e3a8a]">Daily Rate</th>
                      <th className="px-3 py-2 text-center font-medium text-[#1e3a8a]">Attendance Days</th>
                      <th className="px-3 py-2 text-center font-medium text-[#1e3a8a]">Days Used</th>
                      <th className="px-3 py-2 text-right font-medium text-[#1e3a8a]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.manpower.map((mp, idx) => (
                      <tr key={mp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 text-gray-600">{mp.team}</td>
                        <td className="px-3 py-1.5">{mp.position}</td>
                        <td className="px-3 py-1.5 font-medium">{mp.name}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(mp.daily_rate)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className="text-emerald-600 font-medium">{parseInt(mp.attendance_days) || 0}</span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {parseFloat(mp.days_used)}
                          {parseFloat(mp.days_used) > 0 && parseInt(mp.attendance_days) > 0 && parseFloat(mp.days_used) !== parseInt(mp.attendance_days) && (
                            <span className="text-xs text-amber-600 ml-1" title="Days used differs from attendance count">(manual)</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(mp.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={6} className="px-3 py-2 text-right text-[#1e3a8a]">Manpower Subtotal:</td>
                      <td className="px-3 py-2 text-right font-mono text-[#1e3a8a]">{formatCurrency(summary.totals.manpowerTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Billing Computation */}
              <div className="bg-[#1a1a2e] text-white px-4 py-3 font-bold text-sm">
                Billing Computation
              </div>
              <div className="p-4">
                <table className="w-full text-sm max-w-lg ml-auto">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 font-medium">Sub-total A (Direct Resources)</td>
                      <td className="py-2 text-right font-mono font-bold text-[#1e3a8a]">{formatCurrency(summary.totals.subTotalA)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">B. General & Admin Overhead (15%)</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(summary.totals.gaOverhead)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">C. Profit (10%)</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(summary.totals.profit)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">D. VAT (12%)</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(summary.totals.vat)}</td>
                    </tr>
                    <tr className="bg-[#f59e0b]/10">
                      <td className="py-3 font-bold text-lg text-[#1a1a2e]">GRAND TOTAL</td>
                      <td className="py-3 text-right font-mono font-bold text-lg text-[#1a1a2e]">{formatCurrency(summary.totals.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!summary && !sumLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-lg">Select a billing period and click "Generate Summary" to view the billing computation.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
