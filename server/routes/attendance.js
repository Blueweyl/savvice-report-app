const express = require('express');
const ExcelJS = require('exceljs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

function authenticateFlexible(req, res, next) {
  let token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}

router.get('/manpower', authenticate, async (req, res) => {
  try {
    const { area } = req.query;
    let q = 'SELECT * FROM manpower WHERE is_active = true';
    const p = [];
    if (area) { p.push(area); q += ` AND designated_area = $${p.length}`; }
    q += ' ORDER BY name';
    res.json((await pool.query(q, p)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/areas', authenticate, async (req, res) => {
  try {
    const r = await pool.query('SELECT DISTINCT designated_area FROM manpower WHERE is_active = true ORDER BY designated_area');
    res.json(r.rows.map(r => r.designated_area));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { date, area } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    let q = `SELECT m.id as manpower_id, m.name, m.position, m.designated_area,
             COALESCE(a.status, 'absent') as status, a.remarks
             FROM manpower m LEFT JOIN attendance a ON m.id = a.manpower_id AND a.attendance_date = $1
             WHERE m.is_active = true`;
    const p = [date];
    if (area) { p.push(area); q += ` AND m.designated_area = $${p.length}`; }
    q += ' ORDER BY m.name';
    res.json((await pool.query(q, p)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { date, entries } = req.body;
    if (!date || !entries) return res.status(400).json({ error: 'date and entries required' });
    for (const e of entries) {
      await pool.query(
        `INSERT INTO attendance (manpower_id, attendance_date, status, remarks)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (manpower_id, attendance_date) DO UPDATE SET status = $3, remarks = $4`,
        [e.manpower_id, date, e.status || 'absent', e.remarks || null]
      );
    }
    res.json({ message: 'Saved', count: entries.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/summary', authenticate, async (req, res) => {
  try {
    const { date_from, date_to, area } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' });
    let q = `SELECT m.name, m.position, m.designated_area,
             COUNT(CASE WHEN a.status = 'present' THEN 1 END)::int as total_present,
             COUNT(CASE WHEN a.status = 'absent' THEN 1 END)::int as total_absent,
             COUNT(CASE WHEN a.status = 'leave' THEN 1 END)::int as total_leave,
             COUNT(CASE WHEN a.status = 'rest_day' THEN 1 END)::int as total_rest_day
             FROM manpower m LEFT JOIN attendance a ON m.id = a.manpower_id
             AND a.attendance_date BETWEEN $1 AND $2
             WHERE m.is_active = true`;
    const p = [date_from, date_to];
    if (area) { p.push(area); q += ` AND m.designated_area = $${p.length}`; }
    q += ' GROUP BY m.id, m.name, m.position, m.designated_area ORDER BY m.name';
    res.json((await pool.query(q, p)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/export', authenticateFlexible, async (req, res) => {
  try {
    const { date_from, date_to, area } = req.query;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' });

    // Get manpower
    let mq = 'SELECT * FROM manpower WHERE is_active = true';
    const mp = [];
    if (area) { mp.push(area); mq += ` AND designated_area = $${mp.length}`; }
    mq += ' ORDER BY name';
    const manpower = (await pool.query(mq, mp)).rows;

    // Get attendance
    let aq = `SELECT manpower_id, attendance_date, status FROM attendance WHERE attendance_date BETWEEN $1 AND $2`;
    const ap = [date_from, date_to];
    if (area) {
      aq += ` AND manpower_id IN (SELECT id FROM manpower WHERE designated_area = $3)`;
      ap.push(area);
    }
    const attendance = (await pool.query(aq, ap)).rows;
    const attMap = {};
    attendance.forEach(a => { attMap[a.manpower_id + '_' + a.attendance_date.toISOString().split('T')[0]] = a.status; });

    // Generate dates
    const dates = [];
    const d = new Date(date_from);
    const end = new Date(date_to);
    while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance');

    // Header
    ws.mergeCells(1, 1, 1, 3 + dates.length + 2);
    const title = ws.getCell(1, 1);
    title.value = 'SAVVICE Corporation — Manpower Attendance Report';
    title.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 35;

    // Column headers
    const headers = ['Name', 'Position', 'Area', ...dates.map(d => { const dt = new Date(d); return (dt.getMonth()+1)+'/'+dt.getDate(); }), 'Present', 'Absent'];
    const hr = ws.getRow(2);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Data
    manpower.forEach((m, idx) => {
      const row = ws.getRow(idx + 3);
      row.getCell(1).value = m.name;
      row.getCell(2).value = m.position;
      row.getCell(3).value = m.designated_area;
      let present = 0, absent = 0;
      dates.forEach((date, di) => {
        const st = attMap[m.id + '_' + date] || 'absent';
        const c = row.getCell(4 + di);
        c.value = st === 'present' ? 'P' : st === 'leave' ? 'L' : st === 'rest_day' ? 'R' : 'A';
        c.alignment = { horizontal: 'center' };
        if (st === 'present') { present++; c.font = { color: { argb: 'FF16A34A' }, bold: true }; }
        else if (st === 'absent') { c.font = { color: { argb: 'FFDC2626' } }; absent++; }
      });
      row.getCell(4 + dates.length).value = present;
      row.getCell(5 + dates.length).value = absent;
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';
      for (let c = 1; c <= headers.length; c++) { row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; }
    });

    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 20;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${date_from}_${date_to}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
