import { Link } from 'react-router-dom';

const STATS = [
  { value: '1,601+', label: 'Employees' },
  { value: '23+', label: 'Years of Service' },
  { value: '3', label: 'Departments' },
  { value: '19', label: 'Activity Groups' },
];

export default function Home() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-[#1a1a2e] text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/savvice-logo.png" alt="Savvice" className="h-10 bg-white rounded px-2 py-1" />
            <span className="font-bold text-lg hidden sm:block">Routine Maintenance</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#about" className="text-sm text-gray-300 hover:text-white transition">About</a>
            <a href="#contact" className="text-sm text-gray-300 hover:text-white transition">Contact</a>
            {user ? (
              <Link
                to={user.role === 'admin' ? '/admin' : '/dashboard'}
                className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-4 py-2 rounded text-sm font-bold transition"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-4 py-2 rounded text-sm font-bold transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img src="/savvice-logo.png" alt="Savvice Corporation" className="h-24 mx-auto mb-8 bg-white rounded-xl px-6 py-3" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Routine Maintenance Department
          </h1>
          <p className="text-xl text-gray-300 mb-2">Report Management System</p>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Our team of experts gets the job done well, so you can do yours.
          </p>
          <div className="flex gap-4 justify-center">
            {user ? (
              <Link
                to={user.role === 'admin' ? '/admin' : '/dashboard'}
                className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-8 py-3 rounded-lg font-bold text-lg transition shadow-lg"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="bg-[#f59e0b] hover:bg-[#d97706] text-black px-8 py-3 rounded-lg font-bold text-lg transition shadow-lg"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="border-2 border-white/30 hover:border-white text-white px-8 py-3 rounded-lg font-bold text-lg transition"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-12 px-4 border-b border-gray-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[#1e3a8a]">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1a1a2e] text-center mb-8">About Us</h2>
          <div className="bg-white rounded-xl shadow-md p-8 space-y-4">
            <p className="text-gray-700 leading-relaxed">
              <strong>SAVVICE Corporation</strong> is a solutions provider since 1999 and has been acquired by
              Metro Pacific Tollways Corporation (MPTC) in 2019. With over two decades of service and 1,601+
              employees, we deliver excellence across the Philippines.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Our organization delivers housekeeping services, facilities maintenance, fleet management, traffic
              management, emergency response, roadside assistance, technical and skilled manpower deployment, and
              allied services.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The <strong>Routine Maintenance Department</strong> manages three specialized divisions —
              <strong> Furniture, Bridge, and Roadway</strong> — each handling specific maintenance activities
              to keep our infrastructure safe and operational.
            </p>
          </div>
        </div>
      </section>

      {/* Departments */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1a1a2e] text-center mb-8">Our Departments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-[#1e3a8a]">
              <h3 className="text-xl font-bold text-[#1a1a2e] mb-3">Furniture Department</h3>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>Furniture Drainage Cleaning</li>
                <li>Guardrail Cleaning</li>
                <li>Concrete Barrier Cleaning</li>
                <li>Signage Cleaning</li>
                <li>Vines Removal</li>
                <li>Grass Cutting</li>
                <li>Bougainvillea Maintenance</li>
                <li>Unscheduled Activity</li>
                <li>Furniture Corrective</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-[#f59e0b]">
              <h3 className="text-xl font-bold text-[#1a1a2e] mb-3">Bridge Department</h3>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>Bridge RM Team 1</li>
                <li>Segment 10 Scupper Drain</li>
                <li>Bridge Epoxy</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-[#1e3a8a]">
              <h3 className="text-xl font-bold text-[#1a1a2e] mb-3">Roadway Department</h3>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>Road Sweeping Connector</li>
                <li>Mobile Clean Up Connector</li>
                <li>Road Sweeping IOMAS</li>
                <li>Litter Picking Interchange IOMAS</li>
                <li>Toll Lane Cleaning OIMAS</li>
                <li>Garbage Collection IOMAS</li>
                <li>Litter Picking Mainline OIMAS</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 px-4 bg-[#1a1a2e] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Contact Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="text-2xl mb-2">📍</div>
              <h3 className="font-bold mb-1">Address</h3>
              <p className="text-sm text-gray-400">3rd Floor, 346 BMWC Building, Cagayan Valley Road, Brgy. Sta Rita, Guiguinto, Bulacan, Philippines 3015</p>
            </div>
            <div>
              <div className="text-2xl mb-2">📧</div>
              <h3 className="font-bold mb-1">Email</h3>
              <p className="text-sm text-gray-400">HRrecruitment@savvice.com.ph</p>
            </div>
            <div>
              <div className="text-2xl mb-2">📞</div>
              <h3 className="font-bold mb-1">Phone</h3>
              <p className="text-sm text-gray-400">044 812 2821</p>
              <p className="text-xs text-gray-500 mt-1">Monday - Friday</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#111127] text-gray-500 py-6 px-4 text-center text-sm">
        <p>Savvice Corporation — A Metro Pacific Tollway Company</p>
        <p className="text-xs mt-1">23+ Years of Making a Difference</p>
      </footer>
    </div>
  );
}
