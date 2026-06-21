const pool = require('./pool');
const bcrypt = require('bcryptjs');

const DEPARTMENTS = ['Furniture', 'Bridge', 'Roadway'];

const ACTIVITIES = {
  Furniture: [
    'Furniture Drainage Cleaning',
    'Guardrail Cleaning',
    'Concrete Barrier Cleaning',
    'Signage Cleaning',
    'Vines Removal',
    'Grass Cutting',
    'Bougainvillea Maintenance',
    'Unscheduled Activity',
    'Furniture Corrective',
  ],
  Bridge: [
    'Bridge RM Team 1',
    'Segment 10 Scupper Drain',
    'Bridge Epoxy',
  ],
  Roadway: [
    'Road Sweeping Connector',
    'Mobile Clean Up Connector',
    'Road Sweeping IOMAS',
    'Litter Picking Interchange IOMAS',
    'Toll Lane Cleaning OIMAS',
    'Garbage Collection IOMAS',
    'Litter Picking Mainline OIMAS',
  ],
};

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
      UNIQUE(name, department_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
      department_id INTEGER REFERENCES departments(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      department_id INTEGER REFERENCES departments(id),
      activity_id INTEGER REFERENCES activities(id),
      report_date DATE NOT NULL DEFAULT CURRENT_DATE,
      team VARCHAR(100),
      status_bound VARCHAR(20) DEFAULT 'on_going' CHECK (status_bound IN ('on_going', 'done', 'pending')),
      activity_description TEXT,
      location_from VARCHAR(255),
      location_to VARCHAR(255),
      accomplishment DECIMAL(10,2) DEFAULT 0,
      equipment VARCHAR(255),
      operator_name VARCHAR(255),
      crew_names TEXT,
      remarks TEXT,
      photo_before TEXT,
      photo_after TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_comment TEXT,
      reviewed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP
    );
  `);

  const cols = ['report_date', 'team', 'status_bound', 'activity_description', 'location_from', 'location_to', 'accomplishment', 'equipment', 'operator_name', 'crew_names', 'remarks', 'photo_before', 'photo_after'];
  for (const col of cols) {
    try {
      await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS ${col} ${
        col === 'report_date' ? 'DATE DEFAULT CURRENT_DATE' :
        col === 'accomplishment' ? 'DECIMAL(10,2) DEFAULT 0' :
        col === 'status_bound' ? "VARCHAR(20) DEFAULT 'on_going'" :
        col === 'activity_description' ? 'TEXT' :
        col === 'crew_names' ? 'TEXT' :
        col === 'remarks' ? 'TEXT' :
        col === 'photo_before' ? 'TEXT' :
        col === 'photo_after' ? 'TEXT' :
        'VARCHAR(255)'
      }`);
    } catch (e) {}
  }

  try { await pool.query('ALTER TABLE reports ALTER COLUMN title DROP NOT NULL'); } catch (e) {}
  try { await pool.query('ALTER TABLE reports ALTER COLUMN body DROP NOT NULL'); } catch (e) {}

  // Migrate photo columns from VARCHAR(500) to TEXT for base64 storage
  try { await pool.query('ALTER TABLE reports ALTER COLUMN photo_before TYPE TEXT'); } catch (e) {}
  try { await pool.query('ALTER TABLE reports ALTER COLUMN photo_after TYPE TEXT'); } catch (e) {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
      file_url VARCHAR(500) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
  `);

  for (const dept of DEPARTMENTS) {
    const res = await pool.query(
      'INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id',
      [dept]
    );
    const deptId = res.rows[0].id;

    for (const activity of ACTIVITIES[dept]) {
      await pool.query(
        'INSERT INTO activities (name, department_id) VALUES ($1, $2) ON CONFLICT (name, department_id) DO NOTHING',
        [activity, deptId]
      );
    }
  }

  const adminExists = await pool.query("SELECT id FROM users WHERE email = 'admin@savvice.com'");
  if (adminExists.rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, department_id) VALUES ('Admin', 'admin@savvice.com', $1, 'admin', 1)",
      [hash]
    );
    console.log('Admin account created (admin@savvice.com / admin123)');
  }

  console.log('Database initialized successfully!');
}

if (require.main === module) {
  init().then(() => process.exit(0)).catch((err) => {
    console.error('Database initialization failed:', err.message);
    process.exit(1);
  });
}

module.exports = init;
