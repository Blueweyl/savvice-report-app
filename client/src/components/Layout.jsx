import { useNavigate } from 'react-router-dom';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1a1a2e] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <img src="/savvice-logo.png" alt="Savvice" className="h-10 bg-white rounded px-2 py-1" />
            <div>
              <h1 className="text-lg font-bold">Routine Maintenance Department</h1>
              <p className="text-gray-400 text-xs">Report Management System</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300">
                {user.name} ({user.role}) — {user.department_name}
              </span>
              <button
                onClick={handleLogout}
                className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-4 py-2 rounded text-sm font-bold transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
