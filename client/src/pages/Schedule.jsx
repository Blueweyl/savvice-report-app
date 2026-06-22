import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const YEARS = [2025, 2026, 2027];

function getPercentageColor(pct) {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getPercentageBg(pct) {
  if (pct >= 80) return 'bg-green-100 text-green-700';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function getProgressBarColor(pct) {
  if (pct >= 80) return 'from-green-400 to-green-600';
  if (pct >= 50) return 'from-yellow-400 to-yellow-500';
  return 'from-red-400 to-red-500';
}

function formatNumber(num) {
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Schedule() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState(isAdmin ? 'targets' : 'overview');
  const [departments, setDepartments] = useState([]);
  const [activities, setActivities] = useState([]);

  // Target setting state
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetActivityId, setTargetActivityId] = useState('');
  const [monthlyTargets, setMonthlyTargets] = useState(Array(12).fill(''));
  const [savingTargets, setSavingTargets] = useState(false);
  const [targetMessage, setTargetMessage] = useState({ type: '', text: '' });

  // Manual accomplishment state (spreadsheet grid)
  const [accomYear, setAccomYear] = useState(new Date().getFullYear());
  const [accomDeptId, setAccomDeptId] = useState('');
  const [gridActivities, setGridActivities] = useState([]); // list of activities for the department
  const [gridData, setGridData] = useState({}); // { [activityId]: { targets: [12], accomplishments: [12] } }
  const [gridLoaded, setGridLoaded] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [savingAccom, setSavingAccom] = useState(false);
  const [accomMessage, setAccomMessage] = useState({ type: '', text: '' });

  // Overview state
  const [overviewYear, setOverviewYear] = useState(new Date().getFullYear());
  const [overviewDeptId, setOverviewDeptId] = useState('');
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [expandedActivity, setExpandedActivity] = useState(null);

  useEffect(() => {
    api.get('/departments').then(res => setDepartments(res.data)).catch(() => {});
  }, []);

  // Load activities when target department changes
  useEffect(() => {
    if (targetDeptId) {
      api.get(`/departments/${targetDeptId}/activities`).then(res => setActivities(res.data)).catch(() => {});
    } else {
      setActivities([]);
    }
    setTargetActivityId('');
    setMonthlyTargets(Array(12).fill(''));
  }, [targetDeptId]);

  // Load existing targets when activity is selected
  useEffect(() => {
    if (targetActivityId && targetYear) {
      api.get(`/schedule/targets?year=${targetYear}&department_id=${targetDeptId}`)
        .then(res => {
          const existing = res.data.filter(t => t.activity_id === parseInt(targetActivityId));
          const newTargets = Array(12).fill('');
          existing.forEach(t => {
            newTargets[t.month - 1] = t.target_value ? String(parseFloat(t.target_value)) : '';
          });
          setMonthlyTargets(newTargets);
        })
        .catch(() => {});
    }
  }, [targetActivityId, targetYear, targetDeptId]);

  // Reset grid when department changes
  useEffect(() => {
    setGridData({});
    setGridActivities([]);
    setGridLoaded(false);
  }, [accomDeptId, accomYear]);

  // Load all activities with targets and accomplishments for the grid
  const handleLoadGrid = async () => {
    if (!accomDeptId || !accomYear) {
      setAccomMessage({ type: 'error', text: 'Please select both year and department' });
      return;
    }

    setLoadingGrid(true);
    setAccomMessage({ type: '', text: '' });

    try {
      // Fetch activities, targets, and accomplishments in parallel
      const [activitiesRes, targetsRes, accomRes] = await Promise.all([
        api.get(`/departments/${accomDeptId}/activities`),
        api.get(`/schedule/targets?year=${accomYear}&department_id=${accomDeptId}`),
        api.get(`/schedule/accomplishments?year=${accomYear}&department_id=${accomDeptId}`)
      ]);

      const acts = activitiesRes.data;
      setGridActivities(acts);

      // Build grid data keyed by activity_id
      const data = {};
      acts.forEach(a => {
        data[a.id] = {
          targets: Array(12).fill(0),
          accomplishments: Array(12).fill('')
        };
      });

      // Fill in targets
      targetsRes.data.forEach(t => {
        if (data[t.activity_id]) {
          data[t.activity_id].targets[t.month - 1] = parseFloat(t.target_value) || 0;
        }
      });

      // Fill in accomplishments
      accomRes.data.forEach(a => {
        if (data[a.activity_id]) {
          data[a.activity_id].accomplishments[a.month - 1] = a.accomplishment_value ? String(parseFloat(a.accomplishment_value)) : '';
        }
      });

      setGridData(data);
      setGridLoaded(true);
    } catch (err) {
      setAccomMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load data' });
    } finally {
      setLoadingGrid(false);
    }
  };

  const handleSaveTargets = async () => {
    if (!targetYear || !targetActivityId) {
      setTargetMessage({ type: 'error', text: 'Please select year and activity' });
      return;
    }

    setSavingTargets(true);
    setTargetMessage({ type: '', text: '' });

    try {
      const targets = monthlyTargets.map((val, i) => ({
        month: i + 1,
        target_value: parseFloat(val) || 0
      }));

      await api.post('/schedule/targets', {
        year: targetYear,
        activity_id: parseInt(targetActivityId),
        targets
      });

      setTargetMessage({ type: 'success', text: 'Targets saved successfully!' });
    } catch (err) {
      setTargetMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save targets' });
    } finally {
      setSavingTargets(false);
    }
  };

  const handleSaveAccomplishments = async () => {
    if (!accomYear || !accomDeptId || gridActivities.length === 0) {
      setAccomMessage({ type: 'error', text: 'Please load a department first' });
      return;
    }

    setSavingAccom(true);
    setAccomMessage({ type: '', text: '' });

    try {
      // Save all activities that have any accomplishment values
      const savePromises = gridActivities.map(activity => {
        const row = gridData[activity.id];
        if (!row) return null;

        const accomplishments = row.accomplishments.map((val, i) => ({
          month: i + 1,
          accomplishment_value: parseFloat(val) || 0
        }));

        return api.post('/schedule/accomplishments', {
          year: accomYear,
          activity_id: activity.id,
          accomplishments
        });
      }).filter(Boolean);

      await Promise.all(savePromises);
      setAccomMessage({ type: 'success', text: `All accomplishments saved successfully! (${savePromises.length} activities)` });
    } catch (err) {
      setAccomMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save accomplishments' });
    } finally {
      setSavingAccom(false);
    }
  };

  const fetchOverview = useCallback(async () => {
    if (!overviewYear || !overviewDeptId) {
      setOverviewError('Please select both year and department');
      return;
    }

    setLoadingOverview(true);
    setOverviewError('');
    setOverview(null);

    try {
      const res = await api.get(`/schedule/overview?year=${overviewYear}&department_id=${overviewDeptId}`);
      setOverview(res.data);
    } catch (err) {
      setOverviewError(err.response?.data?.error || 'Failed to load overview');
    } finally {
      setLoadingOverview(false);
    }
  }, [overviewYear, overviewDeptId]);

  const annualTotal = monthlyTargets.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  // Helper to update a single cell in the grid
  const updateGridCell = (activityId, monthIndex, value) => {
    setGridData(prev => {
      const updated = { ...prev };
      const row = { ...updated[activityId] };
      const accomplishments = [...row.accomplishments];
      accomplishments[monthIndex] = value;
      row.accomplishments = accomplishments;
      updated[activityId] = row;
      return updated;
    });
  };

  // Compute annual total for a single activity row
  const getRowTotal = (activityId) => {
    const row = gridData[activityId];
    if (!row) return 0;
    return row.accomplishments.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  };

  // Compute annual target total for a single activity row
  const getRowTargetTotal = (activityId) => {
    const row = gridData[activityId];
    if (!row) return 0;
    return row.targets.reduce((sum, v) => sum + v, 0);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Annual Schedule</h2>

      {/* Tab Selector */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 max-w-xl">
        {isAdmin && (
          <button
            onClick={() => setActiveTab('targets')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'targets'
                ? 'bg-[#1e3a8a] text-white shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Set Targets
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('accomplishments')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${
              activeTab === 'accomplishments'
                ? 'bg-[#1e3a8a] text-white shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Manual Accomplishment
          </button>
        )}
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${
            activeTab === 'overview'
              ? 'bg-[#1e3a8a] text-white shadow'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Target vs Accomplishment
        </button>
      </div>

      {/* ========== SET TARGETS TAB (Admin Only) ========== */}
      {activeTab === 'targets' && isAdmin && (
        <div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
              Set Annual Targets
            </div>
            <div className="p-6">
              {/* Selectors */}
              <div className="flex flex-wrap gap-4 items-end mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={targetYear}
                    onChange={e => setTargetYear(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={targetDeptId}
                    onChange={e => setTargetDeptId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
                  <select
                    value={targetActivityId}
                    onChange={e => setTargetActivityId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-w-[220px]"
                    disabled={!targetDeptId}
                  >
                    <option value="">Select Activity</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Monthly Target Grid */}
              {targetActivityId && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                    {MONTH_NAMES.map((month, i) => (
                      <div key={month} className="border border-gray-200 rounded-lg p-3">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{month}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={monthlyTargets[i]}
                          onChange={e => {
                            const updated = [...monthlyTargets];
                            updated[i] = e.target.value;
                            setMonthlyTargets(updated);
                          }}
                          placeholder="0.00"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 mb-4">
                    <div className="text-sm text-gray-600">
                      Annual Total: <span className="font-bold text-[#1e3a8a] text-lg">{formatNumber(annualTotal)}</span>
                    </div>
                    <button
                      onClick={handleSaveTargets}
                      disabled={savingTargets}
                      className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-6 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                    >
                      {savingTargets ? 'Saving...' : 'Save Targets'}
                    </button>
                  </div>
                </>
              )}

              {targetMessage.text && (
                <div className={`px-4 py-3 rounded-lg text-sm ${
                  targetMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {targetMessage.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== MANUAL ACCOMPLISHMENT TAB (Admin Only) ========== */}
      {activeTab === 'accomplishments' && isAdmin && (
        <div>
          {/* Selectors */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
              Manual Accomplishment Entry — Spreadsheet View
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={accomYear}
                    onChange={e => setAccomYear(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={accomDeptId}
                    onChange={e => setAccomDeptId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleLoadGrid}
                  disabled={loadingGrid || !accomDeptId}
                  className="bg-[#1e3a8a] hover:bg-[#1a1a2e] text-white px-6 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                >
                  {loadingGrid ? 'Loading...' : 'Load'}
                </button>
              </div>
            </div>
          </div>

          {/* Message */}
          {accomMessage.text && (
            <div className={`px-4 py-3 rounded-lg text-sm mb-6 ${
              accomMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {accomMessage.text}
            </div>
          )}

          {/* Empty state before loading */}
          {!gridLoaded && !loadingGrid && (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500">Select a year and department, then click "Load" to view the spreadsheet.</p>
            </div>
          )}

          {/* Spreadsheet Grid */}
          {gridLoaded && gridActivities.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '1100px' }}>
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                      <th className="text-left px-3 py-2 text-xs font-semibold sticky left-0 bg-[#1e3a8a] z-10 min-w-[180px] border-r border-blue-700">
                        Activity
                      </th>
                      {MONTH_SHORT.map(m => (
                        <th key={m} className="text-center px-1 py-2 text-xs font-semibold" style={{ width: '70px' }}>
                          {m}
                        </th>
                      ))}
                      <th className="text-center px-2 py-2 text-xs font-semibold border-l border-blue-700" style={{ width: '90px' }}>
                        Annual Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridActivities.map((activity, rowIdx) => {
                      const row = gridData[activity.id];
                      if (!row) return null;
                      const rowTotal = getRowTotal(activity.id);
                      const rowTargetTotal = getRowTargetTotal(activity.id);

                      return (
                        <tr
                          key={activity.id}
                          className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className={`px-3 py-2 text-xs font-semibold text-gray-800 sticky left-0 z-10 border-r border-gray-200 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            {activity.name}
                          </td>
                          {MONTH_SHORT.map((_, monthIdx) => (
                            <td key={monthIdx} className="px-1 py-1 text-center border-l border-gray-100">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.accomplishments[monthIdx]}
                                onChange={e => updateGridCell(activity.id, monthIdx, e.target.value)}
                                placeholder="0"
                                className="w-full border border-gray-200 rounded px-1 py-1 text-xs text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                style={{ width: '62px' }}
                              />
                              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                                T: {formatNumber(row.targets[monthIdx])}
                              </div>
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center border-l border-gray-200">
                            <div className="text-xs font-bold text-[#1e3a8a]">{formatNumber(rowTotal)}</div>
                            <div className="text-[10px] text-gray-400 leading-tight">T: {formatNumber(rowTargetTotal)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save All Button */}
              <div className="flex items-center justify-between bg-gray-50 border-t border-gray-200 px-4 py-3">
                <div className="text-sm text-gray-600">
                  {gridActivities.length} activities loaded
                </div>
                <button
                  onClick={handleSaveAccomplishments}
                  disabled={savingAccom}
                  className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-6 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                >
                  {savingAccom ? 'Saving All...' : 'Save All'}
                </button>
              </div>
            </div>
          )}

          {/* No activities state */}
          {gridLoaded && gridActivities.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500 text-sm">No activities found for this department.</p>
            </div>
          )}
        </div>
      )}

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 'overview' && (
        <div>
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
              Select Year & Department
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={overviewYear}
                    onChange={e => setOverviewYear(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={overviewDeptId}
                    onChange={e => setOverviewDeptId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={fetchOverview}
                  disabled={loadingOverview}
                  className="bg-[#1e3a8a] hover:bg-[#1a1a2e] text-white px-6 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                >
                  {loadingOverview ? 'Loading...' : 'Load'}
                </button>
              </div>
            </div>
          </div>

          {overviewError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {overviewError}
            </div>
          )}

          {!overview && !loadingOverview && !overviewError && (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500">Select a year and department, then click "Load" to view the schedule overview.</p>
            </div>
          )}

          {overview && (
            <>
              {/* Legend Note */}
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm">
                <span className="font-semibold">Note:</span> Auto = from submitted reports, Manual = entered directly. Total accomplishment = Auto + Manual combined.
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
                  <div className="text-3xl font-bold text-[#1e3a8a]">{formatNumber(overview.totals.total_target)}</div>
                  <div className="text-sm text-gray-500 mt-1">Total Annual Target</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
                  <div className="text-3xl font-bold text-[#f59e0b]">{formatNumber(overview.totals.total_accomplishment)}</div>
                  <div className="text-sm text-gray-500 mt-1">Total Accomplishment</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Auto: {formatNumber(overview.totals.total_auto_accomplishment)} | Manual: {formatNumber(overview.totals.total_manual_accomplishment)}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-5 text-center">
                  <div className={`text-3xl font-bold ${getPercentageColor(overview.totals.percentage)}`}>
                    {overview.totals.percentage}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Overall Progress</div>
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">{overview.department_name} - {overview.year} Overall</span>
                  <span className={`text-sm font-bold ${getPercentageColor(overview.totals.percentage)}`}>
                    {formatNumber(overview.totals.total_accomplishment)} / {formatNumber(overview.totals.total_target)} ({overview.totals.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor(overview.totals.percentage)} transition-all duration-500`}
                    style={{ width: `${Math.min(overview.totals.percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Per-Activity Breakdown */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
                <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
                  Activity Breakdown - {overview.department_name}
                </div>
                <div className="divide-y divide-gray-100">
                  {overview.activities.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      No activities found for this department
                    </div>
                  ) : (
                    overview.activities.map(activity => {
                      const isExpanded = expandedActivity === activity.activity_id;
                      const hasTarget = activity.annual_target > 0;

                      return (
                        <div key={activity.activity_id}>
                          {/* Activity Row */}
                          <div
                            className="px-4 py-4 cursor-pointer hover:bg-gray-50 transition"
                            onClick={() => setExpandedActivity(isExpanded ? null : activity.activity_id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-800">{activity.activity_name}</span>
                              </div>
                              <div className="text-sm text-right">
                                {hasTarget ? (
                                  <span className={`font-bold ${getPercentageColor(activity.percentage)}`}>
                                    {formatNumber(activity.annual_accomplishment)} / {formatNumber(activity.annual_target)} ({activity.percentage}%)
                                  </span>
                                ) : (
                                  <span className="text-gray-400">No target set</span>
                                )}
                              </div>
                            </div>
                            {hasTarget && (
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor(activity.percentage)} transition-all duration-500`}
                                  style={{ width: `${Math.min(activity.percentage, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Expanded Monthly Breakdown */}
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-gray-100 border-b border-gray-200">
                                      <tr>
                                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Month</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Target</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Auto</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Manual</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Total</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Variance</th>
                                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">%</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {activity.monthly.map((m, i) => {
                                        const variance = m.accomplishment - m.target;
                                        const hasMonthTarget = m.target > 0;
                                        return (
                                          <tr key={m.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-3 py-2 text-sm text-gray-800 font-medium">{m.month_name}</td>
                                            <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatNumber(m.target)}</td>
                                            <td className="px-3 py-2 text-sm text-blue-600 text-right">{formatNumber(m.auto_accomplishment)}</td>
                                            <td className="px-3 py-2 text-sm text-purple-600 text-right">{formatNumber(m.manual_accomplishment)}</td>
                                            <td className="px-3 py-2 text-sm text-gray-800 text-right font-medium">{formatNumber(m.accomplishment)}</td>
                                            <td className={`px-3 py-2 text-sm text-right font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {variance >= 0 ? '+' : ''}{formatNumber(variance)}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              {hasMonthTarget ? (
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getPercentageBg(m.percentage)}`}>
                                                  {m.percentage}%
                                                </span>
                                              ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                      {/* Summary Row */}
                                      <tr className="bg-[#1a1a2e] text-white font-semibold">
                                        <td className="px-3 py-2 text-sm">Annual Total</td>
                                        <td className="px-3 py-2 text-sm text-right">{formatNumber(activity.annual_target)}</td>
                                        <td className="px-3 py-2 text-sm text-right">{formatNumber(activity.annual_auto_accomplishment)}</td>
                                        <td className="px-3 py-2 text-sm text-right">{formatNumber(activity.annual_manual_accomplishment)}</td>
                                        <td className="px-3 py-2 text-sm text-right">{formatNumber(activity.annual_accomplishment)}</td>
                                        <td className="px-3 py-2 text-sm text-right">
                                          {(activity.annual_accomplishment - activity.annual_target) >= 0 ? '+' : ''}
                                          {formatNumber(activity.annual_accomplishment - activity.annual_target)}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-right">{activity.percentage}%</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Grand Summary Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
                <div className="bg-[#1e3a8a] text-white px-4 py-2 font-semibold text-sm">
                  Monthly Summary - All Activities
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50">Month</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Target</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Auto</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Manual</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Total</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Variance</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MONTH_NAMES.map((monthName, i) => {
                        const monthNum = i + 1;
                        let monthTarget = 0;
                        let monthAutoAccom = 0;
                        let monthManualAccom = 0;
                        let monthTotalAccom = 0;
                        overview.activities.forEach(a => {
                          const m = a.monthly.find(mm => mm.month === monthNum);
                          if (m) {
                            monthTarget += m.target;
                            monthAutoAccom += m.auto_accomplishment;
                            monthManualAccom += m.manual_accomplishment;
                            monthTotalAccom += m.accomplishment;
                          }
                        });
                        const variance = monthTotalAccom - monthTarget;
                        const pct = monthTarget > 0 ? parseFloat(((monthTotalAccom / monthTarget) * 100).toFixed(2)) : 0;

                        return (
                          <tr key={monthNum} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-sm text-gray-800 font-medium sticky left-0 bg-inherit">{monthName}</td>
                            <td className="px-3 py-2 text-sm text-gray-600 text-right">{formatNumber(monthTarget)}</td>
                            <td className="px-3 py-2 text-sm text-blue-600 text-right">{formatNumber(monthAutoAccom)}</td>
                            <td className="px-3 py-2 text-sm text-purple-600 text-right">{formatNumber(monthManualAccom)}</td>
                            <td className="px-3 py-2 text-sm text-gray-800 text-right font-medium">{formatNumber(monthTotalAccom)}</td>
                            <td className={`px-3 py-2 text-sm text-right font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {variance >= 0 ? '+' : ''}{formatNumber(variance)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {monthTarget > 0 ? (
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getPercentageBg(pct)}`}>
                                  {pct}%
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Grand Total Row */}
                      <tr className="bg-[#1a1a2e] text-white font-semibold">
                        <td className="px-3 py-2 text-sm sticky left-0 bg-[#1a1a2e]">Grand Total</td>
                        <td className="px-3 py-2 text-sm text-right">{formatNumber(overview.totals.total_target)}</td>
                        <td className="px-3 py-2 text-sm text-right">{formatNumber(overview.totals.total_auto_accomplishment)}</td>
                        <td className="px-3 py-2 text-sm text-right">{formatNumber(overview.totals.total_manual_accomplishment)}</td>
                        <td className="px-3 py-2 text-sm text-right">{formatNumber(overview.totals.total_accomplishment)}</td>
                        <td className="px-3 py-2 text-sm text-right">
                          {(overview.totals.total_accomplishment - overview.totals.total_target) >= 0 ? '+' : ''}
                          {formatNumber(overview.totals.total_accomplishment - overview.totals.total_target)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right">{overview.totals.percentage}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
