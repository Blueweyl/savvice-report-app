const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Auth middleware that also supports ?token= query param (for exports)
function authenticateBilling(req, res, next) {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }
  if (!token && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/billing/equipment — list all equipment
router.get('/equipment', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM billing_equipment WHERE is_active = true ORDER BY category, id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching billing equipment:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/manpower — list all manpower, optional ?team= and ?billing_group= filter
router.get('/manpower', authenticate, requireAdmin, async (req, res) => {
  try {
    let sql = 'SELECT * FROM billing_manpower WHERE is_active = true';
    const params = [];
    if (req.query.team) {
      params.push(req.query.team);
      sql += ` AND team = $${params.length}`;
    }
    if (req.query.billing_group) {
      params.push(req.query.billing_group);
      sql += ` AND billing_group = $${params.length}`;
    }
    sql += ' ORDER BY billing_group, team, id';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching billing manpower:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/records — save monthly billing records (days_used per item)
// Body: { records: [{ billing_type, reference_id, billing_month, billing_year, days_used, remarks }] }
router.post('/records', authenticate, requireAdmin, async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'records array is required' });
    }

    for (const rec of records) {
      // Calculate amount based on daily_rate * days_used
      let dailyRate = 0;
      if (rec.billing_type === 'equipment') {
        const eq = await pool.query('SELECT daily_rate FROM billing_equipment WHERE id = $1', [rec.reference_id]);
        if (eq.rows.length > 0) dailyRate = parseFloat(eq.rows[0].daily_rate);
      } else if (rec.billing_type === 'manpower') {
        const mp = await pool.query('SELECT daily_rate FROM billing_manpower WHERE id = $1', [rec.reference_id]);
        if (mp.rows.length > 0) dailyRate = parseFloat(mp.rows[0].daily_rate);
      }
      const amount = dailyRate * (parseFloat(rec.days_used) || 0);

      await pool.query(
        `INSERT INTO billing_records (billing_type, reference_id, billing_month, billing_year, days_used, amount, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (billing_type, reference_id, billing_month, billing_year)
         DO UPDATE SET days_used = $5, amount = $6, remarks = $7`,
        [rec.billing_type, rec.reference_id, rec.billing_month, rec.billing_year, rec.days_used || 0, amount, rec.remarks || '']
      );
    }

    res.json({ success: true, count: records.length });
  } catch (err) {
    console.error('Error saving billing records:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/records?month=5&year=2026 — get saved records for a month
router.get('/records', authenticate, requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }
    const result = await pool.query(
      'SELECT * FROM billing_records WHERE billing_month = $1 AND billing_year = $2',
      [month, year]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching billing records:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/auto-days?month=5&year=2026 — auto-calculated days from attendance for each billing_manpower person
router.get('/auto-days', authenticate, requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    const result = await pool.query(`
      SELECT bm.id as billing_manpower_id, bm.name, bm.daily_rate,
        COALESCE((
          SELECT COUNT(*) FROM attendance a
          JOIN manpower m ON a.manpower_id = m.id
          WHERE LOWER(TRIM(m.name)) = LOWER(TRIM(bm.name))
          AND a.status = 'present'
          AND EXTRACT(MONTH FROM a.attendance_date) = $1
          AND EXTRACT(YEAR FROM a.attendance_date) = $2
        ), 0)::int as days_present
      FROM billing_manpower bm
      WHERE bm.is_active = true
      ORDER BY bm.team, bm.id
    `, [month, year]);

    const rows = result.rows.map(r => ({
      billing_manpower_id: r.billing_manpower_id,
      name: r.name,
      days_present: r.days_present,
      daily_rate: parseFloat(r.daily_rate),
      auto_amount: parseFloat((r.days_present * parseFloat(r.daily_rate)).toFixed(2)),
    }));

    res.json(rows);
  } catch (err) {
    console.error('Error fetching auto-days from attendance:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/summary?month=5&year=2026 — calculate billing summary
router.get('/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    // Get equipment items with their billing records
    const equipResult = await pool.query(`
      SELECT e.*, COALESCE(br.days_used, 0) as days_used, COALESCE(br.amount, 0) as amount
      FROM billing_equipment e
      LEFT JOIN billing_records br ON br.billing_type = 'equipment'
        AND br.reference_id = e.id
        AND br.billing_month = $1
        AND br.billing_year = $2
      WHERE e.is_active = true
      ORDER BY e.category, e.id
    `, [month, year]);

    // Get manpower items with their billing records AND auto-calculated attendance days
    const mpResult = await pool.query(`
      SELECT m.*, COALESCE(br.days_used, 0) as days_used, COALESCE(br.amount, 0) as amount,
        COALESCE((
          SELECT COUNT(*) FROM attendance a
          JOIN manpower mp ON a.manpower_id = mp.id
          WHERE LOWER(TRIM(mp.name)) = LOWER(TRIM(m.name))
          AND a.status = 'present'
          AND EXTRACT(MONTH FROM a.attendance_date) = $1
          AND EXTRACT(YEAR FROM a.attendance_date) = $2
        ), 0)::int as attendance_days
      FROM billing_manpower m
      LEFT JOIN billing_records br ON br.billing_type = 'manpower'
        AND br.reference_id = m.id
        AND br.billing_month = $1
        AND br.billing_year = $2
      WHERE m.is_active = true
      ORDER BY m.team, m.id
    `, [month, year]);

    const equipmentItems = equipResult.rows;
    const manpowerItems = mpResult.rows;

    // Calculate totals
    const equipmentTotal = equipmentItems.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const manpowerTotal = manpowerItems.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);

    const subTotalA = equipmentTotal + manpowerTotal; // Direct Resources
    const gaOverhead = subTotalA * 0.15; // 15% G&A Overhead
    const profit = (subTotalA + gaOverhead) * 0.10; // 10% Profit
    const vat = (subTotalA + gaOverhead + profit) * 0.12; // 12% VAT
    const grandTotal = subTotalA + gaOverhead + profit + vat;

    res.json({
      month: parseInt(month),
      year: parseInt(year),
      equipment: equipmentItems,
      manpower: manpowerItems,
      totals: {
        equipmentTotal: parseFloat(equipmentTotal.toFixed(2)),
        manpowerTotal: parseFloat(manpowerTotal.toFixed(2)),
        subTotalA: parseFloat(subTotalA.toFixed(2)),
        gaOverhead: parseFloat(gaOverhead.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        vat: parseFloat(vat.toFixed(2)),
        grandTotal: parseFloat(grandTotal.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('Error calculating billing summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/export?month=5&year=2026 — Excel export of billing
router.get('/export', authenticateBilling, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    // Fetch data
    const equipResult = await pool.query(`
      SELECT e.*, COALESCE(br.days_used, 0) as days_used, COALESCE(br.amount, 0) as amount
      FROM billing_equipment e
      LEFT JOIN billing_records br ON br.billing_type = 'equipment'
        AND br.reference_id = e.id
        AND br.billing_month = $1
        AND br.billing_year = $2
      WHERE e.is_active = true
      ORDER BY e.category, e.id
    `, [month, year]);

    const mpResult = await pool.query(`
      SELECT m.*, COALESCE(br.days_used, 0) as days_used, COALESCE(br.amount, 0) as amount
      FROM billing_manpower m
      LEFT JOIN billing_records br ON br.billing_type = 'manpower'
        AND br.reference_id = m.id
        AND br.billing_month = $1
        AND br.billing_year = $2
      WHERE m.is_active = true
      ORDER BY m.team, m.id
    `, [month, year]);

    const equipmentItems = equipResult.rows;
    const manpowerItems = mpResult.rows;

    const equipmentTotal = equipmentItems.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const manpowerTotal = manpowerItems.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
    const subTotalA = equipmentTotal + manpowerTotal;
    const gaOverhead = subTotalA * 0.15;
    const profit = (subTotalA + gaOverhead) * 0.10;
    const vat = (subTotalA + gaOverhead + profit) * 0.12;
    const grandTotal = subTotalA + gaOverhead + profit + vat;

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Savvice RM System';
    workbook.created = new Date();

    // ── Equipment Sheet ──
    const eqSheet = workbook.addWorksheet('Equipment Billing');
    eqSheet.mergeCells('A1:J1');
    const eqTitle = eqSheet.getCell('A1');
    eqTitle.value = `SAVVICE Corporation - Bridge Department Equipment Billing | ${monthNames[parseInt(month)]} ${year}`;
    eqTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    eqTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    eqTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    eqSheet.getRow(1).height = 36;

    const eqHeaders = ['Category', 'Equipment Name', 'Body No.', 'Assignment', 'Unit', 'Unit Rate', 'Contracted Qty', 'Daily Rate', 'Days Used', 'Amount'];
    const eqHeaderRow = eqSheet.getRow(2);
    eqHeaders.forEach((h, i) => {
      const cell = eqHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    eqHeaderRow.height = 24;

    const eqColWidths = [16, 30, 14, 18, 8, 14, 14, 14, 12, 14];
    eqColWidths.forEach((w, i) => { eqSheet.getColumn(i + 1).width = w; });

    equipmentItems.forEach((eq, idx) => {
      const row = eqSheet.getRow(idx + 3);
      row.getCell(1).value = eq.category;
      row.getCell(2).value = eq.equipment_name;
      row.getCell(3).value = eq.body_no;
      row.getCell(4).value = eq.assignment;
      row.getCell(5).value = eq.unit;
      row.getCell(6).value = parseFloat(eq.unit_rate);
      row.getCell(7).value = parseFloat(eq.contracted_qty);
      row.getCell(8).value = parseFloat(eq.daily_rate);
      row.getCell(9).value = parseFloat(eq.days_used);
      row.getCell(10).value = parseFloat(eq.amount);
      // Number format
      [6, 8, 10].forEach(c => { row.getCell(c).numFmt = '#,##0.00'; });
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFFFDE7';
      for (let c = 1; c <= 10; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        row.getCell(c).border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      }
    });

    // Equipment total row
    const eqTotalRow = eqSheet.getRow(equipmentItems.length + 3);
    eqTotalRow.getCell(1).value = 'EQUIPMENT TOTAL';
    eqTotalRow.getCell(1).font = { bold: true };
    eqTotalRow.getCell(10).value = equipmentTotal;
    eqTotalRow.getCell(10).numFmt = '#,##0.00';
    eqTotalRow.getCell(10).font = { bold: true };

    // ── Manpower Sheet ──
    const mpSheet = workbook.addWorksheet('Manpower Billing');
    mpSheet.mergeCells('A1:G1');
    const mpTitle = mpSheet.getCell('A1');
    mpTitle.value = `SAVVICE Corporation - Bridge Department Manpower Billing | ${monthNames[parseInt(month)]} ${year}`;
    mpTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    mpTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    mpTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    mpSheet.getRow(1).height = 36;

    const mpHeaders = ['Team', 'Position', 'Name', 'Description', 'Daily Rate', 'Days Used', 'Amount'];
    const mpHeaderRow = mpSheet.getRow(2);
    mpHeaders.forEach((h, i) => {
      const cell = mpHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    mpHeaderRow.height = 24;

    const mpColWidths = [18, 16, 28, 36, 14, 12, 14];
    mpColWidths.forEach((w, i) => { mpSheet.getColumn(i + 1).width = w; });

    manpowerItems.forEach((mp, idx) => {
      const row = mpSheet.getRow(idx + 3);
      row.getCell(1).value = mp.team;
      row.getCell(2).value = mp.position;
      row.getCell(3).value = mp.name;
      row.getCell(4).value = mp.description;
      row.getCell(5).value = parseFloat(mp.daily_rate);
      row.getCell(6).value = parseFloat(mp.days_used);
      row.getCell(7).value = parseFloat(mp.amount);
      [5, 7].forEach(c => { row.getCell(c).numFmt = '#,##0.00'; });
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFFFDE7';
      for (let c = 1; c <= 7; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        row.getCell(c).border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      }
    });

    const mpTotalRow = mpSheet.getRow(manpowerItems.length + 3);
    mpTotalRow.getCell(1).value = 'MANPOWER TOTAL';
    mpTotalRow.getCell(1).font = { bold: true };
    mpTotalRow.getCell(7).value = manpowerTotal;
    mpTotalRow.getCell(7).numFmt = '#,##0.00';
    mpTotalRow.getCell(7).font = { bold: true };

    // ── Summary Sheet ──
    const sumSheet = workbook.addWorksheet('Billing Summary');
    sumSheet.mergeCells('A1:C1');
    const sumTitle = sumSheet.getCell('A1');
    sumTitle.value = `SAVVICE Corporation - Bridge Billing Summary | ${monthNames[parseInt(month)]} ${year}`;
    sumTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sumSheet.getRow(1).height = 36;

    sumSheet.getColumn(1).width = 40;
    sumSheet.getColumn(2).width = 20;
    sumSheet.getColumn(3).width = 20;

    const summaryData = [
      ['Description', 'Amount', ''],
      ['A.1 Equipment', equipmentTotal, ''],
      ['A.2 Manpower', manpowerTotal, ''],
      ['Sub-total A (Direct Resources)', subTotalA, ''],
      ['B. General & Admin Overhead (15%)', gaOverhead, ''],
      ['C. Profit (10%)', profit, ''],
      ['D. VAT (12%)', vat, ''],
      ['GRAND TOTAL', grandTotal, ''],
    ];

    summaryData.forEach((row, idx) => {
      const r = sumSheet.getRow(idx + 2);
      r.getCell(1).value = row[0];
      r.getCell(2).value = row[1];
      if (idx === 0) {
        r.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        r.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      } else {
        r.getCell(2).numFmt = '#,##0.00';
        if (idx === summaryData.length - 1) {
          r.getCell(1).font = { bold: true, size: 12 };
          r.getCell(2).font = { bold: true, size: 12 };
          r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
          r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
        } else if (idx === 3) {
          r.getCell(1).font = { bold: true };
          r.getCell(2).font = { bold: true };
        }
      }
      r.getCell(1).border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      r.getCell(2).border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    });

    const filename = `billing_${monthNames[parseInt(month)]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Billing export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
