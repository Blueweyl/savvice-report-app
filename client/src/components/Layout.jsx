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
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1
              className="text-xl font-bold cursor-pointer"
              onClick={() => navigate('/')}
            >
              Savvice Routine Maintenance Department
            </h1>
            <p className="text-blue-200 text-sm">Report Management System</p>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-200">
                {user.name} ({user.role}) — {user.department_name}
              </span>
              <button
                onClick={handleLogout}
                className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded text-sm font-medium transition"
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
