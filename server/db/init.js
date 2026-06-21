const pool = require('./pool');

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
  try {
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
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        admin_comment TEXT,
        reviewed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP
      );
    `);

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

    console.log('Database initialized successfully!');
    console.log('Departments and activities seeded.');
    process.exit(0);
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    process.exit(1);
  }
}

init();
