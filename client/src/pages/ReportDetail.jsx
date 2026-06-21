import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';

const STATUS_BOUND_LABELS = {
  on_going: { label: 'ON GOING', color: 'bg-orange-500 text-white' },
  done: { label: 'DONE', color: 'bg-green-600 text-white' },
  pending: { label: 'PENDING', color: 'bg-gray-400 text-white' },
};

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ status: '', admin_comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/reports/${id}`).then((res) => {
      setReport(res.data);
      setLoading(false);
    }).catch(() => {
      navigate('/');
    });
  }, [id, navigate]);

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
          <div className="bg-blue-900 text-white px-3 py-2 rounded font-bold text-sm tracking-wider">SA WICE</div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {report.department_name} Team Accomplishment Report
            </h2>
            <p className="text-sm text-gray-500">Submitted by {report.author_name}</p>
          </div>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {/* DATE & SCHEDULE */}
      <div className="border-x border-gray-200">
        <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
          <span>📅</span> DATE & SCHEDULE
        </div>
        <div className="p-6 bg-white grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
            <p className="text-sm text-gray-800">{report.report_date ? new Date(report.report_date).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team</label>
            <p className="text-sm text-gray-800">{report.team || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status / Bound</label>
            <span className={`px-3 py-1 rounded text-xs font-bold ${sb.color}`}>{sb.label}</span>
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
              <p className="text-sm text-gray-800">{report.activity_name}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
              <p className="text-sm text-gray-800">{report.activity_description || '—'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">📍 Location From</label>
              <p className="text-sm text-gray-800">{report.location_from || '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">📍 Location To</label>
              <p className="text-sm text-gray-800">{report.location_to || '—'}</p>
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
            <p className="text-sm text-gray-800">{report.accomplishment || '0.00'}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Equipment / Vehicle</label>
            <p className="text-sm text-gray-800">{report.equipment || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Operator Name</label>
            <p className="text-sm text-gray-800">{report.operator_name || '—'}</p>
          </div>
        </div>
      </div>

      {/* MANPOWER + CREW NAMES */}
      {(report.crew_names || report.remarks) && (
        <div className="border-x border-gray-200">
          <div className="bg-blue-800 text-white px-6 py-3 font-bold text-sm flex items-center gap-2">
            <span>👥</span> MANPOWER + CREW NAMES
          </div>
          <div className="p-6 bg-white grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Crew Names</label>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.crew_names || '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks</label>
              <p className="text-sm text-gray-800">{report.remarks || '—'}</p>
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
                <img src={`${import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`}/uploads/${report.photo_before}`}
                  alt="Before" className="rounded-lg border border-gray-200 max-h-64 mx-auto object-contain" />
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-gray-400 text-sm">No photo</div>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">After</p>
              {report.photo_after ? (
                <img src={`${import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`}/uploads/${report.photo_after}`}
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

      {/* Review Form */}
      {user?.role === 'admin' && report.status === 'pending' && (
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
