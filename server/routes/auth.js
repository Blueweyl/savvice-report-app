const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department_id } = req.body;

    if (!name || !email || !password || !department_id) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, department_id, account_status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id, name, email, role, department_id, account_status",
      [name, email, password_hash, 'employee', department_id]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: 'Registration submitted. Please wait for admin approval.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        account_status: user.account_status,
      },
      pending: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT u.*, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check account_status before issuing token
    if (user.account_status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval. Please wait for admin to approve.' });
    }
    if (user.account_status === 'rejected') {
      return res.status(403).json({ error: 'Your account has been rejected. Please contact admin.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, department_id: user.department_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, u.account_status, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/pending — list pending registrations (admin only)
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.department_id, d.name as department_name, u.created_at
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.account_status = 'pending'
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users — list all users (admin only), filterable by ?status=
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT u.id, u.name, u.email, u.role, u.department_id, u.account_status, d.name as department_name, u.created_at
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id`;
    const params = [];

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query += ' WHERE u.account_status = $1';
      params.push(status);
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id/status — approve or reject a user (admin only)
router.patch('/users/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { account_status } = req.body;

    if (!account_status || !['approved', 'rejected'].includes(account_status)) {
      return res.status(400).json({ error: 'account_status must be "approved" or "rejected"' });
    }

    const result = await pool.query(
      `UPDATE users SET account_status = $1 WHERE id = $2
       RETURNING id, name, email, role, department_id, account_status`,
      [account_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
