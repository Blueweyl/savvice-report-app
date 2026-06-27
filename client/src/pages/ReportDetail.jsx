import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';

const STATUS_BOUND_LABELS = {
  on_going: { label: 'ON GOING', color: 'bg-orange-500 text-white' },
  done: { label: 'DONE', color: 'bg-green-600 text-white' },
  pending: { label: 'PENDING', color: 'bg-gray-400 text-white' },
};

const API_BASE = import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`;

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ status: '', admin_comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Admin controls state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');

  useEffect(() => {
    api.get(`/reports/${id}`).then((res) => {
      setReport(res.data);
      setLoading(false);
    }).catch(() => {
      navigate('/');
    });
  }, [id, navigate]);

  // Load departments when entering edit mode
  useEffect(() => {
    if (editMode) {
      api.get('/departments').then((res) => setDepartments(res.data));
    }
  }, [editMode]);

  // Load activities when department changes in edit mode
  useEffect(() => {
    if (selectedDept) {
      api.get(`/departments/${selectedDept}/activities`).then((res) => setActivities(res.data));
    }
  }, [selectedDept]);

  function enterEditMode() {
    setEditForm({
      activity_id: report.activity_id || '',
      report_date: report.report_date ? report.report_date.split('T')[0] : '',
      team: report.team || '',
      status_bound: report.status_bound || 'on_going',
      activity_description: report.activity_description || '',
      location_from: report.location_from || '',
      location_to: report.location_to || '',
      accomplishment: report.accomplishment || '',
      equipment: report.equipment || '',
      operator_name: report.operator_name || '',
      crew_names: report.crew_names || '',
      remarks: report.remarks || '',
    });
    setSelectedDept(report.department_id || '');
    setEditMode(true);
    setError('');
  }

  function cancelEdit() {
    setEditMode(false);
    setError('');
  }

  async function saveEdit() {
    setEditLoading(true);
    setError('');
    try {
      const { data } = await api.patch(`/reports/${id}`, editForm);
      setReport(data);
      setEditMode(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (newStatus === report.status) return;
    const confirmMsg = newStatus === 'pending'
      ? 'Set this report back to Pending? This will clear any review data.'
      : `Change status to ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}?`;
    if (!window.confirm(confirmMsg)) return;

    setStatusLoading(true);
    setError('');
    try {
      const { data } = await api.patch(`/reports/${id}/status`, { status: newStatus });
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change status');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/reports/${id}`);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete report');
      setDeleteLoading(false);
    }
  }

  async function handleReview(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data } = await api.patch(`/reports/${id}/review`, reviewForm);
      setReport({ ...report, ...data });
      setReviewForm({ status: '', admin_comment: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Review failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading report...</div>;
  }

  if (!report) return null;

  const sb = STATUS_BOUND_LABELS[report.status_bound] || STATUS_BOUND_LABELS.pending;
  const isAdmin = user?.role === 'admin';

  // Input class for edit mode
  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        &larr; Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-t-lg border border-gray-200 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/savvice-logo.png" alt="Savvice" className="h-10" />
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {report.department_name} Team Accomplishment Report
            </h2>
            <p className="text-sm text-gray-500">Submitted by {report.author_name}</p>
          </div>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 text-red-600 border-x border-gray-200 px-6 py-3 text-sm">{error}</div>
      )}

      {/* Admin Controls Bar */}
      {isAdmin && !editMode && (
        <div className="bg-gray-50 border-x border-gray-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status change buttons */}
            <span className="text-xs font-bold text-gray-500 uppercase mr-1">Status:</span>
            <button
              onClick={() => handleStatusChange('pending')}
              disabled={statusLoading || report.status === 'pending'}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                report.status === 'pending'
                  ? 'bg-yellow-500 text-white cursor-default ring-2 ring-yellow-300'
                  : 'bg-white text-yellow-700 border border-yellow-400 hover:bg-yellow-50'
              } disabled:opacity-60`}
            >
              Pending
            </button>
            <button
              onClick={() => handleStatusChange('approved')}
              disabled={statusLoading || report.status === 'approved'}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                report.status === 'approved'
                  ? 'bg-green-600 text-white cursor-default ring-2 ring-green-300'
                  : 'bg-white text-green-700 border border-green-400 hover:bg-green-50'
              } disabled:opacity-60`}
            >
              Approved
            </button>
            <button
              onClick={() => handleStatusChange('rejected')}
              disabled={statusLoading || report.status === 'rejected'}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                report.status === 'rejected'
                  ? 'bg-red-600 text-white cursor-default ring-2 ring-red-300'
                  : 'bg-white text-red-700 border border-red-400 hover:bg-red-50'
              } disabled:opacity-60`}
            >
              Rejected
            </button>

            <div className="ml-auto flex gap-2">
              {/* Edit button */}
              <button
                onClick={enterEditMode}
                className="inline-flex items-center gap-1.5 bg-[#1e3a8a] hover:bg-[#1a1a2e] text-white px-4 py-1.5 rounded text-xs font-bold transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Report
              </button>

              {/* Delete button - shown for rejected reports */}
              {report.status === 'rejected' && (
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-xs font-bold transition disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {deleteLoading ? 'Deleting...' : 'Delete Report'}
                </button>
              )}
            </div>
          </div>
          {statusLoading && <p className="text-xs text-gray-500 mt-2">Updating status...</p>}
        </div>
      )}

      {/* Edit mode save/cancel bar */}
      {editMode && (
        <div className="bg-amber-50 border-x border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-amber-800">Editing report - modify fields below</span>
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="px-4 py-1.5 rounded text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={editLoading}
              className="px-4 py-1.5 rounded text-xs font-bold bg-[#1e3a8a] text-white hover:bg-[#1a1a2e] transition disabled:opacity-50"
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* DATE & SCHEDULE */}
      <div className="border-x border-gray-200">
        <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
          <span>📅</span> DATE & SCHEDULE
        </div>
        <div className="p-6 bg-white grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
            {editMode ? (
              <input type="date" value={editForm.report_date}
                onChange={(e) => setEditForm({ ...editForm, report_date: e.target.value })}
                className={inputClass} />
            ) : (
              <p className="text-sm text-gray-800">{report.report_date ? new Date(report.report_date).toLocaleDateString() : '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team</label>
            {editMode ? (
              <input type="text" value={editForm.team}
                onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                className={inputClass} placeholder="Team name" />
            ) : (
              <p className="text-sm text-gray-800">{report.team || '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status / Bound</label>
            {editMode ? (
              <div className="flex gap-2">
                {[
                  { value: 'on_going', label: 'ON GOING', color: 'bg-orange-500' },
                  { value: 'done', label: 'DONE', color: 'bg-green-600' },
                  { value: 'pending', label: 'PENDING', color: 'bg-gray-400' },
                ].map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => setEditForm({ ...editForm, status_bound: opt.value })}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                      editForm.status_bound === opt.value
                        ? `${opt.color} text-white shadow-md`
                        : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className={`px-3 py-1 rounded text-xs font-bold ${sb.color}`}>{sb.label}</span>
            )}
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
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Activity</label>
              {editMode ? (
                <div className="space-y-2">
                  <select value={selectedDept}
                    onChange={(e) => { setSelectedDept(e.target.value); setEditForm({ ...editForm, activity_id: '' }); }}
                    className={inputClass}>
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} Department</option>
                    ))}
                  </select>
                  <select value={editForm.activity_id}
                    onChange={(e) => setEditForm({ ...editForm, activity_id: e.target.value })}
                    className={inputClass} disabled={!selectedDept}>
                    <option value="">{selectedDept ? 'Select Activity' : 'Select department first'}</option>
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-gray-800">{report.activity_name}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
              {editMode ? (
                <input type="text" value={editForm.activity_description}
                  onChange={(e) => setEditForm({ ...editForm, activity_description: e.target.value })}
                  className={inputClass} placeholder="Activity description" />
              ) : (
                <p className="text-sm text-gray-800">{report.activity_description || '—'}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location From</label>
              {editMode ? (
                <input type="text" value={editForm.location_from}
                  onChange={(e) => setEditForm({ ...editForm, location_from: e.target.value })}
                  className={inputClass} placeholder="Location from" />
              ) : (
                <p className="text-sm text-gray-800">{report.location_from || '—'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location To</label>
              {editMode ? (
                <input type="text" value={editForm.location_to}
                  onChange={(e) => setEditForm({ ...editForm, location_to: e.target.value })}
                  className={inputClass} placeholder="Location to" />
              ) : (
                <p className="text-sm text-gray-800">{report.location_to || '—'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACCOMPLISHMENT & RESOURCES */}
      <div className="border-x border-gray-200">
        <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
          <span>⚙️</span> ACTUAL ACCOMPLISHMENT & RESOURCES
        </div>
        <div className="p-6 bg-white grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Accomplishment (LN.M)</label>
            {editMode ? (
              <input type="number" step="0.01" value={editForm.accomplishment}
                onChange={(e) => setEditForm({ ...editForm, accomplishment: e.target.value })}
                className={inputClass} placeholder="0.00" />
            ) : (
              <p className="text-sm text-gray-800">{report.accomplishment || '0.00'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Equipment / Vehicle</label>
            {editMode ? (
              <input type="text" value={editForm.equipment}
                onChange={(e) => setEditForm({ ...editForm, equipment: e.target.value })}
                className={inputClass} placeholder="Equipment / Vehicle" />
            ) : (
              <p className="text-sm text-gray-800">{report.equipment || '—'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Operator Name</label>
            {editMode ? (
              <input type="text" value={editForm.operator_name}
                onChange={(e) => setEditForm({ ...editForm, operator_name: e.target.value })}
                className={inputClass} placeholder="Operator name" />
            ) : (
              <p className="text-sm text-gray-800">{report.operator_name || '—'}</p>
            )}
          </div>
        </div>
      </div>

      {/* MANPOWER + CREW NAMES */}
      {(report.crew_names || report.remarks || editMode) && (
        <div className="border-x border-gray-200">
          <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
            <span>👥</span> MANPOWER + CREW NAMES
          </div>
          <div className="p-6 bg-white grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Crew Names</label>
              {editMode ? (
                <textarea rows={5} value={editForm.crew_names}
                  onChange={(e) => setEditForm({ ...editForm, crew_names: e.target.value })}
                  className={`${inputClass} resize-vertical`} placeholder="Crew names" />
              ) : (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.crew_names || '—'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks</label>
              {editMode ? (
                <textarea rows={5} value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  className={`${inputClass} resize-vertical`} placeholder="Remarks" />
              ) : (
                <p className="text-sm text-gray-800">{report.remarks || '—'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BEFORE & AFTER PHOTOS */}
      {(report.photo_before || report.photo_after) && (
        <div className="border-x border-gray-200">
          <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
            <span>📷</span> BEFORE & AFTER PHOTOS
          </div>
          <div className="p-6 bg-white grid grid-cols-2 gap-6">
            <div className="text-center">
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">Before</p>
              {report.photo_before ? (
                <img src={`${API_BASE}/api/reports/${report.id}/photo/before?token=${token}`}
                  alt="Before" className="rounded-lg border border-gray-200 max-h-64 mx-auto object-contain" />
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-gray-400 text-sm">No photo</div>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">After</p>
              {report.photo_after ? (
                <img src={`${API_BASE}/api/reports/${report.id}/photo/after?token=${token}`}
                  alt="After" className="rounded-lg border border-gray-200 max-h-64 mx-auto object-contain" />
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-gray-400 text-sm">No photo</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Comment */}
      {report.admin_comment && (
        <div className="border-x border-gray-200">
          <div className="bg-gray-700 text-white px-6 py-3 font-bold text-sm">Admin Review</div>
          <div className="p-6 bg-white">
            <p className="text-sm text-gray-700">{report.admin_comment}</p>
            {report.reviewer_name && (
              <p className="text-xs text-gray-500 mt-2">
                Reviewed by {report.reviewer_name} on {new Date(report.reviewed_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="border-x border-b border-gray-200 rounded-b-lg" />

      {/* Edit mode bottom save/cancel */}
      {editMode && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={cancelEdit}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={saveEdit}
            disabled={editLoading}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[#1e3a8a] text-white hover:bg-[#1a1a2e] transition disabled:opacity-50"
          >
            {editLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Review Form - shown for pending reports when admin and NOT in edit mode */}
      {isAdmin && report.status === 'pending' && !editMode && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Review This Report</h3>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleReview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="approved"
                    checked={reviewForm.status === 'approved'}
                    onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  />
                  <span className="text-sm text-green-700 font-medium">Approve</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="rejected"
                    checked={reviewForm.status === 'rejected'}
                    onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  />
                  <span className="text-sm text-red-700 font-medium">Reject</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
              <textarea
                rows={3}
                value={reviewForm.admin_comment}
                onChange={(e) => setReviewForm({ ...reviewForm, admin_comment: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-vertical text-sm"
                placeholder="Add a comment for the employee..."
              />
            </div>

            <button
              type="submit"
              disabled={!reviewForm.status || submitting}
              className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-6 py-2.5 rounded transition disabled:opacity-50 text-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
