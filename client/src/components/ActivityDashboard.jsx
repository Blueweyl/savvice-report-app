import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const CATEGORY_OPTIONS = ["Equipments and PPE's", 'Tools and Accessories'];
const DEPARTMENT_ORDER = ['Furniture', 'Bridge', 'Roadway'];

function computeStatus(qtyRequired, actualQty) {
  if (qtyRequired === '' || actualQty === '' || qtyRequired === null || actualQty === null) return null;
  const req = parseFloat(qtyRequired);
  const act = parseFloat(actualQty);
  if (Number.isNaN(req) || Number.isNaN(act)) return null;
  return act >= req
    ? { label: 'Complete', className: 'bg-green-100 text-green-800 border-green-300' }
    : { label: 'Short', className: 'bg-red-100 text-red-800 border-red-300' };
}

const emptyForm = {
  entry_date: new Date().toISOString().split('T')[0],
  category: CATEGORY_OPTIONS[0],
  item_description: '',
  qty_required: '',
  actual_qty: '',
  remarks: '',
};

export default function ActivityDashboard() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [subTab, setSubTab] = useState('submit');

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

  useEffect(() => {
    api.get('/departments').then(res => {
      const sorted = [...res.data].sort((a, b) => DEPARTMENT_ORDER.indexOf(a.name) - DEPARTMENT_ORDER.indexOf(b.name));
      setDepartments(sorted);
    }).catch(err => console.error('Error loading departments:', err));
  }, []);

  function openDepartment(dept) {
    setSelectedDept(dept);
    setSelectedGroup(null);
    setGroupsLoading(true);
    api.get('/daily-tools/groups', { params: { department_id: dept.id } })
      .then(res => setGroups(res.data))
      .catch(err => console.error('Error loading tool groups:', err))
      .finally(() => setGroupsLoading(false));
  }

  async function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    setAddingGroup(true);
    setGroupError('');
    try {
      const res = await api.post('/daily-tools/groups', { department_id: selectedDept.id, name });
      setGroups(prev => [...prev, res.data]);
      setNewGroupName('');
    } catch (err) {
      setGroupError(err.response?.data?.error || err.message);
    }
    setAddingGroup(false);
  }

  function openGroup(group) {
    setSelectedGroup(group);
    setSubTab('submit');
    setForm(emptyForm);
    setMessage('');
  }

  const loadRecords = useCallback(async () => {
    if (!selectedGroup) return;
    setRecordsLoading(true);
    try {
      const res = await api.get('/daily-tools/entries', { params: { group_id: selectedGroup.id } });
      setRecords(res.data);
    } catch (err) {
      console.error('Error loading records:', err);
    }
    setRecordsLoading(false);
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedGroup && subTab === 'records') {
      loadRecords();
    }
  }, [selectedGroup, subTab, loadRecords]);

  async function submitEntry() {
    if (!form.item_description || form.qty_required === '' || form.actual_qty === '') {
      setMessage('Item Description, Qty Required and Actual Qty are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/daily-tools/entries', {
        group_id: selectedGroup.id,
        entry_date: form.entry_date,
        category: form.category,
        item_description: form.item_description,
        qty_required: parseFloat(form.qty_required) || 0,
        actual_qty: parseFloat(form.actual_qty) || 0,
        remarks: form.remarks,
      });
      setMessage('Entry submitted.');
      setForm({ ...emptyForm, entry_date: form.entry_date, category: form.category });
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  }

  const status = computeStatus(form.qty_required, form.actual_qty);

  // --- Step 1: pick a department ---
  if (!selectedDept) {
    return (
      <div>
        <p className="text-sm text-gray-500 mb-4">Select a department to view its activity groups.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {departments.map(dept => (
            <button
              key={dept.id}
              onClick={() => openDepartment(dept)}
              className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-left hover:border-[#1e3a8a] hover:shadow-md transition"
            >
              <div className="text-lg font-bold text-[#1a1a2e]">{dept.name}</div>
              <div className="text-xs text-gray-400 mt-1">View activity groups</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Step 2: pick a group within the department ---
  if (!selectedGroup) {
    return (
      <div>
        <button
          onClick={() => setSelectedDept(null)}
          className="text-sm text-[#1e3a8a] hover:underline mb-4"
        >
          ← Back to Departments
        </button>
        <h2 className="text-lg font-bold text-[#1a1a2e] mb-4">{selectedDept.name} — Activity Groups</h2>

        <div className="flex flex-wrap items-center gap-2 mb-4 bg-white p-3 rounded-lg border border-gray-200">
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGroup()}
            placeholder={`Add a group for ${selectedDept.name} (e.g. ${selectedDept.name} Segment 1)`}
            className="flex-1 min-w-[220px] border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={addGroup}
            disabled={addingGroup || !newGroupName.trim()}
            className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-4 py-1.5 rounded text-sm font-medium transition disabled:opacity-50"
          >
            {addingGroup ? 'Adding...' : '+ Add Group'}
          </button>
        </div>
        {groupError && <p className="text-red-600 text-sm mb-4">{groupError}</p>}

        {groupsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            No activity groups set up yet for {selectedDept.name}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => openGroup(group)}
                className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 text-left hover:border-[#1e3a8a] hover:shadow-md transition"
              >
                <div className="font-bold text-[#1a1a2e]">{group.name}</div>
                <div className="text-xs text-gray-400 mt-1">Submit Entry / View Records</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Step 3: submit entry / view records for the selected group ---
  return (
    <div>
      <button
        onClick={() => setSelectedGroup(null)}
        className="text-sm text-[#1e3a8a] hover:underline mb-4"
      >
        ← Back to {selectedDept.name} groups
      </button>

      <div className="bg-[#1e3a8a] text-white rounded-t-lg px-6 py-4">
        <h2 className="text-lg font-bold">{selectedGroup.name} Tools</h2>
        <p className="text-xs text-blue-200">Savvice Corporation — A Metro Pacific Tollway Company</p>
      </div>

      <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg shadow-sm">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'submit', label: 'Submit Entry' },
            { key: 'records', label: 'View Records' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                subTab === t.key
                  ? 'border-[#1e3a8a] text-[#1e3a8a]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`mx-6 mt-4 p-3 rounded text-sm font-medium ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {subTab === 'submit' && (
          <div className="p-6 space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
              <input
                type="date"
                value={form.entry_date}
                onChange={e => setForm({ ...form, entry_date: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Item Description *</label>
                <input
                  type="text"
                  value={form.item_description}
                  onChange={e => setForm({ ...form, item_description: e.target.value })}
                  placeholder="e.g. Grass Cutter"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Qty Required *</label>
                <input
                  type="number"
                  min="0"
                  value={form.qty_required}
                  onChange={e => setForm({ ...form, qty_required: e.target.value })}
                  placeholder="e.g. 1"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Actual Qty (1st Shift) *</label>
                <input
                  type="number"
                  min="0"
                  value={form.actual_qty}
                  onChange={e => setForm({ ...form, actual_qty: e.target.value })}
                  placeholder="e.g. 1"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Computed Status</label>
              <span className={`inline-block px-3 py-1 rounded text-xs font-bold border ${status ? status.className : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                {status ? status.label : '—'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Remarks</label>
              <textarea
                value={form.remarks}
                onChange={e => setForm({ ...form, remarks: e.target.value })}
                placeholder="Optional notes (e.g. reason for shortage, condition, etc.)"
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={submitEntry}
              disabled={submitting}
              className="w-full bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white py-3 rounded font-bold transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Entry'}
            </button>
          </div>
        )}

        {subTab === 'records' && (
          <div className="p-6">
            {recordsLoading ? (
              <div className="p-8 text-center text-gray-500">Loading records...</div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No entries submitted yet for {selectedGroup.name}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-center font-medium">Required</th>
                      <th className="px-3 py-2 text-center font-medium">Actual</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Remarks</th>
                      <th className="px-3 py-2 text-left font-medium">Submitted By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, idx) => {
                      const s = computeStatus(r.qty_required, r.actual_qty);
                      return (
                        <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2">{new Date(r.entry_date).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-gray-600">{r.category}</td>
                          <td className="px-3 py-2 font-medium">{r.item_description}</td>
                          <td className="px-3 py-2 text-center">{r.qty_required}</td>
                          <td className="px-3 py-2 text-center">{r.actual_qty}</td>
                          <td className="px-3 py-2 text-center">
                            {s && <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${s.className}`}>{s.label}</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{r.remarks || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.submitted_by_name || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
