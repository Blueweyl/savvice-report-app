# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Rules
- **Commit and push regularly.** After completing each feature, fix, or meaningful change, commit to git and push to GitHub immediately. Never let work accumulate without a commit.
- Commit messages should be clear and describe what changed.
- Push to `origin master` after every commit.

## Project Overview
Web application for the Savvice Routine Maintenance Department. Employees submit maintenance reports; admins review (approve/reject) them and manage scheduling, attendance, billing, and equipment tracking.

**Live URL:** https://savvice-report-app.onrender.com
**GitHub:** https://github.com/Blueweyl/savvice-report-app
**Hosting:** Render (free tier) — auto-deploys from GitHub on push to `master`

## Tech Stack
- **Frontend:** React 19 (Vite) + Tailwind CSS 4 + React Router 7, plain `useState`/`localStorage` for auth state (no global store)
- **Backend:** Node.js + Express, single process serves both the API and the built client
- **Database:** PostgreSQL (Render managed in prod, local Postgres in dev) via `pg`
- **Auth:** JWT (`jsonwebtoken`) + bcryptjs, no refresh tokens — token is stored in `localStorage` and sent as `Authorization: Bearer`
- **Exports:** exceljs (Excel), pdfkit (PDF)
- **Photos:** Stored as base64 data URIs in a `TEXT` column in Postgres (not on the filesystem), streamed back through a dedicated photo route

## Repo Layout
This is a two-package repo at the **root** (not nested under a subfolder):
```
client/        React frontend (Vite)
server/        Express backend
render.yaml     Render blueprint (build/start commands for deployment)
```
- `server/routes/` — one router file per resource; each is mounted directly in `server/index.js`
- `server/db/init.js` — schema + seed data, see "Database" notes below
- `server/middleware/auth.js` — the shared `authenticate`/`requireAdmin` middleware
- `client/src/pages/` — one component per route, wired up in `client/src/App.jsx`
- `client/src/api.js` — shared axios instance (auth header injection + 401 handling)

## Commands
```bash
# One-time setup (from repo root)
npm run install:all       # installs both server and client deps

# Backend (from server/)
npm run dev                # nodemon, port from PORT env (default 5000)

# Frontend (from client/)
npm run dev                 # Vite dev server
npm run lint                 # eslint .

# Production-style build/run (from repo root)
npm run build               # builds client/dist
npm start                    # node server/index.js (serves API + client/dist)

# DB
npm run db:init             # manually re-run schema/seed (server/db/init.js) — usually not needed, see below
```
There is no automated test suite in this repo currently.

## Architecture Notes

**Single Express process serves everything in production.** `server/index.js` mounts all `/api/*` routers, then a catch-all `app.get('*', ...)` serves `client/dist/index.html` for client-side routing. Any new API route must be added *before* that catch-all (i.e., alongside the other `app.use('/api/...')` calls).

**DB schema lives in code, not migration files.** `server/db/init.js` runs on every server boot (with a 5-attempt retry loop for Render's DB cold-start) and is fully idempotent: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `ON CONFLICT DO NOTHING` throughout. Schema changes are made by editing this file and adding another idempotent statement — there's no separate migration runner. This file also seeds large hardcoded reference datasets (the full manpower roster, billing equipment rates, billing manpower rates) directly as JS arrays; re-running init is safe and won't duplicate rows.

**Download/export routes use a query-param auth variant.** Because browsers can't attach an `Authorization` header to a plain link or `window.open()` download, every route that serves a file directly (`export.js`, `billing.js` `/export`, `attendance.js` `/export`, `equipment-tracking.js` `/export`, and `reports.js` `/:id/photo/:type`) defines its **own local copy** of a token-checking middleware (named variously `authenticateExport`, `authenticateBilling`, `authenticateFlexible`) that accepts the JWT from either the header or `?token=`. The shared `middleware/auth.js` `authenticate` only checks the header. When adding a new downloadable/exportable endpoint, follow this same pattern rather than reusing the strict header-only `authenticate`.

**Registration requires admin approval.** `users.account_status` (`pending`/`approved`/`rejected`) is separate from `role`. New registrations via `POST /api/auth/register` are created as `pending` and cannot log in until an admin approves them via `PATCH /api/auth/users/:id/status`. The seeded default admin (`admin@savvice.com` / `admin123`) is force-set to `approved` on every init.

**Photos are DB-stored data URIs.** Uploads come in via `multer` memory storage in `POST /api/reports`, get stored as `data:image/...;base64,...` strings in `reports.photo_before`/`photo_after`, and are served back (with the same access-control check as the report itself: admin sees all, employee sees only their own) through `GET /api/reports/:id/photo/:type`, which decodes the data URI back to a binary response.

**Client auth is header-only, no context/store.** `client/src/api.js` reads/writes the token and user object straight from `localStorage`; a response interceptor clears both and hard-redirects to `/login` on any 401. `App.jsx`'s `PrivateRoute` wrapper does the same localStorage read to gate routes by `role` (`employee`, `admin`, or any authenticated user if `role` is omitted).

## Feature Areas
Beyond the original report-submission flow, the app now covers several admin-facing operational areas, each with its own route file + page:
- **Reports** (`routes/reports.js`, pages `NewReport`/`EmployeeDashboard`/`AdminDashboard`/`ReportDetail`) — submit, review, approve/reject, edit, delete
- **Schedule** (`routes/schedule.js`, page `Schedule`) — annual targets vs. accomplishments (manual and daily) per activity
- **Attendance** (`routes/attendance.js`, page `Attendance`) — daily attendance against the `manpower` roster
- **Billing** (`routes/billing.js`, page `Billing`) — equipment/manpower billing rates and monthly billing records
- **Equipment tracking** (`routes/equipment-tracking.js`, page `Equipment`) — daily deployment status (deployed/standby/breakdown/maintenance) per billing-equipment item
- **Summary** (`routes/reports.js` `/summary`, page `Summary`) — cross-cutting accomplishment rollups

## Departments & Activities
Seeded in `server/db/init.js`; changing these means editing the `ACTIVITIES`/`DEPARTMENTS` constants there.
- **Furniture:** Furniture Drainage Cleaning, Guardrail Cleaning, Concrete Barrier Cleaning, Signage Cleaning, Vines Removal, Grass Cutting, Bougainvillea Maintenance, Unscheduled Activity, Furniture Corrective
- **Bridge:** Bridge RM Team 1, Segment 10 Scupper Drain, Bridge Epoxy
- **Roadway:** Road Sweeping Connector, Mobile Clean Up Connector, Road Sweeping IOMAS, Litter Picking Interchange IOMAS, Toll Lane Cleaning OIMAS, Garbage Collection IOMAS, Litter Picking Mainline OIMAS

## Roles
- **employee** — submits reports, views own reports/attendance/schedule
- **admin** — everything an employee can do, plus reviewing reports, and the Schedule/Attendance/Billing/Equipment admin actions
- Default admin: `admin@savvice.com` / `admin123` (auto-created and force-approved on every DB init)
