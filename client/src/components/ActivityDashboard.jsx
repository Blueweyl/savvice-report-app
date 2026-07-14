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

export default function ActivityDashboard() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [subTab, setSubTab] = useState('submit');

  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [sharedRemarks, setSharedRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [openAddItemCategory, setOpenAddItemCategory] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQtyRequired, setNewItemQtyRequired] = useState('');
  const [newItemPhoto, setNewItemPhoto] = useState(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState('');

  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

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
    setSharedRemarks('');
    setMessage('');
  }

  const loadItems = useCallback(async () => {
    if (!selectedGroup) return;
    setItemsLoading(true);
    try {
      const res = await api.get('/daily-tools/entries', { params: { group_id: selectedGroup.id, date: entryDate } });
      setItems(res.data.map(item => ({ ...item, actual_qty: item.actual_qty ?? 0 })));
    } catch (err) {
      console.error('Error loading tool entries:', err);
    }
    setItemsLoading(false);
  }, [selectedGroup, entryDate]);

  useEffect(() => {
    if (selectedGroup && subTab === 'submit') {
      loadItems();
    }
  }, [selectedGroup, subTab, loadItems]);

  const loadRecords = useCallback(async () => {
    if (!selectedGroup) return;
    setRecordsLoading(true);
    try {
      const res = await api.get('/daily-tools/entries/history', { params: { group_id: selectedGroup.id } });
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

  function updateItemQty(itemId, value) {
    setItems(prev => prev.map(i => (i.item_id === itemId ? { ...i, actual_qty: value } : i)));
  }

  async function saveEntries() {
    setSaving(true);
    try {
      const entries = items.map(i => ({
        item_id: i.item_id,
        actual_qty: parseFloat(i.actual_qty) || 0,
        remarks: sharedRemarks,
      }));
      await api.post('/daily-tools/entries', { date: entryDate, entries });
      setMessage('Entries saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
    }
    setSaving(false);
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewItemPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  async function addItem(category) {
    if (!newItemName.trim()) return;
    setAddingItem(true);
    setAddItemError('');
    try {
      const res = await api.post('/daily-tools/items', {
        group_id: selectedGroup.id,
        category,
        item_name: newItemName.trim(),
        qty_required: parseFloat(newItemQtyRequired) || 1,
        photo: newItemPhoto,
      });
      setItems(prev => [...prev, {
        item_id: res.data.id,
        category: res.data.category,
        item_name: res.data.item_name,
        qty_required: res.data.qty_required,
        photo: res.data.photo,
        actual_qty: 0,
        remarks: null,
      }]);
      setNewItemName('');
      setNewItemQtyRequired('');
      setNewItemPhoto(null);
      setOpenAddItemCategory(null);
    } catch (err) {
      setAddItemError(err.response?.data?.error || err.message);
    }
    setAddingItem(false);
  }

  function cancelAddItem() {
    setOpenAddItemCategory(null);
    setNewItemName('');
    setNewItemQtyRequired('');
    setNewItemPhoto(null);
    setAddItemError('');
  }

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
  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const itemsByCategory = CATEGORY_OPTIONS.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat);
    return acc;
  }, {});

  return (
    <div>
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 cursor-zoom-out p-6"
        >
          <img src={lightboxPhoto} alt="Item reference" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}

      <button
        onClick={() => setSelectedGroup(null)}
        className="text-sm text-[#1e3a8a] hover:underline mb-4"
      >
        ← Back to {selectedDept.name} groups
      </button>

      <div className="bg-[#0f1c3f] rounded-t-lg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 rounded-lg w-11 h-11 flex items-center justify-center text-xl shrink-0">
            🔧
          </div>
          <div>
            <h2 className="text-white font-bold text-lg tracking-wide uppercase leading-tight">{selectedGroup.name} Tools</h2>
            <p className="text-amber-400 text-[11px] font-semibold tracking-wide uppercase">Savvice Corporation — A Metro Pacific Tollway Company</p>
          </div>
        </div>
        <div className="text-white text-xs font-medium text-right hidden sm:block">
          {todayFormatted}
        </div>
      </div>

      <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg shadow-sm">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'submit', label: 'Submit Entry', icon: '📄' },
            { key: 'records', label: 'View Records', icon: '📋' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition ${
                subTab === t.key
                  ? 'border-amber-500 text-[#0f1c3f]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`mx-6 mt-4 p-3 rounded text-sm font-medium ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {subTab === 'submit' && (
          <div className="p-6 space-y-5 max-w-2xl">
            <div className="bg-blue-50 border border-blue-100 text-blue-900 text-xs rounded px-4 py-2.5 flex items-center gap-2">
              <span>📍</span>
              <span>Each submission saves to the <strong>{selectedGroup.name} Tools</strong> master log sheet.</span>
            </div>

            <div>
              <div className="bg-[#1e3a8a] text-white text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-t flex items-center gap-2">
                <span>📅</span> Date
              </div>
              <div className="border border-t-0 border-gray-200 rounded-b p-4">
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {itemsLoading ? (
              <div className="p-8 text-center text-gray-500">Loading checklist...</div>
            ) : (
              CATEGORY_OPTIONS.map(cat => (
                <div key={cat}>
                  <div className="bg-[#1e3a8a] text-white text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-t flex items-center gap-2">
                    <span>🏷️</span> {cat}
                  </div>
                  <div className="border border-t-0 border-gray-200 rounded-b p-4 space-y-3">
                    {itemsByCategory[cat].length === 0 && openAddItemCategory !== cat && (
                      <p className="text-xs text-gray-400">No items yet.</p>
                    )}

                    {itemsByCategory[cat].map(item => (
                      <div key={item.item_id} className="border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                        {item.photo && (
                          <img
                            src={item.photo}
                            alt={item.item_name}
                            onClick={() => setLightboxPhoto(item.photo)}
                            className="w-12 h-12 object-cover rounded border border-gray-200 cursor-pointer shrink-0"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-bold text-[#0f1c3f] text-sm uppercase">{item.item_name}</div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mt-2 mb-1">Actual Qty (1st Shift) *</label>
                          <input
                            type="number"
                            min="0"
                            value={item.actual_qty}
                            onChange={e => updateItemQty(item.item_id, e.target.value)}
                            placeholder="e.g. 1"
                            className={`w-full sm:w-40 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              parseFloat(item.actual_qty) < parseFloat(item.qty_required) ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                          />
                        </div>
                      </div>
                    ))}

                    {openAddItemCategory === cat ? (
                      <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
                        <input
                          type="text"
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value)}
                          placeholder="Item name, e.g. Grass Cutter"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="number"
                          min="0"
                          value={newItemQtyRequired}
                          onChange={e => setNewItemQtyRequired(e.target.value)}
                          placeholder="Qty required, e.g. 1"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="flex items-center gap-3">
                          <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-xs" />
                          {newItemPhoto && (
                            <img src={newItemPhoto} alt="Preview" className="w-14 h-14 object-cover rounded border border-gray-200" />
                          )}
                        </div>
                        {addItemError && <p className="text-red-600 text-xs">{addItemError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => addItem(cat)}
                            disabled={addingItem || !newItemName.trim()}
                            className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-4 py-1.5 rounded text-sm font-medium transition disabled:opacity-50"
                          >
                            {addingItem ? 'Adding...' : 'Save Item'}
                          </button>
                          <button onClick={cancelAddItem} className="text-gray-500 text-sm px-3 hover:text-gray-700">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setOpenAddItemCategory(cat)}
                        className="text-xs text-[#1e3a8a] font-bold hover:underline"
                      >
                        + Add Item
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Remarks</label>
              <textarea
                value={sharedRemarks}
                onChange={e => setSharedRemarks(e.target.value)}
                placeholder="Optional notes (e.g. reason for shortage, condition, etc.)"
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={saveEntries}
              disabled={saving || items.length === 0}
              className="w-full bg-[#0f1c3f] hover:bg-[#0f1c3f]/90 text-white py-3 rounded font-bold uppercase tracking-wide transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>📤</span>{saving ? 'Submitting...' : 'Submit Entry'}
            </button>

            <p className="text-right text-[10px] text-gray-400">QMS-SC-F178-Rev01_1224</p>
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
                        <tr key={`${r.entry_date}-${r.item_name}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2">{new Date(r.entry_date).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-gray-600">{r.category}</td>
                          <td className="px-3 py-2 font-medium">{r.item_name}</td>
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
