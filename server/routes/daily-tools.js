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

// GET /api/daily-tools/items?group_id= — list catalog items for a group
router.get('/items', authenticate, async (req, res) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });

    const result = await pool.query(
      'SELECT * FROM tool_items WHERE group_id = $1 AND is_active = true ORDER BY category, sort_order, id',
      [group_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tool items:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-tools/items — add a new catalog item to a group
// Body: { group_id, category, item_name, qty_required, photo }
router.post('/items', authenticate, async (req, res) => {
  try {
    const { group_id, category, item_name, qty_required, photo } = req.body;
    if (!group_id || !category || !item_name) {
      return res.status(400).json({ error: 'group_id, category and item_name are required' });
    }

    const result = await pool.query(
      `INSERT INTO tool_items (group_id, category, item_name, qty_required, photo, sort_order)
       VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tool_items WHERE group_id = $1 AND category = $2))
       ON CONFLICT (group_id, item_name) DO NOTHING RETURNING *`,
      [group_id, category, item_name.trim(), qty_required || 1, photo || null]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'An item with this name already exists in this group' });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating tool item:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/daily-tools/items/:id (admin only)
router.delete('/items/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('UPDATE tool_items SET is_active = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/daily-tools/entries?group_id=&date= — catalog items for the group with actual_qty for that date
router.get('/entries', authenticate, async (req, res) => {
  try {
    const { group_id, date } = req.query;
    if (!group_id || !date) return res.status(400).json({ error: 'group_id and date are required' });

    const result = await pool.query(
      `SELECT ti.id as item_id, ti.category, ti.item_name, ti.qty_required, ti.photo,
              COALESCE(te.actual_qty, 0) as actual_qty, te.remarks
       FROM tool_items ti
       LEFT JOIN tool_entries te ON te.item_id = ti.id AND te.entry_date = $2
       WHERE ti.group_id = $1 AND ti.is_active = true
       ORDER BY ti.category, ti.sort_order, ti.id`,
      [group_id, date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tool entries:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-tools/entries — batch save actual quantities for a date
// Body: { date, entries: [{ item_id, actual_qty, remarks }] }
router.post('/entries', authenticate, async (req, res) => {
  try {
    const { date, entries } = req.body;
    if (!date || !entries) return res.status(400).json({ error: 'date and entries are required' });

    for (const e of entries) {
      await pool.query(
        `INSERT INTO tool_entries (item_id, entry_date, actual_qty, remarks, submitted_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (item_id, entry_date)
         DO UPDATE SET actual_qty = $3, remarks = $4, submitted_by = $5, updated_at = NOW()`,
        [e.item_id, date, e.actual_qty || 0, e.remarks || null, req.user.id]
      );
    }

    res.json({ message: 'Entries saved', count: entries.length });
  } catch (err) {
    console.error('Error saving tool entries:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/daily-tools/entries/history?group_id= — recent submitted dates with totals (for View Records)
router.get('/entries/history', authenticate, async (req, res) => {
  try {
    const { group_id } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });

    const result = await pool.query(
      `SELECT te.entry_date, ti.category, ti.item_name, ti.qty_required, te.actual_qty, te.remarks, u.name as submitted_by_name
       FROM tool_entries te
       JOIN tool_items ti ON ti.id = te.item_id
       LEFT JOIN users u ON u.id = te.submitted_by
       WHERE ti.group_id = $1
       ORDER BY te.entry_date DESC, ti.category, ti.sort_order
       LIMIT 300`,
      [group_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tool entry history:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
