import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';

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

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        &larr; Back
      </button>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{report.title}</h2>
          <StatusBadge status={report.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <span className="text-gray-500">Submitted by:</span>
            <span className="ml-2 text-gray-800 font-medium">{report.author_name}</span>
          </div>
          <div>
            <span className="text-gray-500">Date:</span>
            <span className="ml-2 text-gray-800">{new Date(report.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Department:</span>
            <span className="ml-2 text-gray-800">{report.department_name}</span>
          </div>
          <div>
            <span className="text-gray-500">Activity:</span>
            <span className="ml-2 text-gray-800">{report.activity_name}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Report Details</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{report.body}</p>
        </div>

        {report.admin_comment && (
          <div className="border-t border-gray-100 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Admin Comment</h3>
            <p className="text-gray-700">{report.admin_comment}</p>
            {report.reviewer_name && (
              <p className="text-sm text-gray-500 mt-2">
                Reviewed by {report.reviewer_name} on{' '}
                {new Date(report.reviewed_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {user?.role === 'admin' && report.status === 'pending' && (
        <div className="bg-white rounded-lg shadow-md p-6">
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
                    className="text-green-600"
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
                    className="text-red-600"
                  />
                  <span className="text-sm text-red-700 font-medium">Reject</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comment (optional)
              </label>
              <textarea
                rows={3}
                value={reviewForm.admin_comment}
                onChange={(e) => setReviewForm({ ...reviewForm, admin_comment: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-vertical"
                placeholder="Add a comment for the employee..."
              />
            </div>

            <button
              type="submit"
              disabled={!reviewForm.status || submitting}
              className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
