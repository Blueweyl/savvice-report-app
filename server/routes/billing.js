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
    const gaOverhead = subTotalA * 0.11; // 11% G&A Overhead
    const profit = subTotalA * 0.15; // 15% Profit
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

    // Fetch equipment with billing records
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

    // Fetch manpower with billing records AND attendance days
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
      ORDER BY m.billing_group, m.team, m.id
    `, [month, year]);

    // Fetch materials billing records
    const matResult = await pool.query(`
      SELECT * FROM billing_records
      WHERE billing_type = 'materials'
        AND billing_month = $1
        AND billing_year = $2
    `, [month, year]);

    const equipmentItems = equipResult.rows;
    const manpowerItems = mpResult.rows;
    const materialRecords = matResult.rows;

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month)];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Savvice RM System';
    workbook.created = new Date();

    // ── Style helpers ──
    const darkBlue = 'FF1E3A5F';
    const blue = 'FF2563EB';
    const whiteFont = { color: { argb: 'FFFFFFFF' } };
    const numFmt2 = '#,##0.00';
    const thinBorder = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
    const allBorder = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    };

    function applyHeaderFill(cell, bgColor) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    }
    function setNum(cell, val) {
      cell.value = val;
      cell.numFmt = numFmt2;
    }
    function setBorderedRow(row, colStart, colEnd) {
      for (let c = colStart; c <= colEnd; c++) {
        row.getCell(c).border = allBorder;
      }
    }

    // ── Equipment Sheet (unchanged) ──
    const eqSheet = workbook.addWorksheet('Equipment Billing');
    eqSheet.mergeCells('A1:J1');
    const eqTitle = eqSheet.getCell('A1');
    eqTitle.value = `SAVVICE Corporation - Bridge Department Equipment Billing | ${monthName} ${year}`;
    eqTitle.font = { size: 14, bold: true, ...whiteFont };
    applyHeaderFill(eqTitle, darkBlue);
    eqTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    eqSheet.getRow(1).height = 36;

    const eqHeaders = ['Category', 'Equipment Name', 'Body No.', 'Assignment', 'Unit', 'Unit Rate', 'Contracted Qty', 'Daily Rate', 'Days Used', 'Amount'];
    const eqHeaderRow = eqSheet.getRow(2);
    eqHeaders.forEach((h, i) => {
      const cell = eqHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, ...whiteFont, size: 10 };
      applyHeaderFill(cell, blue);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    eqHeaderRow.height = 24;

    [16, 30, 14, 18, 8, 14, 14, 14, 12, 14].forEach((w, i) => { eqSheet.getColumn(i + 1).width = w; });

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
      [6, 8, 10].forEach(c => { row.getCell(c).numFmt = numFmt2; });
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFFFDE7';
      for (let c = 1; c <= 10; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        row.getCell(c).border = thinBorder;
      }
    });

    const equipmentTotal = equipmentItems.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const eqTotalRow = eqSheet.getRow(equipmentItems.length + 3);
    eqTotalRow.getCell(1).value = 'EQUIPMENT TOTAL';
    eqTotalRow.getCell(1).font = { bold: true };
    eqTotalRow.getCell(10).value = equipmentTotal;
    eqTotalRow.getCell(10).numFmt = numFmt2;
    eqTotalRow.getCell(10).font = { bold: true };

    // ── Manpower Sheet (unchanged) ──
    const mpSheet = workbook.addWorksheet('Manpower Billing');
    mpSheet.mergeCells('A1:G1');
    const mpTitle = mpSheet.getCell('A1');
    mpTitle.value = `SAVVICE Corporation - Bridge Department Manpower Billing | ${monthName} ${year}`;
    mpTitle.font = { size: 14, bold: true, ...whiteFont };
    applyHeaderFill(mpTitle, darkBlue);
    mpTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    mpSheet.getRow(1).height = 36;

    const mpHeaders = ['Team', 'Position', 'Name', 'Description', 'Daily Rate', 'Days Used', 'Amount'];
    const mpHeaderRow = mpSheet.getRow(2);
    mpHeaders.forEach((h, i) => {
      const cell = mpHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, ...whiteFont, size: 10 };
      applyHeaderFill(cell, blue);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    mpHeaderRow.height = 24;

    [18, 16, 28, 36, 14, 12, 14].forEach((w, i) => { mpSheet.getColumn(i + 1).width = w; });

    const manpowerTotal = manpowerItems.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
    manpowerItems.forEach((mp, idx) => {
      const row = mpSheet.getRow(idx + 3);
      row.getCell(1).value = mp.team;
      row.getCell(2).value = mp.position;
      row.getCell(3).value = mp.name;
      row.getCell(4).value = mp.description;
      row.getCell(5).value = parseFloat(mp.daily_rate);
      row.getCell(6).value = parseFloat(mp.days_used);
      row.getCell(7).value = parseFloat(mp.amount);
      [5, 7].forEach(c => { row.getCell(c).numFmt = numFmt2; });
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFFFDE7';
      for (let c = 1; c <= 7; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        row.getCell(c).border = thinBorder;
      }
    });

    const mpTotalRow = mpSheet.getRow(manpowerItems.length + 3);
    mpTotalRow.getCell(1).value = 'MANPOWER TOTAL';
    mpTotalRow.getCell(1).font = { bold: true };
    mpTotalRow.getCell(7).value = manpowerTotal;
    mpTotalRow.getCell(7).numFmt = numFmt2;
    mpTotalRow.getCell(7).font = { bold: true };

    // ═══════════════════════════════════════════════════════════════
    // ── SHEET: SUMMARY — matches "SUMMARY (2)" from original ──
    // ═══════════════════════════════════════════════════════════════
    const sumSheet = workbook.addWorksheet('SUMMARY');

    // Column widths: B=30, C=8, D=14, E=12, F=16, G=14, H=14, I=16, J=14, K=18, L=18
    sumSheet.getColumn(1).width = 4;   // A (spacer)
    sumSheet.getColumn(2).width = 34;  // B Description
    sumSheet.getColumn(3).width = 8;   // C Unit
    sumSheet.getColumn(4).width = 14;  // D Unit Rate
    sumSheet.getColumn(5).width = 12;  // E CONTRACTED
    sumSheet.getColumn(6).width = 16;  // F Amount
    sumSheet.getColumn(7).width = 16;  // G ACTUAL DEPLOYMENT
    sumSheet.getColumn(8).width = 16;  // H No. of Days Breakdown
    sumSheet.getColumn(9).width = 16;  // I MONTHLY RATE
    sumSheet.getColumn(10).width = 14; // J DAILY RATE
    sumSheet.getColumn(11).width = 20; // K TOTAL AMOUNT (ACTUAL)
    sumSheet.getColumn(12).width = 20; // L TOTAL AMOUNT (DAYS BREAKDOWN)

    // Helper: build a lookup of equipment by name for days_used
    const eqByName = {};
    for (const eq of equipmentItems) {
      eqByName[eq.equipment_name] = eq;
    }

    // Helper: sum attendance_days for manpower by team+position type
    // Group manpower items by billing_group and position category
    function getManpowerGroup(billingGroup, positionFilter) {
      return manpowerItems.filter(m => {
        const grp = (m.billing_group || '').toLowerCase();
        const pos = (m.position || '').toLowerCase();
        if (billingGroup === 'rm') {
          return grp.includes('bridge rm') && ['admin', 'routine maintenance'].includes((m.team || '').toLowerCase());
        }
        if (billingGroup === 'epoxy') {
          return grp.includes('bridge rm') && (m.team || '').toLowerCase().startsWith('epoxy');
        }
        if (billingGroup === 'seg10') {
          return grp.includes('segment 10');
        }
        return false;
      }).filter(m => {
        if (!positionFilter) return true;
        const pos = (m.position || '').toLowerCase();
        if (positionFilter === 'supervisor') return pos === 'supervisor';
        if (positionFilter === 'admin') return pos === 'admin assistant';
        if (positionFilter === 'warehouse') return pos === 'warehouse man';
        if (positionFilter === 'driver') return pos.includes('driver');
        if (positionFilter === 'skilled') return pos === 'skilled';
        if (positionFilter === 'crew') return pos === 'crew';
        return false;
      });
    }

    function sumDaysUsed(items) {
      return items.reduce((s, m) => s + parseFloat(m.days_used || 0), 0);
    }
    function sumAttendanceDays(items) {
      return items.reduce((s, m) => s + parseInt(m.attendance_days || 0, 10), 0);
    }

    // Row 7: Title
    sumSheet.mergeCells('B7:L7');
    const sumTitleCell = sumSheet.getCell('B7');
    sumTitleCell.value = 'NLEX CORP. - ROUTINE MAINTENANCE (BRIDGE)';
    sumTitleCell.font = { size: 14, bold: true, ...whiteFont };
    applyHeaderFill(sumTitleCell, darkBlue);
    sumTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sumSheet.getRow(7).height = 30;

    // Row 8: Period
    sumSheet.mergeCells('B8:L8');
    const sumPeriod = sumSheet.getCell('B8');
    sumPeriod.value = `PERIOD: ${monthName.toUpperCase()} 01-31, ${year}`;
    sumPeriod.font = { size: 11, bold: true, ...whiteFont };
    applyHeaderFill(sumPeriod, darkBlue);
    sumPeriod.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 9-10: Headers (merged vertically for some)
    const sumHeaders = [
      { col: 2, label: 'Description', width: 1 },
      { col: 3, label: 'Unit', width: 1 },
      { col: 4, label: 'Unit Rate', width: 1 },
      { col: 5, label: 'CONTRACTED', width: 1 },
      { col: 6, label: 'Amount', width: 1 },
      { col: 7, label: 'ACTUAL\nDEPLOYMENT', width: 1 },
      { col: 8, label: 'No. of Days\nBreakdown', width: 1 },
      { col: 9, label: 'MONTHLY\nRATE', width: 1 },
      { col: 10, label: 'DAILY\nRATE', width: 1 },
      { col: 11, label: 'TOTAL AMOUNT\n(ACTUAL)', width: 1 },
      { col: 12, label: 'TOTAL AMOUNT\n(DAYS BREAKDOWN)', width: 1 },
    ];

    // Merge rows 9-10 for headers
    sumHeaders.forEach(h => {
      sumSheet.mergeCells(9, h.col, 10, h.col);
      const cell = sumSheet.getCell(9, h.col);
      cell.value = h.label;
      cell.font = { bold: true, size: 9, ...whiteFont };
      applyHeaderFill(cell, blue);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = allBorder;
    });
    sumSheet.getRow(9).height = 20;
    sumSheet.getRow(10).height = 20;

    // ── SUMMARY DATA ROWS ──
    // Equipment items with their hardcoded layout
    // We define each row as: [description, unit, unitRate, contracted, dailyRate, equipmentKey]
    // equipmentKey maps to equipmentItems by equipment_name

    const summaryEquipment = [
      // A.1 Equipment and Vehicles (Service Vehicles only)
      { name: 'Service Vehicle RM', unit: 'nos.', unitRate: 120252.98, contracted: 1, dailyRate: 4610.34, eqKey: 'Service Vehicle (RM)' },
      { name: 'Service Vehicle EPOXY', unit: 'nos.', unitRate: 120252.98, contracted: 2, dailyRate: 4610.34, eqKey: 'Service Vehicle (EPOXY)' },
      { name: 'Service Vehicle SEG10', unit: 'nos.', unitRate: 131224.24, contracted: 1, dailyRate: 5030.96, eqKey: 'Service Vehicle (SEGMENT 10)' },
    ];

    const summaryMinorEquip = {
      'Vegetation Control': [
        { name: 'Grass Cutter RM', unit: 'nos.', unitRate: 24585, contracted: 1, dailyRate: 942.56, eqKey: 'Grass Cutter (RM)' },
        { name: 'Grass Cutter SEG10', unit: 'nos.', unitRate: 24585, contracted: 1, dailyRate: 942.56, eqKey: 'Grass Cutter (SEG10)' },
      ],
      'Cleaning Tools': [
        { name: 'Pressure washer RM', unit: 'nos.', unitRate: 6063.99, contracted: 1, dailyRate: 232.49, eqKey: 'Pressure washer (RM)' },
        { name: 'Pressure washer SEG10', unit: 'nos.', unitRate: 6063.99, contracted: 1, dailyRate: 232.49, eqKey: 'Pressure washer (SEG10)' },
      ],
      'Bridge (Epoxy Injection)': [
        { name: 'Genset Optimax 5kva', unit: 'nos.', unitRate: 13268.85, contracted: 2, dailyRate: 508.71, eqKey: 'Genset Optimax 5kva' },
        { name: 'Wagner Epoxy injection pump', unit: 'nos.', unitRate: 8980.16, contracted: 2, dailyRate: 344.29, eqKey: 'Wagner Epoxy injection pump' },
        { name: 'Bosch Grinder GWS060', unit: 'nos.', unitRate: 540.18, contracted: 3, dailyRate: 20.71, eqKey: 'Bosch Grinder GWS060' },
        { name: 'Bosch Blower', unit: 'nos.', unitRate: 646.58, contracted: 2, dailyRate: 24.79, eqKey: 'Bosch Blower' },
        { name: 'Bosch Rotary drill GBH2-24 RE', unit: 'nos.', unitRate: 2578.13, contracted: 3, dailyRate: 98.84, eqKey: 'Bosch Rotary drill GBH2-24 RE' },
      ],
    };

    // Materials data (fixed rates from original)
    const summaryMaterials = [
      { name: 'TamRez 220', unit: 'kgs', unitRate: 2228.13, contracted: 0, dailyRate: 0 },
      { name: 'Kalsomine powder', unit: 'kgs', unitRate: 256.69, contracted: 0, dailyRate: 0 },
      { name: 'Aluminum tube 6mm', unit: 'pcs', unitRate: 5719.19, contracted: 0, dailyRate: 0 },
    ];

    // Manpower definitions for summary sheet
    const summaryManpowerRM = [
      { name: 'Supervisor', unit: 'man', unitRate: 37022.87, contracted: 0.33, dailyRate: 468.40, filter: 'supervisor', group: 'rm' },
      { name: 'Admin assistant', unit: 'man', unitRate: 23855.11, contracted: 0.17, dailyRate: 152.43, filter: 'admin', group: 'rm' },
      { name: 'Warehouse man', unit: 'man', unitRate: 24855.26, contracted: 0.25, dailyRate: 238.23, filter: 'warehouse', group: 'rm' },
      { name: 'Driver', unit: 'man', unitRate: 28211.75, contracted: 1, dailyRate: 1081.60, filter: 'driver', group: 'rm' },
      { name: 'Skilled labor', unit: 'man', unitRate: 21205.08, contracted: 2, dailyRate: 812.97, filter: 'skilled', group: 'rm' },
      { name: 'Non-Skilled labor', unit: 'man', unitRate: 19955.43, contracted: 6, dailyRate: 765.06, filter: 'crew', group: 'rm' },
    ];

    const summaryManpowerEpoxy = [
      { name: 'Driver', unit: 'man', unitRate: 28211.75, contracted: 2, dailyRate: 1081.60, filter: 'driver', group: 'epoxy' },
      { name: 'Skilled labor', unit: 'man', unitRate: 21205.08, contracted: 4, dailyRate: 812.97, filter: 'skilled', group: 'epoxy' },
      { name: 'Non-Skilled labor', unit: 'man', unitRate: 19955.43, contracted: 12, dailyRate: 765.06, filter: 'crew', group: 'epoxy' },
    ];

    const summaryManpowerSeg10 = [
      { name: 'Driver', unit: 'man', unitRate: 28211.75, contracted: 1, dailyRate: 1081.60, filter: 'driver', group: 'seg10' },
      { name: 'Skilled labor', unit: 'man', unitRate: 21205.08, contracted: 2, dailyRate: 952.92, filter: 'skilled', group: 'seg10' },
      { name: 'Non-Skilled labor', unit: 'man', unitRate: 19955.43, contracted: 6, dailyRate: 914.57, filter: 'crew', group: 'seg10' },
    ];

    // Helper: write a summary equipment row
    function writeSumEquipRow(sheet, rowNum, item) {
      const r = sheet.getRow(rowNum);
      const eq = eqByName[item.eqKey];
      const daysUsed = eq ? parseFloat(eq.days_used || 0) : 0;
      const attendDays = daysUsed; // equipment uses days_used for both columns
      const amount = item.unitRate * item.contracted;
      const actualAmount = item.unitRate * daysUsed;
      const daysAmount = item.dailyRate * attendDays;

      r.getCell(2).value = item.name;
      r.getCell(3).value = item.unit;
      setNum(r.getCell(4), item.unitRate);
      setNum(r.getCell(5), item.contracted);
      setNum(r.getCell(6), amount);
      setNum(r.getCell(7), daysUsed);
      setNum(r.getCell(8), attendDays);
      setNum(r.getCell(9), item.unitRate);
      setNum(r.getCell(10), item.dailyRate);
      setNum(r.getCell(11), actualAmount);
      setNum(r.getCell(12), daysAmount);
      setBorderedRow(r, 2, 12);

      return { amount, actualAmount, daysAmount };
    }

    // Helper: write a summary manpower row
    function writeSumManpowerRow(sheet, rowNum, item) {
      const r = sheet.getRow(rowNum);
      const group = getManpowerGroup(item.group, item.filter);
      const actualDeploy = sumDaysUsed(group);
      const daysBreakdown = sumAttendanceDays(group);
      const amount = item.unitRate * item.contracted;
      const actualAmount = item.unitRate * actualDeploy;
      const daysAmount = item.dailyRate * daysBreakdown;

      r.getCell(2).value = item.name;
      r.getCell(3).value = item.unit;
      setNum(r.getCell(4), item.unitRate);
      setNum(r.getCell(5), item.contracted);
      setNum(r.getCell(6), amount);
      setNum(r.getCell(7), actualDeploy);
      setNum(r.getCell(8), daysBreakdown);
      setNum(r.getCell(9), item.unitRate);
      setNum(r.getCell(10), item.dailyRate);
      setNum(r.getCell(11), actualAmount);
      setNum(r.getCell(12), daysAmount);
      setBorderedRow(r, 2, 12);

      return { amount, actualAmount, daysAmount };
    }

    // Helper: write section header
    function writeSumSectionHeader(sheet, rowNum, text) {
      const r = sheet.getRow(rowNum);
      r.getCell(2).value = text;
      r.getCell(2).font = { bold: true, size: 10 };
      setBorderedRow(r, 2, 12);
    }

    // Helper: write sub-header
    function writeSumSubHeader(sheet, rowNum, text) {
      const r = sheet.getRow(rowNum);
      r.getCell(2).value = text;
      r.getCell(2).font = { bold: true, italic: true, size: 9 };
      setBorderedRow(r, 2, 12);
    }

    // Helper: write totals row
    function writeSumTotalsRow(sheet, rowNum, label, totals) {
      const r = sheet.getRow(rowNum);
      r.getCell(2).value = label;
      r.getCell(2).font = { bold: true, size: 10 };
      setNum(r.getCell(6), totals.amount);
      r.getCell(6).font = { bold: true };
      setNum(r.getCell(11), totals.actualAmount);
      r.getCell(11).font = { bold: true };
      setNum(r.getCell(12), totals.daysAmount);
      r.getCell(12).font = { bold: true };
      setBorderedRow(r, 2, 12);
    }

    // Track totals
    let totalEquip = { amount: 0, actualAmount: 0, daysAmount: 0 };
    let totalManpower = { amount: 0, actualAmount: 0, daysAmount: 0 };
    let totalMaterials = { amount: 0, actualAmount: 0, daysAmount: 0 };

    function addTotals(target, source) {
      target.amount += source.amount;
      target.actualAmount += source.actualAmount;
      target.daysAmount += source.daysAmount;
    }

    // Use dynamic row counter starting at row 12
    let row = 12;

    // A.1 Equipment and Vehicles
    writeSumSectionHeader(sumSheet, row, 'A.1 Equipment and Vehicles');
    row++;
    for (const item of summaryEquipment) {
      const t = writeSumEquipRow(sumSheet, row, item);
      addTotals(totalEquip, t);
      row++;
    }

    // blank spacer row
    row++;

    // A.2 Minor Equipment and Power Tools
    writeSumSectionHeader(sumSheet, row, 'A.2 Minor Equipment and Power Tools');
    row++;

    const minorCategories = ['Vegetation Control', 'Cleaning Tools', 'Bridge (Epoxy Injection)'];
    for (const cat of minorCategories) {
      writeSumSubHeader(sumSheet, row, cat);
      row++;
      for (const item of summaryMinorEquip[cat]) {
        const t = writeSumEquipRow(sumSheet, row, item);
        addTotals(totalEquip, t);
        row++;
      }
    }

    // blank spacer row
    row++;

    // Sub-total of A (equipment)
    writeSumTotalsRow(sumSheet, row, 'Sub-total of A', totalEquip);
    row++;

    // blank spacer row
    row++;

    // B. Manpower
    writeSumSectionHeader(sumSheet, row, 'B. Manpower');
    row++;

    // blank spacer row
    row++;

    // ROUTINE MAINTENANCE
    writeSumSubHeader(sumSheet, row, 'ROUTINE MAINTENANCE');
    row++;
    for (const item of summaryManpowerRM) {
      const t = writeSumManpowerRow(sumSheet, row, item);
      addTotals(totalManpower, t);
      row++;
    }

    // blank spacer row
    row++;

    // BRIDGE EPOXY
    writeSumSubHeader(sumSheet, row, 'BRIDGE EPOXY');
    row++;
    for (const item of summaryManpowerEpoxy) {
      const t = writeSumManpowerRow(sumSheet, row, item);
      addTotals(totalManpower, t);
      row++;
    }

    // blank spacer row
    row++;

    // SEGMENT 10 / CONNECTOR
    writeSumSubHeader(sumSheet, row, 'SEGMENT 10 / CONNECTOR');
    row++;
    for (const item of summaryManpowerSeg10) {
      const t = writeSumManpowerRow(sumSheet, row, item);
      addTotals(totalManpower, t);
      row++;
    }

    // blank spacer row
    row++;

    // Sub-total of B
    writeSumTotalsRow(sumSheet, row, 'Sub-total of B', totalManpower);
    row++;

    // C. Materials
    writeSumSectionHeader(sumSheet, row, 'C. Materials');
    row++;

    // blank spacer row
    row++;

    // Materials rows
    let matIndex = 1;
    for (const mat of summaryMaterials) {
      const r = sumSheet.getRow(row);
      // Look up material billing record by matching reference_id
      const matRefId = matIndex;
      const matRec = materialRecords.find(mr => {
        return mr.reference_id === matRefId;
      });
      const daysUsed = matRec ? parseFloat(matRec.days_used || 0) : 0;
      const matAmount = mat.unitRate * daysUsed;

      r.getCell(2).value = mat.name;
      r.getCell(3).value = mat.unit;
      setNum(r.getCell(4), mat.unitRate);
      setNum(r.getCell(5), 0);
      setNum(r.getCell(6), 0);
      setNum(r.getCell(7), daysUsed);
      setNum(r.getCell(8), daysUsed);
      setNum(r.getCell(9), mat.unitRate);
      setNum(r.getCell(10), 0);
      setNum(r.getCell(11), matAmount);
      setNum(r.getCell(12), matAmount);
      setBorderedRow(r, 2, 12);

      totalMaterials.amount += 0;
      totalMaterials.actualAmount += matAmount;
      totalMaterials.daysAmount += matAmount;
      row++;
      matIndex++;
    }

    // blank spacer row
    row++;

    // Sub-total of C
    writeSumTotalsRow(sumSheet, row, 'Sub-total of C', totalMaterials);
    row++;

    // ── FULL BILLING COMPUTATION at bottom of SUMMARY sheet ──
    // blank spacer rows
    row += 2;

    // A. DIRECT RESOURCES = Sub-total A + Sub-total B + Sub-total C
    const directResources = {
      amount: totalEquip.amount + totalManpower.amount + totalMaterials.amount,
      actualAmount: totalEquip.actualAmount + totalManpower.actualAmount + totalMaterials.actualAmount,
      daysAmount: totalEquip.daysAmount + totalManpower.daysAmount + totalMaterials.daysAmount,
    };

    // E. G&A Overhead (11% of C)
    const gaOverhead = {
      amount: directResources.amount * 0.11,
      actualAmount: directResources.actualAmount * 0.11,
      daysAmount: directResources.daysAmount * 0.11,
    };

    // F. Profit (15% of C)
    const profit = {
      amount: directResources.amount * 0.15,
      actualAmount: directResources.actualAmount * 0.15,
      daysAmount: directResources.daysAmount * 0.15,
    };

    // D. VAT 12% of (A+B+C)
    const vat = {
      amount: (directResources.amount + gaOverhead.amount + profit.amount) * 0.12,
      actualAmount: (directResources.actualAmount + gaOverhead.actualAmount + profit.actualAmount) * 0.12,
      daysAmount: (directResources.daysAmount + gaOverhead.daysAmount + profit.daysAmount) * 0.12,
    };

    // GRAND TOTAL = A+B+C+D
    const grandTotal = {
      amount: directResources.amount + gaOverhead.amount + profit.amount + vat.amount,
      actualAmount: directResources.actualAmount + gaOverhead.actualAmount + profit.actualAmount + vat.actualAmount,
      daysAmount: directResources.daysAmount + gaOverhead.daysAmount + profit.daysAmount + vat.daysAmount,
    };

    const billingComputation = [
      { label: 'INDIRECT COST', totals: directResources },
      { label: 'E : General and administrative, Overhead, Contingencies and Miscellaneous (11%)', totals: gaOverhead },
      { label: 'F : Profit (15% of C)', totals: profit },
      { label: 'G : VAT (12% of C+E+F)', totals: vat },
      { label: 'TOTAL COST (monthly)', totals: grandTotal },
    ];

    billingComputation.forEach((item, idx) => {
      const r = sumSheet.getRow(row);
      r.getCell(2).value = item.label;
      r.getCell(2).font = { bold: true, size: idx === 4 ? 12 : 10 };
      setNum(r.getCell(6), item.totals.amount);
      r.getCell(6).font = { bold: true, size: idx === 4 ? 11 : 10 };
      setNum(r.getCell(11), item.totals.actualAmount);
      r.getCell(11).font = { bold: true, size: idx === 4 ? 11 : 10 };
      setNum(r.getCell(12), item.totals.daysAmount);
      r.getCell(12).font = { bold: true, size: idx === 4 ? 11 : 10 };
      if (idx === 4) {
        // Highlight GRAND TOTAL row
        for (let c = 2; c <= 12; c++) {
          applyHeaderFill(r.getCell(c), 'FFFFF9C4');
        }
      }
      setBorderedRow(r, 2, 12);
      row++;
    });

    // ═══════════════════════════════════════════════════════════════
    // ── SHEET: CA SUMMARY — matches "CA SUMMARY (2)" from original ──
    // ═══════════════════════════════════════════════════════════════
    const caSheet = workbook.addWorksheet('CA SUMMARY');

    // Column widths: A=4, B=30, C=12, D=12, E=14, F=14, G=14, H=18, I=18, J=18
    caSheet.getColumn(1).width = 4;
    caSheet.getColumn(2).width = 34;  // Resources
    caSheet.getColumn(3).width = 14;  // QTY Required
    caSheet.getColumn(4).width = 14;  // QTY Actual
    caSheet.getColumn(5).width = 16;  // Days Absent/Breakdown
    caSheet.getColumn(6).width = 16;  // Monthly Rate
    caSheet.getColumn(7).width = 14;  // Daily Rate
    caSheet.getColumn(8).width = 18;  // Total Amount Actual
    caSheet.getColumn(9).width = 18;  // Total Amount Absent
    caSheet.getColumn(10).width = 20; // Total Amount to be Billed

    // CA SUMMARY helpers
    function writeCASectionTitle(sheet, rowNum, text) {
      sheet.mergeCells(rowNum, 2, rowNum, 10);
      const cell = sheet.getCell(rowNum, 2);
      cell.value = text;
      cell.font = { size: 12, bold: true, ...whiteFont };
      applyHeaderFill(cell, darkBlue);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(rowNum).height = 28;
    }

    function writeCAHeaders(sheet, rowNum) {
      const headers = ['Resources', 'QTY Required', 'QTY Actual', 'Days Absent/\nBreakdown', 'Monthly Rate', 'Daily Rate', 'Total Amount\nActual', 'Total Amount\nAbsent', 'Total Amount\nto be Billed'];
      const r = sheet.getRow(rowNum);
      headers.forEach((h, i) => {
        const cell = r.getCell(i + 2);
        cell.value = h;
        cell.font = { bold: true, size: 9, ...whiteFont };
        applyHeaderFill(cell, blue);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = allBorder;
      });
      r.height = 30;
    }

    function writeCASubHeader(sheet, rowNum, text) {
      const r = sheet.getRow(rowNum);
      r.getCell(2).value = text;
      r.getCell(2).font = { bold: true, size: 10 };
      setBorderedRow(r, 2, 10);
    }

    function writeCATotalRow(sheet, rowNum, label, totals) {
      const r = sheet.getRow(rowNum);
      r.getCell(2).value = label;
      r.getCell(2).font = { bold: true };
      setNum(r.getCell(8), totals.actual);
      r.getCell(8).font = { bold: true };
      setNum(r.getCell(9), totals.absent);
      r.getCell(9).font = { bold: true };
      setNum(r.getCell(10), totals.billed);
      r.getCell(10).font = { bold: true };
      setBorderedRow(r, 2, 10);
    }

    // Equipment row writer for CA Summary
    function writeCAEquipRow(sheet, rowNum, name, qtyReq, monthlyRate, dailyRate, eqKey) {
      const r = sheet.getRow(rowNum);
      const eq = eqByName[eqKey];
      const qtyActual = eq ? parseFloat(eq.days_used || 0) : qtyReq;
      const daysAbsent = qtyReq - qtyActual;
      const totalActual = monthlyRate * qtyActual;
      const totalAbsent = dailyRate * (daysAbsent > 0 ? daysAbsent : 0);
      const toBeBilled = totalActual - totalAbsent;

      r.getCell(2).value = name;
      setNum(r.getCell(3), qtyReq);
      setNum(r.getCell(4), qtyActual);
      setNum(r.getCell(5), daysAbsent > 0 ? daysAbsent : 0);
      setNum(r.getCell(6), monthlyRate);
      setNum(r.getCell(7), dailyRate);
      setNum(r.getCell(8), totalActual);
      setNum(r.getCell(9), totalAbsent);
      setNum(r.getCell(10), toBeBilled);
      setBorderedRow(r, 2, 10);

      return { actual: totalActual, absent: totalAbsent, billed: toBeBilled };
    }

    // Manpower row writer for CA Summary
    function writeCAManpowerRow(sheet, rowNum, name, qtyReq, monthlyRate, dailyRate, groupKey, posFilter) {
      const r = sheet.getRow(rowNum);
      const group = getManpowerGroup(groupKey, posFilter);
      const qtyActual = sumDaysUsed(group) || qtyReq;
      const daysAbsent = sumAttendanceDays(group);
      const totalActual = monthlyRate * qtyActual;
      const totalAbsent = dailyRate * daysAbsent;
      const toBeBilled = totalActual - totalAbsent;

      r.getCell(2).value = name;
      setNum(r.getCell(3), qtyReq);
      setNum(r.getCell(4), qtyActual);
      setNum(r.getCell(5), daysAbsent);
      setNum(r.getCell(6), monthlyRate);
      setNum(r.getCell(7), dailyRate);
      setNum(r.getCell(8), totalActual);
      setNum(r.getCell(9), totalAbsent);
      setNum(r.getCell(10), toBeBilled);
      setBorderedRow(r, 2, 10);

      return { actual: totalActual, absent: totalAbsent, billed: toBeBilled };
    }

    // Materials row writer for CA Summary
    function writeCAMaterialRow(sheet, rowNum, name, unitRate, refId) {
      const r = sheet.getRow(rowNum);
      const matRec = materialRecords.find(mr => mr.reference_id === refId);
      const qty = matRec ? parseFloat(matRec.days_used || 0) : 0;
      const totalActual = unitRate * qty;

      r.getCell(2).value = name;
      setNum(r.getCell(3), 0);
      setNum(r.getCell(4), qty);
      setNum(r.getCell(5), 0);
      setNum(r.getCell(6), unitRate);
      setNum(r.getCell(7), 0);
      setNum(r.getCell(8), totalActual);
      setNum(r.getCell(9), 0);
      setNum(r.getCell(10), totalActual);
      setBorderedRow(r, 2, 10);

      return { actual: totalActual, absent: 0, billed: totalActual };
    }

    // Grand total computation helper for CA Summary
    function writeCAGrandTotal(sheet, startRow, eqTotal, mpTotal, matTotal) {
      let r = startRow;
      const directA = eqTotal.billed + mpTotal.billed + matTotal.billed;
      const gaE = directA * 0.11;
      const profitF = directA * 0.15;
      const vatG = (directA + gaE + profitF) * 0.12;
      const grand = directA + gaE + profitF + vatG;

      const computeRows = [
        { label: 'INDIRECT COST', value: directA },
        { label: 'E : General and administrative, Overhead, Contingencies and Miscellaneous (11%)', value: gaE },
        { label: 'F : Profit (15% of C)', value: profitF },
        { label: 'G : VAT (12% of C+E+F)', value: vatG },
        { label: 'TOTAL COST (monthly)', value: grand },
      ];

      computeRows.forEach((cr, idx) => {
        const row = sheet.getRow(r);
        row.getCell(2).value = cr.label;
        row.getCell(2).font = { bold: true, size: idx === 4 ? 11 : 10 };
        setNum(row.getCell(10), cr.value);
        row.getCell(10).font = { bold: true, size: idx === 4 ? 11 : 10 };
        if (idx === 4) {
          applyHeaderFill(row.getCell(2), 'FFFFF9C4');
          applyHeaderFill(row.getCell(10), 'FFFFF9C4');
        }
        setBorderedRow(row, 2, 10);
        r++;
      });

      return r;
    }

    // ═══════════════════════════════════════════
    // Section 1: BRIDGE EPOXY (Row 7)
    // ═══════════════════════════════════════════
    writeCASectionTitle(caSheet, 7, 'MONTHLY BILLING - (BRIDGE EPOXY)');
    writeCAHeaders(caSheet, 8);

    writeCASubHeader(caSheet, 9, 'Equipment');
    let epoxyEqTotal = { actual: 0, absent: 0, billed: 0 };
    let caRow = 10;

    const epoxyEquipItems = [
      { name: 'Service Vehicle', qtyReq: 2, monthlyRate: 120252.98, dailyRate: 4610.34, eqKey: 'Service Vehicle (EPOXY)' },
      { name: 'Genset', qtyReq: 2, monthlyRate: 13268.85, dailyRate: 508.71, eqKey: 'Genset Optimax 5kva' },
      { name: 'Wagner', qtyReq: 2, monthlyRate: 8980.16, dailyRate: 344.29, eqKey: 'Wagner Epoxy injection pump' },
      { name: 'Grinder', qtyReq: 3, monthlyRate: 540.18, dailyRate: 20.71, eqKey: 'Bosch Grinder GWS060' },
      { name: 'Blower', qtyReq: 2, monthlyRate: 646.58, dailyRate: 24.79, eqKey: 'Bosch Blower' },
      { name: 'Rotary drill', qtyReq: 3, monthlyRate: 2578.13, dailyRate: 98.84, eqKey: 'Bosch Rotary drill GBH2-24 RE' },
    ];
    for (const item of epoxyEquipItems) {
      const t = writeCAEquipRow(caSheet, caRow, item.name, item.qtyReq, item.monthlyRate, item.dailyRate, item.eqKey);
      epoxyEqTotal.actual += t.actual; epoxyEqTotal.absent += t.absent; epoxyEqTotal.billed += t.billed;
      caRow++;
    }
    writeCATotalRow(caSheet, caRow, 'Total Amount', epoxyEqTotal);
    caRow++;

    writeCASubHeader(caSheet, caRow, 'Manpower');
    caRow++;
    let epoxyMpTotal = { actual: 0, absent: 0, billed: 0 };
    const epoxyManpowerItems = [
      { name: 'Skilled Labor', qtyReq: 4, monthlyRate: 21205.08, dailyRate: 812.97, group: 'epoxy', filter: 'skilled' },
      { name: 'Non-Skilled AM Shift', qtyReq: 12, monthlyRate: 19955.43, dailyRate: 765.06, group: 'epoxy', filter: 'crew' },
      { name: 'Driver AM Shift', qtyReq: 2, monthlyRate: 28211.75, dailyRate: 1081.60, group: 'epoxy', filter: 'driver' },
    ];
    for (const item of epoxyManpowerItems) {
      const t = writeCAManpowerRow(caSheet, caRow, item.name, item.qtyReq, item.monthlyRate, item.dailyRate, item.group, item.filter);
      epoxyMpTotal.actual += t.actual; epoxyMpTotal.absent += t.absent; epoxyMpTotal.billed += t.billed;
      caRow++;
    }
    writeCATotalRow(caSheet, caRow, 'Total Amount', epoxyMpTotal);
    caRow++;

    writeCASubHeader(caSheet, caRow, 'Materials');
    caRow++;
    let epoxyMatTotal = { actual: 0, absent: 0, billed: 0 };
    const epoxyMaterialItems = [
      { name: 'TamRez 220', unitRate: 2228.13, refId: 1 },
      { name: 'Kalmosine Powder', unitRate: 256.69, refId: 2 },
      { name: 'Aluminum Tube', unitRate: 5719.19, refId: 3 },
    ];
    for (const item of epoxyMaterialItems) {
      const t = writeCAMaterialRow(caSheet, caRow, item.name, item.unitRate, item.refId);
      epoxyMatTotal.actual += t.actual; epoxyMatTotal.absent += t.absent; epoxyMatTotal.billed += t.billed;
      caRow++;
    }
    writeCATotalRow(caSheet, caRow, 'Total Amount', epoxyMatTotal);
    caRow += 2;

    // Grand total computation for BRIDGE EPOXY
    caRow = writeCAGrandTotal(caSheet, caRow, epoxyEqTotal, epoxyMpTotal, epoxyMatTotal);
    caRow += 2;

    // ═══════════════════════════════════════════
    // Section 2: ROUTINE MAINTENANCE
    // ═══════════════════════════════════════════
    writeCASectionTitle(caSheet, caRow, 'MONTHLY BILLING - (ROUTINE MAINTENANCE)');
    caRow++;
    writeCAHeaders(caSheet, caRow);
    caRow++;

    writeCASubHeader(caSheet, caRow, 'Equipment');
    caRow++;
    let rmEqTotal = { actual: 0, absent: 0, billed: 0 };
    const rmEquipItems = [
      { name: 'Service Vehicle', qtyReq: 1, monthlyRate: 120252.98, dailyRate: 4610.34, eqKey: 'Service Vehicle (RM)' },
      { name: 'Grass Cutter', qtyReq: 1, monthlyRate: 24585, dailyRate: 942.56, eqKey: 'Grass Cutter (RM)' },
      { name: 'Pressure washer', qtyReq: 1, monthlyRate: 6063.99, dailyRate: 232.49, eqKey: 'Pressure washer (RM)' },
    ];
    for (const item of rmEquipItems) {
      const t = writeCAEquipRow(caSheet, caRow, item.name, item.qtyReq, item.monthlyRate, item.dailyRate, item.eqKey);
      rmEqTotal.actual += t.actual; rmEqTotal.absent += t.absent; rmEqTotal.billed += t.billed;
      caRow++;
    }
    writeCATotalRow(caSheet, caRow, 'Total Amount', rmEqTotal);
    caRow++;

    writeCASubHeader(caSheet, caRow, 'Manpower');
    caRow++;
    let rmMpTotal = { actual: 0, absent: 0, billed: 0 };
    const rmManpowerItems = [
      { name: 'Supervisor', qtyReq: 0.33, monthlyRate: 37022.87, dailyRate: 468.40, group: 'rm', filter: 'supervisor' },
      { name: 'Admin assistant', qtyReq: 0.17, monthlyRate: 23855.11, dailyRate: 152.43, group: 'rm', filter: 'admin' },
      { name: 'Warehouse man', qtyReq: 0.25, monthlyRate: 24855.26, dailyRate: 238.23, group: 'rm', filter: 'warehouse' },
      { name: 'Driver', qtyReq: 1, monthlyRate: 28211.75, dailyRate: 1081.60, group: 'rm', filter: 'driver' },
      { name: 'Skilled Labor', qtyReq: 2, monthlyRate: 21205.08, dailyRate: 812.97, group: 'rm', filter: 'skilled' },
      { name: 'Non-Skilled', qtyReq: 6, monthlyRate: 19955.43, dailyRate: 765.06, group: 'rm', filter: 'crew' },
    ];
    for (const item of rmManpowerItems) {
      const t = writeCAManpowerRow(caSheet, caRow, item.name, item.qtyReq, item.monthlyRate, item.dailyRate, item.group, item.filter);
      rmMpTotal.actual += t.actual; rmMpTotal.absent += t.absent; rmMpTotal.billed += t.billed;
      caRow++;
    }
    writeCATotalRow(caSheet, caRow, 'Total Amount', rmMpTotal);
    caRow += 2;

    // Grand total for ROUTINE MAINTENANCE
    caRow = writeCAGrandTotal(caSheet, caRow, rmEqTotal, rmMpTotal, { actual: 0, absent: 0, billed: 0 });
    caRow += 2;

    // ═══════════════════════════════════════════
    // Section 3: SEGMENT 10/CONNECTOR
    // ═══════════════════════════════════════════
    writeCASectionTitle(caSheet, caRow, 'MONTHLY BILLING - (SEGMENT 10/CONNECTOR)');
    caRow++;
    writeCAHeaders(caSheet, caRow);
    caRow++;

    writeCASubHeader(caSheet, caRow, 'Equipment');
    caRow++;
    let seg10EqTotal = { actual: 0, absent: 0, billed: 0 };
    const seg10EquipItems = [
      { name: 'Service Vehicle', qtyReq: 1, monthlyRate: 131224.24, dailyRate: 5030.96, eqKey: 'Service Vehicle (SEGMENT 10)' },
      { name: 'Grass Cutter', qtyReq: 1, monthlyRate: 24585, dailyRate: 942.56, eqKey: 'Grass Cutter (SEG10)' },
      { name: 'Pressure washer', qtyReq: 1, monthlyRate: 6063.99, dailyRate: 232.49, eqKey: 'Pressure washer (SEG10)' },
    ];
    for (const item of seg10EquipItems) {
      const t = writeCAEquipRow(caSheet, caRow, item.name, item.qtyReq, item.monthlyRate, item.dailyRate, item.eqKey);
      seg10EqTotal.actual += t.actual; seg10EqTotal.absent += t.absent; seg10EqTotal.billed += t.billed;
      caRow++;
    }
    writeCATotalRow(caSheet, caRow, 'Total Amount', seg10EqTotal);
    caRow++;

    writeCASubHeader(caSheet, caRow, 'Manpower');
    caRow++;
    let seg10MpTotal = { actual: 0, absent: 0, billed: 0 };
    const seg10ManpowerItems = [
      { name: 'Driver', qtyReq: 1, monthlyRate: 28211.75, dailyRate: 1081.60, group: 'seg10', filter: 'driver' },
      { name: 'Skilled', qtyReq: 2, monthlyRate: 21205.08, dailyRate: 952.92, group: 'seg10', filter: 'skilled' },
      { name: 'Non-Skilled', qtyReq: 6, monthlyRate: 19955.43, dailyRate: 914.57, group: 'seg10', filter: 'crew' },
    ];
    for (const item of seg10ManpowerItems) {
      const t = writeCAManpowerRow(caSheet, caRow, item.name, item.qtyReq, item.monthlyRate, item.dailyRate, item.group, item.filter);
      seg10MpTotal.actual += t.actual; seg10MpTotal.absent += t.absent; seg10MpTotal.billed += t.billed;
      caRow++;
    }
    writeCATotalRow(caSheet, caRow, 'Total Amount', seg10MpTotal);
    caRow += 2;

    // Grand total for SEGMENT 10/CONNECTOR
    caRow = writeCAGrandTotal(caSheet, caRow, seg10EqTotal, seg10MpTotal, { actual: 0, absent: 0, billed: 0 });
    caRow += 1;

    // GRAND TOTAL — sum of all 3 sections
    const allSections = [
      { eq: epoxyEqTotal, mp: epoxyMpTotal, mat: epoxyMatTotal },
      { eq: rmEqTotal, mp: rmMpTotal, mat: { actual: 0, absent: 0, billed: 0 } },
      { eq: seg10EqTotal, mp: seg10MpTotal, mat: { actual: 0, absent: 0, billed: 0 } },
    ];
    let overallGrand = 0;
    for (const s of allSections) {
      const direct = s.eq.billed + s.mp.billed + s.mat.billed;
      const ga = direct * 0.11;
      const prof = direct * 0.15;
      const vt = (direct + ga + prof) * 0.12;
      overallGrand += direct + ga + prof + vt;
    }
    const grandRow = caSheet.getRow(caRow);
    grandRow.getCell(2).value = 'GRAND TOTAL';
    grandRow.getCell(2).font = { bold: true, size: 13 };
    setNum(grandRow.getCell(10), overallGrand);
    grandRow.getCell(10).font = { bold: true, size: 13 };
    applyHeaderFill(grandRow.getCell(2), 'FFFFF9C4');
    applyHeaderFill(grandRow.getCell(10), 'FFFFF9C4');
    setBorderedRow(grandRow, 2, 10);

    // ── Write response ──
    const filename = `billing_${monthName}_${year}.xlsx`;
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
