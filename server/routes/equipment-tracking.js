const express = require('express');
const ExcelJS = require('exceljs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Auth middleware that also supports ?token= query param (for exports)
function authenticateFlexible(req, res, next) {
  let token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// GET /api/equipment-tracking?date=2026-06-22
// Returns all equipment with their tracking status for a specific date
router.get('/', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const result = await pool.query(`
      SELECT be.id as equipment_id, be.equipment_name, be.body_no, be.category, be.assignment,
             COALESCE(et.status, 'deployed') as status,
             COALESCE(et.hours_used, 0) as hours_used,
             et.remarks
      FROM billing_equipment be
      LEFT JOIN equipment_tracking et ON be.id = et.billing_equipment_id AND et.tracking_date = $1
      WHERE be.is_active = true
      ORDER BY be.category, be.id
    `, [date]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching equipment tracking:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipment-tracking (admin only)
// Body: { date, entries: [{ billing_equipment_id, status, hours_used, remarks }] }
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { date, entries } = req.body;
    if (!date || !entries) return res.status(400).json({ error: 'date and entries are required' });

    for (const e of entries) {
      await pool.query(
        `INSERT INTO equipment_tracking (billing_equipment_id, tracking_date, status, hours_used, remarks)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (billing_equipment_id, tracking_date)
         DO UPDATE SET status = $3, hours_used = $4, remarks = $5`,
        [e.billing_equipment_id, date, e.status || 'deployed', e.hours_used || 0, e.remarks || null]
      );
    }

    res.json({ message: 'Equipment tracking saved', count: entries.length });
  } catch (err) {
    console.error('Error saving equipment tracking:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipment-tracking/summary?date_from=&date_to=
// Returns summary: per equipment - days_deployed, days_standby, days_breakdown, days_maintenance
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to are required' });

    const result = await pool.query(`
      SELECT be.id as equipment_id, be.equipment_name, be.body_no, be.category, be.assignment,
             COUNT(CASE WHEN et.status = 'deployed' THEN 1 END)::int as days_deployed,
             COUNT(CASE WHEN et.status = 'standby' THEN 1 END)::int as days_standby,
             COUNT(CASE WHEN et.status = 'breakdown' THEN 1 END)::int as days_breakdown,
             COUNT(CASE WHEN et.status = 'maintenance' THEN 1 END)::int as days_maintenance
      FROM billing_equipment be
      LEFT JOIN equipment_tracking et ON be.id = et.billing_equipment_id
        AND et.tracking_date BETWEEN $1 AND $2
      WHERE be.is_active = true
      GROUP BY be.id, be.equipment_name, be.body_no, be.category, be.assignment
      ORDER BY be.category, be.id
    `, [date_from, date_to]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching equipment tracking summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipment-tracking/auto-days?month=&year=
// Returns days_deployed count per billing_equipment for a given month
// Used by billing to auto-fill equipment days_used
router.get('/auto-days', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

    const result = await pool.query(`
      SELECT be.id as billing_equipment_id, be.equipment_name, be.daily_rate,
             COALESCE(COUNT(CASE WHEN et.status = 'deployed' THEN 1 END), 0)::int as days_deployed
      FROM billing_equipment be
      LEFT JOIN equipment_tracking et ON be.id = et.billing_equipment_id
        AND EXTRACT(MONTH FROM et.tracking_date) = $1
        AND EXTRACT(YEAR FROM et.tracking_date) = $2
      WHERE be.is_active = true
      GROUP BY be.id, be.equipment_name, be.daily_rate
      ORDER BY be.category, be.id
    `, [month, year]);

    const rows = result.rows.map(r => ({
      billing_equipment_id: r.billing_equipment_id,
      equipment_name: r.equipment_name,
      days_deployed: r.days_deployed,
      daily_rate: parseFloat(r.daily_rate),
      auto_amount: parseFloat((r.days_deployed * parseFloat(r.daily_rate)).toFixed(2)),
    }));

    res.json(rows);
  } catch (err) {
    console.error('Error fetching equipment auto-days:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipment-tracking/export?date_from=&date_to=
// Excel export showing equipment status per day
router.get('/export', authenticateFlexible, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to are required' });

    // Get equipment
    const eqResult = await pool.query(
      'SELECT * FROM billing_equipment WHERE is_active = true ORDER BY category, id'
    );
    const equipment = eqResult.rows;

    // Get tracking records
    const trackResult = await pool.query(
      `SELECT billing_equipment_id, tracking_date, status, hours_used
       FROM equipment_tracking
       WHERE tracking_date BETWEEN $1 AND $2`,
      [date_from, date_to]
    );
    const trackMap = {};
    trackResult.rows.forEach(t => {
      trackMap[t.billing_equipment_id + '_' + t.tracking_date.toISOString().split('T')[0]] = t;
    });

    // Generate dates
    const dates = [];
    const d = new Date(date_from);
    const end = new Date(date_to);
    while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Equipment Tracking');

    // Title row
    ws.mergeCells(1, 1, 1, 4 + dates.length + 4);
    const title = ws.getCell(1, 1);
    title.value = 'SAVVICE Corporation — Equipment Tracking Report';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 35;

    // Period row
    ws.mergeCells(2, 1, 2, 4 + dates.length + 4);
    const periodCell = ws.getCell(2, 1);
    periodCell.value = `Period: ${date_from} to ${date_to}`;
    periodCell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Column headers
    const headers = ['Equipment Name', 'Body No.', 'Category', 'Assignment',
      ...dates.map(d => { const dt = new Date(d); return (dt.getMonth()+1)+'/'+dt.getDate(); }),
      'Deployed', 'Standby', 'Breakdown', 'Maintenance'];
    const hr = ws.getRow(3);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Status colors
    const statusColors = {
      deployed: 'FF16A34A',   // green
      standby: 'FF2563EB',    // blue
      breakdown: 'FFDC2626',  // red
      maintenance: 'FFF59E0B' // yellow
    };

    const statusLabels = {
      deployed: 'D',
      standby: 'S',
      breakdown: 'B',
      maintenance: 'M'
    };

    // Data rows
    equipment.forEach((eq, idx) => {
      const row = ws.getRow(idx + 4);
      row.getCell(1).value = eq.equipment_name;
      row.getCell(2).value = eq.body_no || '-';
      row.getCell(3).value = eq.category;
      row.getCell(4).value = eq.assignment || '-';

      let deployed = 0, standby = 0, breakdown = 0, maintenance = 0;
      dates.forEach((date, di) => {
        const track = trackMap[eq.id + '_' + date];
        const status = track ? track.status : null;
        const c = row.getCell(5 + di);

        if (status) {
          c.value = statusLabels[status] || '-';
          c.alignment = { horizontal: 'center' };
          c.font = { color: { argb: statusColors[status] || 'FF000000' }, bold: true };
          if (status === 'deployed') deployed++;
          else if (status === 'standby') standby++;
          else if (status === 'breakdown') breakdown++;
          else if (status === 'maintenance') maintenance++;
        } else {
          c.value = '-';
          c.alignment = { horizontal: 'center' };
          c.font = { color: { argb: 'FF9CA3AF' } };
        }
      });

      row.getCell(5 + dates.length).value = deployed;
      row.getCell(6 + dates.length).value = standby;
      row.getCell(7 + dates.length).value = breakdown;
      row.getCell(8 + dates.length).value = maintenance;

      // Alternating row backgrounds
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
      for (let c = 1; c <= headers.length; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      }
    });

    // Set column widths
    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 18;
    ws.getColumn(4).width = 18;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="equipment_tracking_${date_from}_${date_to}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Equipment tracking export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
