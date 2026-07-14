const pool = require('./pool');
const bcrypt = require('bcryptjs');

const DEPARTMENTS = ['Furniture', 'Bridge', 'Roadway'];

const MANPOWER_SEED = [
  ['11566','ABOY, AARON R.','RELIEVER - OPERATOR','RELIEVER'],
  ['10134','ALCORIZA, DOMINADOR H.','IOMAS CREW','FURNITURE 3'],
  ['9991','ALCORIZA, IGNACIO JR. C.','IOMAS CREW','BRIDGE RM'],
  ['11385','ALIGATO JR, DANILO F.','IOMAS CREW','MOBILE CLEAN UP'],
  ['10001','ANGELO, ALVIN G.','IOMAS CREW','BRIDGE RM'],
  ['11386','AQUINO, JEFFREY P.','IOMAS CREW','FURNITURE 1'],
  ['11040','AQUINO, R-JAY JOHN C.','IOMAS CREW','EPOXY 1'],
  ['10616','ARSENIO, MICHAEL B.','IOMAS CREW','TLC 2'],
  ['10003','BALAGAO, ARTCHIE L.','IOMAS SKILLED','BRIDGE RM'],
  ['9983','BALMEO, ABRAHAM P.','IOMAS CREW','BRIDGE RM'],
  ['10136','BALUYUT, JODAN C.','IOMAS CREW','TLC 2'],
  ['9849','BALVERDE, BOB BRYAN N.','LEADMAN/OPERATOR','SWEEPER'],
  ['11176','BAYLON, JUSTINE GREGG F.','SKILLED','BRIDGE RM'],
  ['11406','BERNARDO, JOHN CHRISTIAN R.','IOMAS CREW','BRIDGE RM'],
  ['10723','BILLONES, JUSTIN B.','IOMAS SKILLED','BRIDGE RM'],
  ['9995','BLANZA, JOVEN B.','IOMAS CREW','BRIDGE RM'],
  ['11349','BOLOT, PATRICK JOHN D.','IOMAS CREW','FURNITURE 3'],
  ['11009','BUGHAO, KLENT M.','IOMAS CREW','SWEEPER'],
  ['10212','BUTIONG, GLENN A.','LEADMAN/DRIVER','BRIDGE RM'],
  ['10009','CABUNAG, IVAN P.','IOMAS CREW','EPOXY 2'],
  ['10079','CAMITAN, ROLDAN R.','LEADMAN/DRIVER','FURNITURE 2'],
  ['9997','CAMUA, ERRIS A.','IOMAS CREW','FURNITURE 3'],
  ['11350','CANDELARIA, RICHARD S.','IOMAS CREW','BRIDGE RM'],
  ['11071','CASTILLO, RICHMOND M.','IOMAS CREW','FURNITURE CONNECTOR'],
  ['10073','CASTRO, NOEL D.','LEADMAN/DRIVER','TLC 2'],
  ['10004','CASTRO, SATURNINO S.','IOMAS CREW','FURNITURE CONNECTOR'],
  ['10538','CIERVO, EDGAR G.','IOMAS CREW','FURNITURE 3'],
  ['9977','COLLADO, JOEY V.','IOMAS CREW','TCC'],
  ['11347','COSICO, MARLON A.','IOMAS CREW','FURNITURE CORRECTIVE'],
  ['10721','DE GUZMAN, MARK JOSEPH F.','IOMAS CREW','EPOXY 1'],
  ['11357','DE MESA, GLEN JORICK M.','SKILLED','BRIDGE RM'],
  ['10068','DEL CASTILLO, EDDIE S.','LEADMAN/DRIVER','FURNITURE 3'],
  ['9994','DELA CRUZ, ARIEL A.','IOMAS CREW','TLC 1'],
  ['11131','DELA CRUZ, EDBRYAN P.','IOMAS CREW','EPOXY 1'],
  ['9974','DELA CRUZ, GARY M.','IOMAS CREW','FURNITURE 1'],
  ['11383','DIAZ, JAMES BARRON O.','IOMAS CREW','BRIDGE RM'],
  ['10670','DIONISIO, RAYMOND C.','IOMAS CREW','SWEEPER'],
  ['10045','DORDULO, ELMER M.','IOMAS SKILLED','EPOXY 1'],
  ['11642','DUNGCA, MARK IAN T.','IOMAS CREW','EPOXY 1'],
  ['9968','ENRIQUEZ, AJ D.','IOMAS CREW','EPOXY 2'],
  ['11293','ENRIQUEZ, IAN T.','IOMAS CREW','BRIDGE RM'],
  ['10066','ESGUERRA, JO-AR NICO A.','IOMAS CREW','FURNITURE 3'],
  ['11075','EUSEBIO, ALDRINO S.','IOMAS CREW','MOBILE CLEAN UP'],
  ['11387','FACTO, EMELIO F.','IOMAS CREW','TLC 2'],
  ['10876','FAUSTINO, BENJAMIN P., JR.','IOMAS CREW','TLC 3'],
  ['9969','FAUSTINO, ROLANDO G.','IOMAS CREW','BRIDGE RM'],
  ['11215','FAUSTINO, ROWEL R.','SKILLED','FURNITURE CONNECTOR'],
  ['11001','FELIZARDO, CHRISTIAN V.','LEADMAN/DRIVER','FURNITURE CONNECTOR'],
  ['11500','GABITANAN, MARLON P.','IOMAS CREW','BRIDGE RM'],
  ['11501','GALANG, ALVIN G.','IOMAS SKILLED','BRIDGE RM'],
  ['11502','GARSOTA, JOMARK M.','SWEEPER CREW','SWEEPER'],
  ['11503','GUTIERREZ, RICKY D.','IOMAS CREW','BRIDGE RM'],
  ['11504','LEAL, BARCELONE P.','IOMAS CREW','BRIDGE RM'],
  ['11505','LEONCIO, MARTIN S.','IOMAS CREW','BRIDGE RM'],
  ['11506','LLAGAS, JINKY Q.','ADMIN. ASSISTANT','ADMIN'],
  ['11507','LOZANO, EDWIN S.','IOMAS SKILLED','BRIDGE RM'],
  ['11508','MACASINAG, JUNITO L.','IOMAS CREW','BRIDGE RM'],
  ['11509','MANALO, MARK EUGENE E.','IOMAS CREW','BRIDGE RM'],
  ['11510','MANESE, JOHNRY C.','IOMAS CREW','BRIDGE RM'],
  ['11511','MANGURALE, DENDEL L.','IOMAS CREW','BRIDGE RM'],
  ['11512','MAÑO, JOSEPH S.','SWEEPER CREW','SWEEPER'],
  ['11513','MARCELO, JAMITO S., JR.','LEADMAN/DRIVER','FURNITURE 2'],
  ['11514','MARIÑAS, ALVIN R.','IOMAS CREW','BRIDGE RM'],
  ['11515','MARTIN, RICHARD ANDREW B.','LEADMAN/DRIVER','TLC 1'],
  ['11516','MARTINEZ, CEDERICK A.','LEADMAN/DRIVER','TLC 3'],
  ['11517','MENDOZA, JINGWEL','IOMAS CREW','BRIDGE RM'],
  ['11518','MIRANDA, ALLAN P.','LEADMAN/DRIVER','BRIDGE RM'],
  ['11519','MIRANDA, ROCKY B.','IOMAS CREW','BRIDGE RM'],
  ['11520','MORADA, JOHN KENNEDY J.','LEADMAN/OPERATOR','SWEEPER'],
  ['11521','NARCISO, JOEY V.','LEADMAN/OPERATOR','SWEEPER'],
  ['11522','NUESCA, MARVIN P.','IOMAS CREW','BRIDGE RM'],
  ['11523','OCCIDENTAL, JAYPEE T.','IOMAS CREW','BRIDGE RM'],
  ['11524','ONIDO, MEL JOHN B.','IOMAS CREW','BRIDGE RM'],
  ['11525','ORTILLO, EDGAR A.','IOMAS CREW','BRIDGE RM'],
  ['11526','ORTIZ, RONALD T., JR.','IOMAS CREW','BRIDGE RM'],
  ['11527','PANGILINAN, EROLL M.','IOMAS CREW','BRIDGE RM'],
  ['11528','PEDRA, RONILO A.','OPERATOR','SWEEPER'],
  ['11529','PERALTA, TEOFILO E.','IOMAS CREW','FURNITURE 1'],
  ['11530','PINGOL, REYMOND N.','IOMAS CREW','BRIDGE RM'],
  ['11531','POLANGCOS, EDYN L.','OPERATOR','SWEEPER'],
  ['11532','QUILAO, JOANNER ROYCE R.','IOMAS CREW','BRIDGE RM'],
  ['11533','RIVERA, GILBERT O.','IOMAS SKILLED','BRIDGE RM'],
  ['11534','ROBLE, JEROME G.','SKILLED','BRIDGE RM'],
  ['11535','ROTAMULA, VOLTAIRE O.','IOMAS CREW','BRIDGE RM'],
  ['11536','SAN MIGUEL, RONNIEL C.','IOMAS CREW','BRIDGE RM'],
  ['11537','SANCHEZ, JOHN ALEX S.','IOMAS CREW','BRIDGE RM'],
  ['11538','SANDIL, JOHN MICHAEL D.','IOMAS CREW','BRIDGE RM'],
  ['11539','SANTIAGO, EMMANUEL E.','IOMAS CREW','BRIDGE RM'],
  ['11540','SANTIAGO, MARK NIÑO F.','IOMAS CREW','BRIDGE RM'],
  ['11541','SANTIAGO, RICHARD A.','IOMAS CREW','BRIDGE RM'],
  ['11542','SANTOS, FERWYN L.','IOMAS CREW','BRIDGE RM'],
  ['11543','SEBASTIAN, JUNE','LEADMAN/DRIVER','BRIDGE RM'],
  ['11544','SEBUC, CRISOSTOMO G.','IOMAS CREW','BRIDGE RM'],
  ['11545','SIERRA, JOMAR B.','IOMAS CREW','BRIDGE RM'],
  ['11546','SILUNGAN, CRISTOPHER B.','LEADMAN/OPERATOR','SWEEPER'],
  ['11547','TANJECO, PIJAY C.','LEADMAN/DRIVER','TLC 1'],
  ['11548','TANJOCO, MARCIANO C.','LEADMAN/DRIVER','TLC 2'],
  ['11549','TAYCO, JOSHUA ANDREI A.','IOMAS CREW','BRIDGE RM'],
  ['11550','TENDIDO, ARVIE E.','IOMAS CREW','BRIDGE RM'],
  ['11551','VELASCO, ROMEO P.','IOMAS CREW','BRIDGE RM'],
  ['11552','VILLAGRACIA, ERNESTO S.','SWEEPER CREW','SWEEPER'],
  ['11553','NEWELL GATCHALIAN','SUPERVISOR','ADMIN'],
];

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

