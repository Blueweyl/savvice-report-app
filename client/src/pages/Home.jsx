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
      <section className="relative text-white py-24 px-4 bg-cover bg-center" style={{ backgroundImage: "url('/hero-bg.jpg')" }}>
        <div className="absolute inset-0 bg-[#1a1a2e]/80" />
        <div className="relative max-w-4xl mx-auto text-center">
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
          <h2 className="text-3xl font-bold text-[#1a1a2e] text-center mb-8">The Story of Jinky Quismundo Llagas</h2>
          <div className="bg-white rounded-xl shadow-md p-8 space-y-4">
            <p className="text-gray-700 leading-relaxed">
              <strong>Jinky Quismundo Llagas</strong> is a remarkable woman whose life is defined by resilience, sacrifice, and an unwavering commitment to her family. She is a mother who dreams not only for herself but also for the future of the people she loves most. Every day, she wakes up with a purpose—to provide a better life for her family and to create opportunities that will help them achieve their own dreams. Her journey has been filled with challenges, but she has never allowed difficulties to stop her from moving forward. Instead, she has turned every obstacle into a stepping stone toward success.
            </p>
            <p className="text-gray-700 leading-relaxed">
              As a <strong>Routine Management Supervisor at Savvice</strong>, Jinky plays a vital role in ensuring that operations run smoothly and efficiently. Her position requires leadership, dedication, and the ability to make important decisions under pressure. Despite the demands of her work, she remains committed to her responsibilities as a mother. She skillfully balances her professional duties with the needs of her family, often placing the well-being of her loved ones above her own comfort. The long hours, endless responsibilities, and daily pressures are challenges she faces with courage and determination.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Behind her professional achievements lies the heart of a devoted mother. There are countless moments when she sacrifices rest, personal time, and even her own needs to ensure that her family is cared for and supported. She understands that success is not merely about reaching personal goals but about lifting her family toward a brighter future. Her children serve as her inspiration, giving her the strength to continue even during the most difficult days. Their dreams have become her dreams, and their future remains her greatest motivation.
            </p>
            <p className="text-gray-700 leading-relaxed">
              There are days when exhaustion threatens to overwhelm her and nights when worries quietly fill her thoughts. Yet she continues to rise each morning with renewed determination. She believes that every sacrifice made today will eventually lead to a better tomorrow. Through hard work, perseverance, and faith, she has learned to overcome life's uncertainties while remaining focused on her goals. Her story is one of quiet strength—a woman who continues to fight for her family despite the challenges she faces.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Jinky Quismundo Llagas</strong> is more than a supervisor and more than a mother; she is a symbol of perseverance and hope. Her life reflects the courage of a woman who refuses to give up, no matter how difficult the journey becomes. She continues to inspire those around her through her dedication, humility, and unwavering love for her family. Every achievement she earns is a testament to her hard work and sacrifice. As she moves forward in life, she carries with her a dream of providing security, happiness, and endless opportunities for her family. Her story reminds us that true success is not measured by titles or accomplishments alone, but by the lives we touch and the sacrifices we make for the people we love.
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
