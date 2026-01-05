# TASKS.md
Farm Management & Proceeds Calculation System

This file tracks development tasks and progress for the project.

## ROADMAP (START → MVP)

### DAY 0 — PREPARATION
- Confirm requirements with boss
- Collect Excel sheets
- Extract formulas
- Lock MVP scope

---

### DAYS 1–2 — PROJECT SETUP
- Create Next.js app
- Setup Tailwind & shadcn/ui
- Setup Prisma & PostgreSQL
- Create repo structure
- Setup environment variables

---

### DAYS 3–4 — AUTH & ROLES
- Implement NextAuth (credentials)
- Create User model with role
- Build login page
- Protect routes with middleware
- Seed admin user

---

### DAYS 5–6 — DASHBOARD & NAVIGATION
- Dashboard layout
- Sidebar navigation
- Role-based menu visibility
- Empty pages for all tabs

---

### DAYS 7–9 — AG GRID FOUNDATION
- Install AG Grid
- Build first editable grid (Recipe Master)
- Inline editing
- Auto-calculated columns
- Save data to backend

Build ONE grid perfectly before cloning.

---

### DAYS 10–12 — FEED MILL MODULE
- Ingredients CRUD
- Recipe Master (grid)
- Production batches
- Batch cost calculation

---

### DAYS 13–14 — POULTRY MODULE
- Flocks
- Daily records (grid)
- Mortality tracking
- Simple aggregations

---

### DAYS 15–16 — REPORTS & DASHBOARD
- Daily summary
- Weekly / monthly totals
- Role-based visibility

---

### DAYS 17–18 — POLISHING
- Validation
- Error handling
- Loading states
- Access control checks
- Test with real data

---

### DAYS 19–20 — DEPLOYMENT
- Deploy to Vercel
- Setup production database
- Run migrations
- Demo MVP to boss

Note:
Feed Mill module is the most complex part of the system.
Expect more iteration here than other modules.
Do not rush this section.


---

## 🟢 PHASE 0 — REQUIREMENTS & PREPARATION

- [ ] Meet with boss to confirm:
  - [ ] Farm type(s) (poultry, fishery, crop, mixed)
  - [ ] Required user roles
  - [ ] Fixed vs changing formulas
- [ ] Collect existing Excel sheets
- [ ] Extract all formulas from Excel
- [ ] Define MVP scope clearly
- [ ] List reports needed (daily / weekly / monthly)

---

## 🟢 PHASE 1 — PROJECT SETUP & AUTHENTICATION

### Project Setup
- [ ] Initialize Next.js project (App Router)
- [ ] Setup Git repository
- [ ] Configure environment variables
- [ ] Install core dependencies

### UI & Styling
- [ ] Install Tailwind CSS
- [ ] Setup shadcn/ui
- [ ] Create base layout (dashboard shell)

### Database
- [ ] Setup PostgreSQL database
- [ ] Install Prisma
- [ ] Initialize Prisma schema
- [ ] Create User model
- [ ] Run first migration

### Authentication
- [ ] Install NextAuth (Auth.js)
- [ ] Setup credentials-based login
- [ ] Hash passwords securely
- [ ] Add role field to user model
- [ ] Protect routes with middleware

---

## 🟢 PHASE 2 — CORE DATA MODELS & CRUD

### Database Models
- [ ] Feed records model
- [ ] Expenses model
- [ ] Sales model
- [ ] Livestock model (basic)
- [ ] Migrate database changes

### API Routes
- [ ] Create feed CRUD endpoints
- [ ] Create expense CRUD endpoints
- [ ] Create sales CRUD endpoints
- [ ] Create livestock CRUD endpoints
- [ ] Add server-side validation

### UI Forms
- [ ] Feed entry form
- [ ] Expense entry form
- [ ] Sales entry form
- [ ] Livestock entry form
- [ ] Edit & delete actions

---

## 🟢 PHASE 3 — BUSINESS LOGIC & CALCULATIONS

### Formula Implementation
- [ ] Translate Excel formulas to JS
- [ ] Implement feed cost calculation
- [ ] Implement total expenses calculation
- [ ] Implement revenue calculation
- [ ] Implement profit/proceeds calculation

### Validation
- [ ] Validate calculations against Excel
- [ ] Handle zero/empty data cases
- [ ] Prevent client-side manipulation

---

## 🟢 PHASE 4 — REPORTS & DASHBOARDS

### Aggregation Logic
- [ ] Daily summaries
- [ ] Weekly summaries
- [ ] Monthly summaries
- [ ] Server-side aggregation queries

### Dashboard UI
- [ ] Admin dashboard
- [ ] Manager dashboard
- [ ] Staff dashboard
- [ ] Role-based data visibility

### Charts & Tables
- [ ] Revenue charts
- [ ] Expense breakdown charts
- [ ] Profit trend charts
- [ ] Summary tables

---

## 🟢 PHASE 5 — POLISHING & TESTING

### UX Improvements
- [ ] Loading states
- [ ] Empty states
- [ ] Error messages
- [ ] Confirmation dialogs

### Security & Stability
- [ ] Role-based API protection
- [ ] Input sanitization
- [ ] Server-side checks
- [ ] Test with real farm data

---

## 🟢 PHASE 6 — DEPLOYMENT & HANDOVER

### Deployment
- [ ] Setup production database
- [ ] Deploy app to Vercel
- [ ] Configure environment variables
- [ ] Run production migrations

### Handover
- [ ] Seed admin account
- [ ] Write basic usage notes
- [ ] Demo system to boss
- [ ] Collect feedback
- [ ] Plan next iteration

---

## 🔮 FUTURE / OPTIONAL TASKS

- [ ] Configurable formulas stored in DB
- [ ] Excel export
- [ ] Audit logs
- [ ] Inventory alerts
- [ ] Multi-farm support
- [ ] Notifications
- [ ] Mobile-first optimization

---

## ✅ STATUS
- Start Date: __________
- Target MVP Completion: __________
- Current Phase: __________


⚠️ Important Advice (from experience)

Do not overbuild configurable formulas on day 1

Validate calculations against Excel every time

Keep everything server-side

Lock scope early

