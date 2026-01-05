# TASKS.md
Farm Management & Proceeds Calculation System

This file tracks development tasks and progress for the project.

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