// Activity Dashboard tool groups, nested under a department. More will be added per department over time.
const TOOL_GROUPS_SEED = [
  ['Bridge', 'Bridge Mainline'],
  ['Bridge', 'Bridge RM Elevated'],
  ['Bridge', 'Bridge Epoxy 1'],
  ['Bridge', 'Bridge Epoxy 2'],
];

// Catalog items per group: [groupName, category, itemName, qtyRequired]
const TOOL_ITEMS_SEED = [
  ['Bridge Mainline', 'Tools and Accessories', 'Grass Cutter', 1],
  ['Bridge Mainline', 'Tools and Accessories', 'Pressure Washer', 1],
];

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

  // Add account_status column for registration approval system
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'pending' CHECK (account_status IN ('pending', 'approved', 'rejected'))");
  } catch (e) {}
  // Ensure existing admin account is approved
  try {
    await pool.query("UPDATE users SET account_status = 'approved' WHERE email = 'admin@savvice.com'");
  } catch (e) {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
      file_url VARCHAR(500) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS annual_targets (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      activity_id INTEGER REFERENCES activities(id),
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      target_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(year, activity_id, month)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS manual_accomplishments (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      activity_id INTEGER REFERENCES activities(id),
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      accomplishment_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(year, activity_id, month)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_accomplishments (
      id SERIAL PRIMARY KEY,
      activity_id INTEGER REFERENCES activities(id),
      department_id INTEGER REFERENCES departments(id),
      accomplishment_date DATE NOT NULL,
      target_value DECIMAL(10,2) DEFAULT 0,
      accomplishment_value DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(activity_id, accomplishment_date)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS manpower (
      id SERIAL PRIMARY KEY,
      employee_id VARCHAR(20),
      name VARCHAR(255) NOT NULL,
      position VARCHAR(255),
      designated_area VARCHAR(255),
      date_hired VARCHAR(100),
      contact_info VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Add unique constraint on employee_id if it doesn't exist
  try {
    await pool.query('ALTER TABLE manpower ADD CONSTRAINT manpower_employee_id_unique UNIQUE (employee_id)');
  } catch (e) {
    // Constraint already exists
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      manpower_id INTEGER REFERENCES manpower(id),
      attendance_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'leave', 'rest_day')),
      remarks TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(manpower_id, attendance_date)
    );
  `);

  // ── Billing tables ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_equipment (
      id SERIAL PRIMARY KEY,
      category VARCHAR(100),
      equipment_name VARCHAR(255) NOT NULL,
      body_no VARCHAR(100),
      assignment VARCHAR(255),
      unit VARCHAR(50) DEFAULT 'nos.',
      unit_rate DECIMAL(12,2) DEFAULT 0,
      contracted_qty DECIMAL(10,2) DEFAULT 0,
      daily_rate DECIMAL(12,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_manpower (
      id SERIAL PRIMARY KEY,
      team VARCHAR(100),
      position VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      daily_rate DECIMAL(12,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_records (
      id SERIAL PRIMARY KEY,
      billing_type VARCHAR(20) CHECK (billing_type IN ('equipment', 'manpower', 'materials')),
      reference_id INTEGER,
      billing_month INTEGER,
      billing_year INTEGER,
      days_used DECIMAL(10,2) DEFAULT 0,
      amount DECIMAL(12,2) DEFAULT 0,
      remarks TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(billing_type, reference_id, billing_month, billing_year)
    );
  `);

  // Clear out the equipment list (and anything referencing it) — new list to be seeded separately
  await pool.query("DELETE FROM billing_records WHERE billing_type = 'equipment'");
  await pool.query('DELETE FROM equipment_tracking');
  await pool.query('DELETE FROM billing_equipment');

  // Add billing_group column if missing
  try { await pool.query("ALTER TABLE billing_manpower ADD COLUMN IF NOT EXISTS billing_group VARCHAR(100) DEFAULT 'Bridge RM & Epoxy'"); } catch (e) {}

  // Clean duplicates — delete old billing manpower and re-seed
  await pool.query("DELETE FROM billing_manpower");

  // Seed billing manpower: [team, position, name, description, daily_rate, billing_group]
  const BILLING_MANPOWER = [
    // === BRIDGE RM & EPOXY ===
    ['Admin', 'Supervisor', 'NEWELL GATCHALIAN', 'Supervisor (6 days, day shift, 8 hours)', 0, 'Bridge RM & Epoxy'],
    ['Admin', 'Admin Assistant', 'LLAGAS, JINKY Q.', 'Admin assistant (6 days, day shift, 8 hours)', 0, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Leadman/Driver', 'TANJECO, PIJAY C.', 'Driver (6 days, 8 hours shift)', 1081.60, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Skilled', 'BILLONES, JUSTIN B.', 'Skilled labor (6 days, 8 hours)', 812.97, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Crew', 'ALCORIZA, IGNACIO JR. C.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Crew', 'ANGELO, ALVIN G.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Crew', 'BLANZA, JOVEN B.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Crew', 'MIRANDA, ROCKY B.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Crew', 'CANDELARIA, RICHARD S.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Routine Maintenance', 'Crew', 'SEBUC, CRISOSTOMO G.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Leadman/Driver', 'MIRANDA, ALLAN P.', 'Driver (6 days, 8 hours)', 1081.60, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Skilled', 'DORDULO, ELMER M.', 'Skilled labor (6 days, 8 hours)', 812.97, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Skilled', 'LOZANO, EDWIN S.', 'Skilled labor (6 days, 8 hours)', 812.97, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Crew', 'AQUINO, R-JAY JOHN C.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Crew', 'DE GUZMAN, MARK JOSEPH F.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Crew', 'DELA CRUZ, EDBRYAN P.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Crew', 'DUNGCA, MARK IAN T.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Crew', 'MANESE, JOHNRY C.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 1', 'Crew', 'PANGILINAN, EROLL M.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Leadman/Driver', 'MARTINEZ, CEDERICK A.', 'Driver (6 days, 8 hours)', 1081.60, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Skilled', 'GALANG, ALVIN G.', 'Skilled labor (6 days, 8 hours)', 812.97, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Skilled', 'RIVERA, GILBERT O.', 'Skilled labor (6 days, 8 hours)', 812.97, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Crew', 'CABUNAG, IVAN P.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Crew', 'ENRIQUEZ, AJ D.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Crew', 'OCCIDENTAL, JAYPEE T.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Crew', 'ORTILLO, EDGAR A.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Crew', 'ROTAMULA, VOLTAIRE O.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    ['Epoxy Team 2', 'Crew', 'TAYCO, JOSHUA ANDREI A.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Bridge RM & Epoxy'],
    // === SEGMENT 10 ===
    ['Bridge Segment 10', 'Leadman/Driver', 'BUTIONG, GLENN A.', 'Driver (6 days, 8 hours shift)', 1081.60, 'Segment 10'],
    ['Bridge Segment 10', 'Skilled', 'BALAGAO, ARTCHIE L.', 'Skilled labor (6 days, 8 hours)', 812.97, 'Segment 10'],
    ['Bridge Segment 10', 'Crew', 'BALMEO, ABRAHAM P.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Segment 10'],
    ['Bridge Segment 10', 'Crew', 'BAYLON, JUSTINE GREGG F.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Segment 10'],
    ['Bridge Segment 10', 'Crew', 'BERNARDO, JOHN CHRISTIAN R.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Segment 10'],
    ['Bridge Segment 10', 'Crew', 'DE MESA, GLEN JORICK M.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Segment 10'],
    ['Bridge Segment 10', 'Crew', 'DIAZ, JAMES BARRON O.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Segment 10'],
    ['Bridge Segment 10', 'Crew', 'ENRIQUEZ, IAN T.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Segment 10'],
    ['Bridge Segment 10', 'Crew', 'FAUSTINO, ROLANDO G.', 'Non-Skilled labor (6 days, 8 hours)', 765.06, 'Segment 10'],
  ];

  for (const [team, pos, name, desc, rate, group] of BILLING_MANPOWER) {
    await pool.query(
      'INSERT INTO billing_manpower (team, position, name, description, daily_rate, billing_group) VALUES ($1,$2,$3,$4,$5,$6)',
      [team, pos, name, desc, rate, group]
    );
  }
  // ── Equipment tracking table ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipment_tracking (
      id SERIAL PRIMARY KEY,
      billing_equipment_id INTEGER REFERENCES billing_equipment(id),
      tracking_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'deployed' CHECK (status IN ('deployed', 'standby', 'breakdown', 'maintenance')),
      hours_used DECIMAL(5,2) DEFAULT 0,
      remarks TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(billing_equipment_id, tracking_date)
    );
  `);

  console.log('Billing data seeded');

  const deptIds = {};
  for (const dept of DEPARTMENTS) {
    const res = await pool.query(
      'INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id',
      [dept]
    );
    const deptId = res.rows[0].id;
    deptIds[dept] = deptId;

    for (const activity of ACTIVITIES[dept]) {
      await pool.query(
        'INSERT INTO activities (name, department_id) VALUES ($1, $2) ON CONFLICT (name, department_id) DO NOTHING',
        [activity, deptId]
      );
    }
  }

  // ── Activity Dashboard: tool groups (nested under a department) + logged entries ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tool_groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      department_id INTEGER REFERENCES departments(id),
      sort_order INTEGER DEFAULT 0
    );
  `);
  try { await pool.query('ALTER TABLE tool_groups ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)'); } catch (e) {}
  // One-time cleanup of the old ungrouped placeholder tool_groups (self-limiting: only matches rows with no department)
  await pool.query('DELETE FROM tool_groups WHERE department_id IS NULL');

  // Catalog of items per group (e.g. "Grass Cutter" under Tools and Accessories)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tool_items (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES tool_groups(id) ON DELETE CASCADE,
      category VARCHAR(100) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      qty_required DECIMAL(10,2) NOT NULL DEFAULT 1,
      photo TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(group_id, item_name)
    );
  `);

  // Daily actual-qty submissions against the catalog above.
  // Replaces the earlier free-form (group_id/category/item_description) shape from before the
  // catalog existed. That version was never used in production; this check is self-limiting —
  // it only fires once, while the old column still exists, so it's safe to leave in place.
  const oldToolEntriesSchema = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'tool_entries' AND column_name = 'item_description'"
  );
  if (oldToolEntriesSchema.rows.length > 0) {
    await pool.query('DROP TABLE tool_entries');
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tool_entries (
      id SERIAL PRIMARY KEY,
      item_id INTEGER REFERENCES tool_items(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      actual_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
      remarks TEXT,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(item_id, entry_date)
    );
  `);

  const groupIds = {};
  for (let i = 0; i < TOOL_GROUPS_SEED.length; i++) {
    const [deptName, groupName] = TOOL_GROUPS_SEED[i];
    const groupRes = await pool.query(
      'INSERT INTO tool_groups (name, department_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET department_id = $2, sort_order = $3 RETURNING id',
      [groupName, deptIds[deptName], i + 1]
    );
    groupIds[groupName] = groupRes.rows[0].id;
  }
  console.log('Tool groups seeded: ' + TOOL_GROUPS_SEED.length + ' groups');

  for (let i = 0; i < TOOL_ITEMS_SEED.length; i++) {
    const [groupName, category, itemName, qtyRequired] = TOOL_ITEMS_SEED[i];
    await pool.query(
      'INSERT INTO tool_items (group_id, category, item_name, qty_required, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (group_id, item_name) DO NOTHING',
      [groupIds[groupName], category, itemName, qtyRequired, i + 1]
    );
  }
  console.log('Tool items seeded: ' + TOOL_ITEMS_SEED.length + ' items');

  const adminExists = await pool.query("SELECT id FROM users WHERE email = 'admin@savvice.com'");
  if (adminExists.rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, department_id) VALUES ('Admin', 'admin@savvice.com', $1, 'admin', 1)",
      [hash]
    );
    console.log('Admin account created (admin@savvice.com / admin123)');
  }

  // Seed manpower data
  for (const [eid, name, position, area] of MANPOWER_SEED) {
    await pool.query(
      'INSERT INTO manpower (employee_id, name, position, designated_area) VALUES ($1, $2, $3, $4) ON CONFLICT (employee_id) DO NOTHING',
      [eid, name, position, area]
    );
  }
  console.log('Manpower seeded: ' + MANPOWER_SEED.length + ' employees');

  console.log('Database initialized successfully!');
}

if (require.main === module) {
  init().then(() => process.exit(0)).catch((err) => {
    console.error('Database initialization failed:', err.message);
    process.exit(1);
  });
}

module.exports = init;
