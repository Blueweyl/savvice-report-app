import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState(''); // 'pending', 'rejected', or 'general'
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setErrorType('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      setError(msg);
      if (msg.includes('pending approval')) {
        setErrorType('pending');
      } else if (msg.includes('rejected')) {
        setErrorType('rejected');
      } else {
        setErrorType('general');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src="/savvice-logo.png" alt="Savvice Corporation" className="h-20 mx-auto mb-4 bg-white rounded-lg px-4 py-2" />
          <h1 className="text-2xl font-bold text-white">
            Routine Maintenance Department
          </h1>
          <p className="text-gray-400 mt-1">Report Management System</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Sign In</h2>

          {error && errorType === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded-lg mb-4 text-sm">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">Account Pending Approval</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {error && errorType === 'rejected' && (
            <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-lg mb-4 text-sm">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <div>
                  <p className="font-semibold">Account Rejected</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {error && errorType === 'general' && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent outline-none"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a8a] hover:bg-[#1e3070] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#1e3a8a] hover:underline font-medium">
              Register here
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">A Metro Pacific Tollway Company</p>
      </div>
    </div>
  );
}
