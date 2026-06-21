const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

router.post('/', authenticate, upload.fields([
  { name: 'photo_before', maxCount: 1 },
  { name: 'photo_after', maxCount: 1 },
]), async (req, res) => {
  try {
    const {
      activity_id, report_date, team, status_bound,
      activity_description, location_from, location_to,
      accomplishment, equipment, operator_name,
      crew_names, remarks
    } = req.body;

    if (!activity_id || !report_date) {
      return res.status(400).json({ error: 'Activity and date are required' });
    }

    const activity = await pool.query(
      'SELECT department_id FROM activities WHERE id = $1',
      [activity_id]
    );

    if (activity.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid activity' });
    }

    const photoBefore = req.files?.photo_before?.[0]?.filename || null;
    const photoAfter = req.files?.photo_after?.[0]?.filename || null;

    const result = await pool.query(
      `INSERT INTO reports (
        author_id, department_id, activity_id, report_date, team, status_bound,
        activity_description, location_from, location_to,
        accomplishment, equipment, operator_name,
        crew_names, remarks, photo_before, photo_after
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        req.user.id, activity.rows[0].department_id, parseInt(activity_id),
        report_date, team || null, status_bound || 'on_going',
        activity_description || null, location_from || null, location_to || null,
        parseFloat(accomplishment) || 0, equipment || null, operator_name || null,
        crew_names || null, remarks || null, photoBefore, photoAfter
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, a.name as activity_name, d.name as department_name, u.name as author_name
       FROM reports r
       JOIN activities a ON r.activity_id = a.id
       JOIN departments d ON r.department_id = d.id
       JOIN users u ON r.author_id = u.id
       WHERE r.author_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const { department_id, status, activity_id } = req.query;
    let query = `
      SELECT r.*, a.name as activity_name, d.name as department_name, u.name as author_name,
             rv.name as reviewer_name
      FROM reports r
      JOIN activities a ON r.activity_id = a.id
      JOIN departments d ON r.department_id = d.id
      JOIN users u ON r.author_id = u.id
      LEFT JOIN users rv ON r.reviewed_by = rv.id
      WHERE 1=1
    `;
    const params = [];

    if (department_id) {
      params.push(department_id);
      query += ` AND r.department_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }
    if (activity_id) {
      params.push(activity_id);
      query += ` AND r.activity_id = $${params.length}`;
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, a.name as activity_name, d.name as department_name, u.name as author_name,
              rv.name as reviewer_name
       FROM reports r
       JOIN activities a ON r.activity_id = a.id
       JOIN departments d ON r.department_id = d.id
       JOIN users u ON r.author_id = u.id
       LEFT JOIN users rv ON r.reviewed_by = rv.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    if (req.user.role !== 'admin' && report.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/review', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, admin_comment } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const result = await pool.query(
      `UPDATE reports
       SET status = $1, admin_comment = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, admin_comment || null, req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
