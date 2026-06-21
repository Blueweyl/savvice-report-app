import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function NewReport() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const [departments, setDepartments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedDept, setSelectedDept] = useState(user?.department_id || '');
  const [form, setForm] = useState({
    activity_id: '',
    report_date: new Date().toISOString().split('T')[0],
    team: '',
    status_bound: 'on_going',
    activity_description: '',
    location_from: '',
    location_to: '',
    accomplishment: '',
    equipment: '',
    operator_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data));
  }, []);

  useEffect(() => {
    if (selectedDept) {
      api.get(`/departments/${selectedDept}/activities`).then((res) => {
        setActivities(res.data);
        setForm((f) => ({ ...f, activity_id: '' }));
      });
    }
  }, [selectedDept]);

  const deptName = departments.find(d => d.id === parseInt(selectedDept))?.name || '';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/reports', {
        ...form,
        activity_id: parseInt(form.activity_id),
        accomplishment: parseFloat(form.accomplishment) || 0,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-t-lg border border-gray-200 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-900 text-white px-3 py-2 rounded font-bold text-sm tracking-wider">
            SA WICE
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {deptName || 'Department'} Team Weekly Accomplishment Report
            </h2>
            <p className="text-sm text-gray-500 uppercase">
              {deptName ? `${deptName} RM & Corrective - NLEX Operations` : 'Savvice Routine Maintenance'}
            </p>
          </div>
        </div>
        <div className="bg-blue-800 text-white px-4 py-1.5 rounded text-sm font-bold">
          NLEX
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border-x border-gray-200 px-6 py-3 flex items-center gap-2 text-sm text-gray-600">
        <span>💡</span>
        <span>Each submission saves to the <strong>Weekly Report</strong> master sheet and automatically updates the Team's individual sheet.</span>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 border-x border-gray-200 px-6 py-3 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* DATE & SCHEDULE */}
        <div className="border-x border-gray-200">
          <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
            <span>📅</span> DATE & SCHEDULE
          </div>
          <div className="p-6 bg-white grid grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.report_date}
                onChange={(e) => setForm({ ...form, report_date: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                Team <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Select Team —</option>
                <option value="Team 1">Team 1</option>
                <option value="Team 2">Team 2</option>
                <option value="Team 3">Team 3</option>
                <option value="Team 4">Team 4</option>
                <option value="Team 5">Team 5</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                Status / Bound <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mt-1">
                {[
                  { value: 'on_going', label: 'ON GOING', color: 'bg-orange-500' },
                  { value: 'done', label: 'DONE', color: 'bg-green-600' },
                  { value: 'pending', label: 'PENDING', color: 'bg-gray-400' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, status_bound: opt.value })}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                      form.status_bound === opt.value
                        ? `${opt.color} text-white shadow-md`
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVITY & LOCATION */}
        <div className="border-x border-gray-200">
          <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
            <span>🔧</span> ACTIVITY & LOCATION
          </div>
          <div className="p-6 bg-white space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} Department</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                  Activity <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.activity_id}
                  onChange={(e) => setForm({ ...form, activity_id: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!selectedDept}
                >
                  <option value="">{selectedDept ? 'Select Activity' : 'Select department first'}</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.activity_description}
                onChange={(e) => setForm({ ...form, activity_description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Cleaning drainage line canal"
              />
            </div>
            <div>
              <div className="text-center text-xs font-bold text-red-500 mb-2 uppercase flex items-center justify-center gap-1">
                <span>📍</span> Location
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                    From <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.location_from}
                    onChange={(e) => setForm({ ...form, location_from: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Sta Rita Interchange N.B Exit"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
                    To <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.location_to}
                    onChange={(e) => setForm({ ...form, location_to: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Sta Rita Interchange N.B Exit"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ACTUAL ACCOMPLISHMENT & RESOURCES */}
        <div className="border-x border-gray-200">
          <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
            <span>⚙️</span> ACTUAL ACCOMPLISHMENT & RESOURCES
          </div>
          <div className="p-6 bg-white grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs font-bold text-blue-700 mb-0.5 uppercase flex items-center gap-1">
                <span>🏷️</span> Accomplishment
              </div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase">Actual (LN.M)</label>
              <input
                type="number"
                step="0.01"
                value={form.accomplishment}
                onChange={(e) => setForm({ ...form, accomplishment: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-700 mb-0.5 uppercase flex items-center gap-1">
                <span>🚛</span> Equipment
              </div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase">Vehicle / Plate No.</label>
              <input
                type="text"
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. NEX 3565"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-700 mb-0.5 uppercase flex items-center gap-1">
                <span>👤</span> Operator
              </div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase">Operator Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.operator_name}
                onChange={(e) => setForm({ ...form, operator_name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. DEL CASTILLO, EDDIE S."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="border border-gray-200 rounded-b-lg p-6 bg-white flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-8 py-2.5 rounded transition disabled:opacity-50 text-sm uppercase"
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-2.5 rounded transition text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
