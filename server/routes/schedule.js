const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// GET /api/schedule/targets?year=2026&department_id=1
router.get('/targets', authenticate, async (req, res) => {
  try {
    const { year, department_id } = req.query;
    if (!year) return res.status(400).json({ error: 'Year is required' });

    let query = `
      SELECT at.id, at.year, at.month, at.target_value, at.activity_id, at.department_id,
             d.name as department_name, a.name as activity_name
      FROM annual_targets at
      JOIN departments d ON at.department_id = d.id
      JOIN activities a ON at.activity_id = a.id
      WHERE at.year = $1
    `;
    const params = [year];

    if (department_id) {
      params.push(department_id);
      query += ` AND at.department_id = $${params.length}`;
    }

    query += ' ORDER BY d.name, a.name, at.month';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/targets (admin only)
router.post('/targets', authenticate, requireAdmin, async (req, res) => {
  try {
    const { year, activity_id, targets } = req.body;

    if (!year || !activity_id || !Array.isArray(targets)) {
      return res.status(400).json({ error: 'year, activity_id, and targets array are required' });
    }

    // Look up the department_id for this activity
    const actResult = await pool.query('SELECT department_id FROM activities WHERE id = $1', [activity_id]);
    if (actResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    const department_id = actResult.rows[0].department_id;

    const results = [];
    for (const t of targets) {
      if (!t.month || t.month < 1 || t.month > 12) continue;
      const targetValue = parseFloat(t.target_value) || 0;

      const result = await pool.query(`
        INSERT INTO annual_targets (year, department_id, activity_id, month, target_value)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (year, activity_id, month)
        DO UPDATE SET target_value = $5, department_id = $2
        RETURNING *
      `, [year, department_id, activity_id, t.month, targetValue]);

      results.push(result.rows[0]);
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/accomplishments?year=2026&department_id=1
router.get('/accomplishments', authenticate, async (req, res) => {
  try {
    const { year, department_id } = req.query;
    if (!year) return res.status(400).json({ error: 'Year is required' });

    let query = `
      SELECT ma.id, ma.year, ma.month, ma.accomplishment_value, ma.activity_id, ma.department_id,
             d.name as department_name, a.name as activity_name
      FROM manual_accomplishments ma
      JOIN departments d ON ma.department_id = d.id
      JOIN activities a ON ma.activity_id = a.id
      WHERE ma.year = $1
    `;
    const params = [year];

    if (department_id) {
      params.push(department_id);
      query += ` AND ma.department_id = $${params.length}`;
    }

    query += ' ORDER BY d.name, a.name, ma.month';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/accomplishments (admin only)
router.post('/accomplishments', authenticate, requireAdmin, async (req, res) => {
  try {
    const { year, activity_id, accomplishments } = req.body;

    if (!year || !activity_id || !Array.isArray(accomplishments)) {
      return res.status(400).json({ error: 'year, activity_id, and accomplishments array are required' });
    }

    // Look up the department_id for this activity
    const actResult = await pool.query('SELECT department_id FROM activities WHERE id = $1', [activity_id]);
    if (actResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    const department_id = actResult.rows[0].department_id;

    const results = [];
    for (const a of accomplishments) {
      if (!a.month || a.month < 1 || a.month > 12) continue;
      const accomplishmentValue = parseFloat(a.accomplishment_value) || 0;

      const result = await pool.query(`
        INSERT INTO manual_accomplishments (year, department_id, activity_id, month, accomplishment_value)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (year, activity_id, month)
        DO UPDATE SET accomplishment_value = $5, department_id = $2, updated_at = NOW()
        RETURNING *
      `, [year, department_id, activity_id, a.month, accomplishmentValue]);

      results.push(result.rows[0]);
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/overview?year=2026&department_id=1
router.get('/overview', authenticate, async (req, res) => {
  try {
    const { year, department_id } = req.query;
    if (!year) return res.status(400).json({ error: 'Year is required' });

    if (!department_id) {
      return res.status(400).json({ error: 'Department is required' });
    }

    // Get department name
    const deptResult = await pool.query('SELECT name FROM departments WHERE id = $1', [department_id]);
    if (deptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const department_name = deptResult.rows[0].name;

    // Get all activities for the department
    const activitiesResult = await pool.query(
      'SELECT id, name FROM activities WHERE department_id = $1 ORDER BY name',
      [department_id]
    );

    // Get all targets for this department and year
    const targetsResult = await pool.query(`
      SELECT activity_id, month, target_value
      FROM annual_targets
      WHERE year = $1 AND department_id = $2
      ORDER BY activity_id, month
    `, [year, department_id]);

    // Get auto accomplishments from approved reports
    const autoAccomplishmentResult = await pool.query(`
      SELECT activity_id, EXTRACT(MONTH FROM report_date)::int as month,
             COALESCE(SUM(accomplishment), 0) as total
      FROM reports
      WHERE EXTRACT(YEAR FROM report_date) = $1
        AND department_id = $2
        AND status = 'approved'
      GROUP BY activity_id, EXTRACT(MONTH FROM report_date)
    `, [year, department_id]);

    // Get manual accomplishments
    const manualAccomplishmentResult = await pool.query(`
      SELECT activity_id, month, accomplishment_value
      FROM manual_accomplishments
      WHERE year = $1 AND department_id = $2
      ORDER BY activity_id, month
    `, [year, department_id]);

    // Build lookup maps
    const targetMap = {};
    for (const t of targetsResult.rows) {
      const key = `${t.activity_id}-${t.month}`;
      targetMap[key] = parseFloat(t.target_value) || 0;
    }

    const autoAccomplishmentMap = {};
    for (const a of autoAccomplishmentResult.rows) {
      const key = `${a.activity_id}-${a.month}`;
      autoAccomplishmentMap[key] = parseFloat(a.total) || 0;
    }

    const manualAccomplishmentMap = {};
    for (const m of manualAccomplishmentResult.rows) {
      const key = `${m.activity_id}-${m.month}`;
      manualAccomplishmentMap[key] = parseFloat(m.accomplishment_value) || 0;
    }

    // Build response
    let grandTotalTarget = 0;
    let grandTotalAutoAccomplishment = 0;
    let grandTotalManualAccomplishment = 0;
    let grandTotalAccomplishment = 0;

    const activities = activitiesResult.rows.map(activity => {
      let annualTarget = 0;
      let annualAutoAccomplishment = 0;
      let annualManualAccomplishment = 0;
      let annualAccomplishment = 0;

      const monthly = [];
      for (let m = 1; m <= 12; m++) {
        const target = targetMap[`${activity.id}-${m}`] || 0;
        const autoAccomplishment = autoAccomplishmentMap[`${activity.id}-${m}`] || 0;
        const manualAccomplishment = manualAccomplishmentMap[`${activity.id}-${m}`] || 0;
        const totalAccomplishment = autoAccomplishment + manualAccomplishment;
        const percentage = target > 0 ? parseFloat(((totalAccomplishment / target) * 100).toFixed(2)) : 0;

        annualTarget += target;
        annualAutoAccomplishment += autoAccomplishment;
        annualManualAccomplishment += manualAccomplishment;
        annualAccomplishment += totalAccomplishment;

        monthly.push({
          month: m,
          month_name: MONTH_NAMES[m - 1],
          target: parseFloat(target.toFixed(2)),
          auto_accomplishment: parseFloat(autoAccomplishment.toFixed(2)),
          manual_accomplishment: parseFloat(manualAccomplishment.toFixed(2)),
          accomplishment: parseFloat(totalAccomplishment.toFixed(2)),
          percentage
        });
      }

      grandTotalTarget += annualTarget;
      grandTotalAutoAccomplishment += annualAutoAccomplishment;
      grandTotalManualAccomplishment += annualManualAccomplishment;
      grandTotalAccomplishment += annualAccomplishment;

      const annualPercentage = annualTarget > 0
        ? parseFloat(((annualAccomplishment / annualTarget) * 100).toFixed(2))
        : 0;

      return {
        activity_id: activity.id,
        activity_name: activity.name,
        annual_target: parseFloat(annualTarget.toFixed(2)),
        annual_auto_accomplishment: parseFloat(annualAutoAccomplishment.toFixed(2)),
        annual_manual_accomplishment: parseFloat(annualManualAccomplishment.toFixed(2)),
        annual_accomplishment: parseFloat(annualAccomplishment.toFixed(2)),
        percentage: annualPercentage,
        monthly
      };
    });

    const totalPercentage = grandTotalTarget > 0
      ? parseFloat(((grandTotalAccomplishment / grandTotalTarget) * 100).toFixed(2))
      : 0;

    res.json({
      year: parseInt(year),
      department_name,
      activities,
      totals: {
        total_target: parseFloat(grandTotalTarget.toFixed(2)),
        total_auto_accomplishment: parseFloat(grandTotalAutoAccomplishment.toFixed(2)),
        total_manual_accomplishment: parseFloat(grandTotalManualAccomplishment.toFixed(2)),
        total_accomplishment: parseFloat(grandTotalAccomplishment.toFixed(2)),
        percentage: totalPercentage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/daily?year=2026&month=6&activity_id=1
router.get('/daily', authenticate, async (req, res) => {
  try {
    const { year, month, activity_id } = req.query;
    if (!year || !month || !activity_id) {
      return res.status(400).json({ error: 'year, month, and activity_id are required' });
    }

    // Build the first and last day of the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const result = await pool.query(`
      SELECT id, accomplishment_date, target_value, accomplishment_value
      FROM daily_accomplishments
      WHERE activity_id = $1
        AND accomplishment_date >= $2
        AND accomplishment_date <= $3
      ORDER BY accomplishment_date
    `, [activity_id, startDate, endDate]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/daily (admin only)
router.post('/daily', authenticate, requireAdmin, async (req, res) => {
  try {
    const { activity_id, entries } = req.body;

    if (!activity_id || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'activity_id and entries array are required' });
    }

    // Look up department_id from the activity
    const actResult = await pool.query('SELECT department_id FROM activities WHERE id = $1', [activity_id]);
    if (actResult.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    const department_id = actResult.rows[0].department_id;

    const results = [];
    for (const entry of entries) {
      if (!entry.date) continue;
      const targetValue = parseFloat(entry.target_value) || 0;
      const accomplishmentValue = parseFloat(entry.accomplishment_value) || 0;

      const result = await pool.query(`
        INSERT INTO daily_accomplishments (activity_id, department_id, accomplishment_date, target_value, accomplishment_value)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (activity_id, accomplishment_date)
        DO UPDATE SET target_value = $4, accomplishment_value = $5, department_id = $2, updated_at = NOW()
        RETURNING *
      `, [activity_id, department_id, entry.date, targetValue, accomplishmentValue]);

      results.push(result.rows[0]);
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/daily-summary?year=2026&month=6&department_id=1
router.get('/daily-summary', authenticate, async (req, res) => {
  try {
    const { year, month, department_id } = req.query;
    if (!year || !month || !department_id) {
      return res.status(400).json({ error: 'year, month, and department_id are required' });
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const result = await pool.query(`
      SELECT a.name as activity_name,
             COALESCE(SUM(da.target_value), 0) as total_target,
             COALESCE(SUM(da.accomplishment_value), 0) as total_accomplishment,
             COUNT(da.id) as day_count
      FROM activities a
      LEFT JOIN daily_accomplishments da
        ON da.activity_id = a.id
        AND da.accomplishment_date >= $2
        AND da.accomplishment_date <= $3
      WHERE a.department_id = $1
      GROUP BY a.id, a.name
      ORDER BY a.name
    `, [department_id, startDate, endDate]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
