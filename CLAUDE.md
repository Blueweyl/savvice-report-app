# Savvice Routine Maintenance Department — Report Management System

## Workflow Rules
- **Commit and push regularly.** After completing each feature, fix, or meaningful change, commit to git and push to GitHub immediately. Never let work accumulate without a commit. This ensures we never lose progress.
- Commit messages should be clear and describe what changed.
- Push to `origin master` after every commit.

## Project Overview
Web application for the Savvice Routine Maintenance Department where employees submit maintenance reports and admins review (approve/reject) them.

**Live URL:** https://savvice-report-app.onrender.com
**GitHub:** https://github.com/Blueweyl/savvice-report-app
**Hosting:** Render (free tier) — auto-deploys from GitHub on push

## Tech Stack
- **Frontend:** React (Vite) + Tailwind CSS + React Router
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Render managed, free tier)
- **Auth:** JWT + bcryptjs
- **Exports:** exceljs (Excel), pdfkit (PDF)
- **Photos:** Stored as base64 in PostgreSQL (not filesystem)

## Project Structure
```
report-app/
├── client/              # React frontend (Vite)
│   └── src/
│       ├── pages/       # Login, Register, EmployeeDashboard, NewReport, AdminDashboard, ReportDetail
│       ├── components/  # Layout, StatusBadge
│       ├── api.js       # Axios instance with auth interceptor
│       └── App.jsx      # Router config
├── server/              # Express backend
│   ├── routes/          # auth.js, reports.js, departments.js, export.js
│   ├── middleware/      # auth.js (JWT verify + role check)
│   ├── db/              # pool.js (PG connection), init.js (schema + seed + auto-admin)
│   └── index.js         # Express entry point (auto-inits DB on startup)
├── render.yaml          # Render blueprint for deployment
```

## Departments & Activities
- **Furniture:** Furniture Drainage Cleaning, Guardrail Cleaning, Concrete Barrier Cleaning, Signage Cleaning, Vines Removal, Grass Cutting, Bougainvillea Maintenance, Unscheduled Activity, Furniture Corrective
- **Bridge:** Bridge RM Team 1, Segment 10 Scupper Drain, Bridge Epoxy
- **Roadway:** Road Sweeping Connector, Mobile Clean Up Connector, Road Sweeping IOMAS, Litter Picking Interchange IOMAS, Toll Lane Cleaning OIMAS, Garbage Collection IOMAS, Litter Picking Mainline OIMAS

## Commands
```bash
# Backend
cd report-app/server
npm install
cp .env.example .env     # then edit with your DB credentials
npm run dev               # start server on port 3001 (local)

# Frontend
cd report-app/client
npm install
npm run dev               # start Vite dev server on port 5173

# DB is auto-initialized on server startup (no manual db:init needed)
```

## API Endpoints
- `POST /api/auth/register` — register employee
- `POST /api/auth/login` — login
- `GET /api/auth/me` — current user
- `GET /api/departments` — list departments
- `GET /api/departments/:id/activities` — activities for a department
- `POST /api/reports` — submit report with photos (multipart/form-data)
- `GET /api/reports/my` — employee's own reports
- `GET /api/reports/all` — all reports (admin, filterable)
- `GET /api/reports/:id` — single report
- `GET /api/reports/:id/photo/:type` — serve photo (before/after) from DB
- `PATCH /api/reports/:id/review` — approve/reject (admin)
- `GET /api/export/excel` — download Excel accomplishment report
- `GET /api/export/pdf` — download PDF accomplishment summary

## Roles
- **employee** — submits reports, views own reports
- **admin** — reviews all reports, approves/rejects with comments, exports Excel/PDF
- Default admin: `admin@savvice.com` / `admin123` (auto-created on DB init)
