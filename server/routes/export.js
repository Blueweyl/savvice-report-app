const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');
const path = require('path');

const router = express.Router();

// Middleware that accepts auth from either Authorization header or ?token= query param
function authenticateExport(req, res, next) {
  let token = null;

  // Check Authorization header first
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }

  // Fall back to query parameter
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

// Build the base query with filters
function buildReportQuery(query) {
  let sql = `
    SELECT r.report_date, d.name as department_name, a.name as activity_name,
           r.activity_description, r.location_from, r.location_to, r.team,
           r.status_bound, r.accomplishment, r.equipment, r.operator_name,
           r.crew_names, r.remarks, r.status as review_status,
           u.name as author_name, r.photo_before, r.photo_after
    FROM reports r
    JOIN activities a ON r.activity_id = a.id
    JOIN departments d ON r.department_id = d.id
    JOIN users u ON r.author_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (query.department_id) {
    params.push(query.department_id);
    sql += ` AND r.department_id = $${params.length}`;
  }
  if (query.date_from) {
    params.push(query.date_from);
    sql += ` AND r.report_date >= $${params.length}`;
  }
  if (query.date_to) {
    params.push(query.date_to);
    sql += ` AND r.report_date <= $${params.length}`;
  }

  sql += ' ORDER BY r.report_date DESC, d.name, a.name';

  return { sql, params };
}

// Format date for display
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format status_bound for display
function formatBound(status) {
  if (status === 'done') return 'DONE';
  if (status === 'on_going') return 'ON GOING';
  return 'PENDING';
}

// Format review status for display
function formatReviewStatus(status) {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// GET /api/export/excel
router.get('/excel', authenticateExport, async (req, res) => {
  try {
    const { sql, params } = buildReportQuery(req.query);
    const result = await pool.query(sql, params);
    const reports = result.rows;

    // Resolve department name for the title row
    let departmentName = 'All Departments';
    if (req.query.department_id) {
      try {
        const deptResult = await pool.query('SELECT name FROM departments WHERE id = $1', [req.query.department_id]);
        if (deptResult.rows.length > 0) departmentName = deptResult.rows[0].name;
      } catch (e) {
        // Fall back to generic name
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Savvice RM System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Accomplishment Report', {
      pageSetup: { orientation: 'landscape', paperSize: 9 },
    });

    // No longer using filesystem uploads — photos are base64 data URIs in the database

    // ── Row 1: Merged title header (A1:M1) ──
    sheet.mergeCells('A1:M1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `SAVVICE Corporation — ${departmentName} Team Accomplishment Report | NLEX`;
    titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    titleCell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      bottom: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      left: { style: 'thin', color: { argb: 'FF1E3A5F' } },
      right: { style: 'thin', color: { argb: 'FF1E3A5F' } },
    };
    sheet.getRow(1).height = 40;

    // ── Row 2: Column headers (A2:M2) ──
    const headers = [
      'Date',              // A
      'Activity',          // B
      'Description',       // C
      'Location From',     // D
      'Location To',       // E
      'Status/Bound',      // F
      'Photo Before',      // G
      'Photo After',       // H
      'Team',              // I
      'Accomplishment',    // J
      'Equipment',         // K
      'Crew Names',        // L
      'Operator',          // M
    ];

    const headerRow = sheet.getRow(2);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1D4ED8' } },
        bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } },
        left: { style: 'thin', color: { argb: 'FF1D4ED8' } },
        right: { style: 'thin', color: { argb: 'FF1D4ED8' } },
      };
    });
    headerRow.height = 28;

    // ── Column widths ──
    const columnWidths = [14, 20, 30, 16, 16, 14, 20, 20, 10, 16, 18, 24, 16];
    columnWidths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    // ── Data rows (starting at row 3) ──
    // Helper to format status_bound for display
    function formatStatusBound(status) {
      if (status === 'on_going') return 'on going';
      if (status === 'done') return 'done';
      if (status === 'pending') return 'pending';
      return status || '';
    }

    // Helper to format date as YYYY-MM-DD
    function formatDateISO(date) {
      if (!date) return '';
      const d = new Date(date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // Parse a data URI and return { base64, extension } for exceljs
    function parseDataUri(dataUri) {
      const match = dataUri.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (!match) return null;
      let ext = match[1].toLowerCase();
      if (ext === 'jpg') ext = 'jpeg';
      return { base64: match[2], extension: ext };
    }

    reports.forEach((r, index) => {
      const rowNumber = index + 3; // data starts at row 3
      const row = sheet.getRow(rowNumber);

      // Populate cells A through M (columns 1-13)
      row.getCell(1).value = formatDateISO(r.report_date);       // A: Date
      row.getCell(2).value = r.activity_name || '';               // B: Activity
      row.getCell(3).value = r.activity_description || '';        // C: Description
      row.getCell(4).value = r.location_from || '';               // D: Location From
      row.getCell(5).value = r.location_to || '';                 // E: Location To
      row.getCell(6).value = formatStatusBound(r.status_bound);  // F: Status/Bound
      // G (col 7) and H (col 8) are for embedded images — handled below
      row.getCell(9).value = r.team || '';                        // I: Team
      row.getCell(10).value = r.accomplishment != null ? r.accomplishment : ''; // J: Accomplishment
      row.getCell(11).value = r.equipment || '';                  // K: Equipment
      row.getCell(12).value = r.crew_names || '';                 // L: Crew Names
      row.getCell(13).value = r.operator_name || '';              // M: Operator

      // ── Embed photo_before in column G ──
      if (r.photo_before && r.photo_before.startsWith('data:')) {
        const parsed = parseDataUri(r.photo_before);
        if (parsed) {
          try {
            const imageId = workbook.addImage({
              base64: parsed.base64,
              extension: parsed.extension,
            });
            sheet.addImage(imageId, {
              tl: { col: 6, row: rowNumber - 1 },   // 0-based: col 6 = G, row rowNumber-1
              br: { col: 7, row: rowNumber },
              editAs: 'oneCell',
            });
          } catch (imgErr) {
            console.error(`Failed to embed photo_before for row ${rowNumber}:`, imgErr.message);
          }
        }
      }

      // ── Embed photo_after in column H ──
      if (r.photo_after && r.photo_after.startsWith('data:')) {
        const parsed = parseDataUri(r.photo_after);
        if (parsed) {
          try {
            const imageId = workbook.addImage({
              base64: parsed.base64,
              extension: parsed.extension,
            });
            sheet.addImage(imageId, {
              tl: { col: 7, row: rowNumber - 1 },   // 0-based: col 7 = H
              br: { col: 8, row: rowNumber },
              editAs: 'oneCell',
            });
          } catch (imgErr) {
            console.error(`Failed to embed photo_after for row ${rowNumber}:`, imgErr.message);
          }
        }
      }

      // Set row height for images
      row.height = 100;

      // ── Alternate row colors: white and light cream/yellow ──
      const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFFFFDE7';
      for (let col = 1; col <= 13; col++) {
        const cell = row.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.font = { size: 10 };
      }
    });

    // Set response headers
    const filename = `accomplishment_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/pdf
router.get('/pdf', authenticateExport, async (req, res) => {
  try {
    const { sql, params } = buildReportQuery(req.query);
    const result = await pool.query(sql, params);
    const reports = result.rows;

    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
    });

    // Set response headers
    const filename = `accomplishment_summary_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title
    doc.fontSize(18).font('Helvetica-Bold')
      .fillColor('#1F2937')
      .text('Savvice Routine Maintenance Department', { align: 'center' });

    doc.moveDown(0.3);

    // Subtitle
    doc.fontSize(13).font('Helvetica')
      .fillColor('#4B5563')
      .text('Weekly Accomplishment Summary Report', { align: 'center' });

    doc.moveDown(0.3);

    // Filter info
    let filterText = 'All Reports';
    const filterParts = [];
    if (req.query.department_id) filterParts.push(`Department ID: ${req.query.department_id}`);
    if (req.query.date_from) filterParts.push(`From: ${req.query.date_from}`);
    if (req.query.date_to) filterParts.push(`To: ${req.query.date_to}`);
    if (filterParts.length > 0) filterText = filterParts.join(' | ');

    doc.fontSize(9).font('Helvetica-Oblique')
      .fillColor('#6B7280')
      .text(filterText, { align: 'center' });

    doc.moveDown(1);

    // Table configuration
    const tableColumns = [
      { header: 'Date', width: 68 },
      { header: 'Activity', width: 110 },
      { header: 'Location', width: 110 },
      { header: 'Team', width: 55 },
      { header: 'Bound', width: 58 },
      { header: 'Accomplishment', width: 90 },
      { header: 'Operator', width: 85 },
      { header: 'Crew Names', width: 100 },
      { header: 'Remarks', width: 84 },
    ];

    const tableLeft = 40;
    const tableWidth = tableColumns.reduce((sum, col) => sum + col.width, 0);
    const rowHeight = 22;
    const headerHeight = 26;

    // Draw table header
    function drawTableHeader(y) {
      // Header background
      doc.rect(tableLeft, y, tableWidth, headerHeight)
        .fill('#2563EB');

      let x = tableLeft;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      tableColumns.forEach((col) => {
        doc.text(col.header, x + 4, y + 8, {
          width: col.width - 8,
          align: 'left',
          lineBreak: false,
        });
        x += col.width;
      });

      return y + headerHeight;
    }

    // Draw a data row
    function drawDataRow(y, report, index) {
      // Alternate row background
      const bgColor = index % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
      doc.rect(tableLeft, y, tableWidth, rowHeight).fill(bgColor);

      // Bottom border
      doc.moveTo(tableLeft, y + rowHeight)
        .lineTo(tableLeft + tableWidth, y + rowHeight)
        .strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .stroke();

      const location = report.location_from && report.location_to
        ? `${report.location_from} > ${report.location_to}`
        : (report.location_from || report.location_to || '');

      const values = [
        formatDate(report.report_date),
        report.activity_name || '',
        location,
        report.team || '',
        formatBound(report.status_bound),
        report.accomplishment != null ? String(report.accomplishment) : '',
        report.operator_name || '',
        report.crew_names || '',
        report.remarks || '',
      ];

      let x = tableLeft;
      doc.fontSize(7).font('Helvetica').fillColor('#374151');
      values.forEach((val, i) => {
        const truncated = String(val).length > 30 ? String(val).substring(0, 28) + '..' : String(val);
        doc.text(truncated, x + 3, y + 7, {
          width: tableColumns[i].width - 6,
          align: 'left',
          lineBreak: false,
        });
        x += tableColumns[i].width;
      });

      return y + rowHeight;
    }

    // Render table
    let currentY = drawTableHeader(doc.y);
    const pageBottom = doc.page.height - 60;

    reports.forEach((report, index) => {
      // Check if we need a new page
      if (currentY + rowHeight > pageBottom) {
        doc.addPage();
        currentY = 40;
        currentY = drawTableHeader(currentY);
      }
      currentY = drawDataRow(currentY, report, index);
    });

    if (reports.length === 0) {
      doc.moveDown(2);
      doc.fontSize(12).font('Helvetica').fillColor('#6B7280')
        .text('No reports found matching the selected filters.', { align: 'center' });
    }

    // Footer with generated date
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica-Oblique')
      .fillColor('#9CA3AF')
      .text(`Generated: ${new Date().toLocaleString()}`, tableLeft, undefined, { align: 'left' });

    doc.fontSize(8).font('Helvetica-Oblique')
      .fillColor('#9CA3AF')
      .text(`Total Reports: ${reports.length}`, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    // Only send error if headers not yet sent
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
