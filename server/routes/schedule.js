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

    // Get accomplishments from reports
    const accomplishmentResult = await pool.query(`
      SELECT activity_id, EXTRACT(MONTH FROM report_date)::int as month,
             COALESCE(SUM(accomplishment), 0) as total
      FROM reports
      WHERE EXTRACT(YEAR FROM report_date) = $1
        AND department_id = $2
        AND status = 'approved'
      GROUP BY activity_id, EXTRACT(MONTH FROM report_date)
    `, [year, department_id]);

    // Build lookup maps
    const targetMap = {};
    for (const t of targetsResult.rows) {
      const key = `${t.activity_id}-${t.month}`;
      targetMap[key] = parseFloat(t.target_value) || 0;
    }

    const accomplishmentMap = {};
    for (const a of accomplishmentResult.rows) {
      const key = `${a.activity_id}-${a.month}`;
      accomplishmentMap[key] = parseFloat(a.total) || 0;
    }

    // Build response
    let grandTotalTarget = 0;
    let grandTotalAccomplishment = 0;

    const activities = activitiesResult.rows.map(activity => {
      let annualTarget = 0;
      let annualAccomplishment = 0;

      const monthly = [];
      for (let m = 1; m <= 12; m++) {
        const target = targetMap[`${activity.id}-${m}`] || 0;
        const accomplishment = accomplishmentMap[`${activity.id}-${m}`] || 0;
        const percentage = target > 0 ? parseFloat(((accomplishment / target) * 100).toFixed(2)) : 0;

        annualTarget += target;
        annualAccomplishment += accomplishment;

        monthly.push({
          month: m,
          month_name: MONTH_NAMES[m - 1],
          target: parseFloat(target.toFixed(2)),
          accomplishment: parseFloat(accomplishment.toFixed(2)),
          percentage
        });
      }

      grandTotalTarget += annualTarget;
      grandTotalAccomplishment += annualAccomplishment;

      const annualPercentage = annualTarget > 0
        ? parseFloat(((annualAccomplishment / annualTarget) * 100).toFixed(2))
        : 0;

      return {
        activity_id: activity.id,
        activity_name: activity.name,
        annual_target: parseFloat(annualTarget.toFixed(2)),
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
        total_accomplishment: parseFloat(grandTotalAccomplishment.toFixed(2)),
        percentage: totalPercentage
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
