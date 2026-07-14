const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/daily-tools/groups?department_id=  — list tool groups, optionally scoped to a department
router.get('/groups', authenticate, async (req, res) => {
  try {
    const { department_id } = req.query;
    const result = department_id
      ? await pool.query('SELECT * FROM tool_groups WHERE department_id = $1 ORDER BY sort_order, id', [department_id])
      : await pool.query('SELECT * FROM tool_groups ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-tools/groups — add a new activity group under a department
// Body: { department_id, name }
router.post('/groups', authenticate, async (req, res) => {
  try {
    const { department_id, name } = req.body;
    if (!department_id || !name) {
      return res.status(400).json({ error: 'department_id and name are required' });
    }

    const result = await pool.query(
      `INSERT INTO tool_groups (name, department_id, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tool_groups WHERE department_id = $2))
       ON CONFLICT (name) DO NOTHING RETURNING *`,
      [name.trim(), department_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'A group with this name already exists' });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating tool group:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/daily-tools/entries?group_id=&date=  — view records for a group (date optional)
router.get('/entries', authenticate, async (req, res) => {
  try {
    const { group_id, date } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });

    const result = date
      ? await pool.query(
          `SELECT te.*, u.name as submitted_by_name
           FROM tool_entries te
           LEFT JOIN users u ON u.id = te.submitted_by
           WHERE te.group_id = $1 AND te.entry_date = $2
           ORDER BY te.created_at DESC`,
          [group_id, date]
        )
      : await pool.query(
          `SELECT te.*, u.name as submitted_by_name
           FROM tool_entries te
           LEFT JOIN users u ON u.id = te.submitted_by
           WHERE te.group_id = $1
           ORDER BY te.entry_date DESC, te.created_at DESC
           LIMIT 200`,
          [group_id]
        );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tool entries:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-tools/entries — submit one entry
// Body: { group_id, entry_date, category, item_description, qty_required, actual_qty, remarks }
router.post('/entries', authenticate, async (req, res) => {
  try {
    const { group_id, entry_date, category, item_description, qty_required, actual_qty, remarks } = req.body;
    if (!group_id || !entry_date || !category || !item_description) {
      return res.status(400).json({ error: 'group_id, entry_date, category and item_description are required' });
    }

    const result = await pool.query(
      `INSERT INTO tool_entries (group_id, entry_date, category, item_description, qty_required, actual_qty, remarks, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [group_id, entry_date, category, item_description, qty_required || 0, actual_qty || 0, remarks || null, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving tool entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/daily-tools/entries/:id (admin only)
router.delete('/entries/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tool_entries WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
