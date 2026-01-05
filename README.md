# Farm Management System — MVP Execution Guide

This README is a complete guide for building the Farm Management System
from scratch to MVP.

Follow this document step by step.  
This is a **modular monolith**, not microservices.

---

## 1. PROJECT GOAL

Build an internal web application for farm operations with:

- Login system
- User roles & role-based views
- Excel-like editable tables (AG Grid)
- Feed Mill module (Recipe Master, Ingredients, Batches)
- Poultry module (more modules can be added later)
- Accurate proceeds & cost calculations
- Clean dashboard for daily use

Target: **Working MVP**, not over-engineered SaaS.

---

## 2. HIGH-LEVEL ARCHITECTURE

Single repository, single application.


---

## 3. FRONTEND STACK (KEEP IT SIMPLE)

### Core
- **Next.js (App Router)**
- **React**
- **TypeScript**

### UI & Styling
- **Tailwind CSS**
- **shadcn/ui** (for buttons, inputs, dialogs)
- **AG Grid (Community)** for Excel-like tables
- **Context API for state managament** 

### Do I need a design palette?
❌ No Figma or custom design system needed.

Use:
- Tailwind default colors
- shadcn/ui default theme
- Simple admin-dashboard look

Goal: **functional > beautiful**

---

## 4. BACKEND STACK

- **Node.js** (via Next.js API routes)
- **NextAuth (Auth.js)** for authentication
- **Zod** for input validation
- Business logic in plain TypeScript

No separate backend service.

---

## 5. DATABASE (BEST CHOICE, NO OVER-ENGINEERING)

### Database
- **PostgreSQL**

Why:
- Strong relational data
- Handles reports & aggregations well
- Industry standard
- Simple to host

### ORM
- **Prisma**

Why:
- Type-safe
- Easy migrations
- Perfect with Next.js

---

## 6. AUTHENTICATION & USER ROLES

### Authentication
- Email + password login
- Passwords hashed
- Session-based auth (NextAuth)

### Roles (MVP)
- **ADMIN** → full access
- **MANAGER** → operational access
- **STAFF** → data entry only

Role stored on `User` model.

---

## 7. ROLE-BASED VIEWS (IMPORTANT)

### UI Level
- Hide tabs and actions based on role

### Server Level
- Protect API routes by role
- Never trust frontend checks alone

Example:
- STAFF cannot see reports
- ADMIN can manage users
- MANAGER can view summaries

---

## 8. MAIN NAVIGATION (MVP)


Each page = route under `(dashboard)`.

---

## 9. EXCEL-LIKE TABLES (AG GRID)

AG Grid replaces Excel.

### Rules
- Editable cells for input
- Calculated columns are read-only
- Totals calculated instantly in UI
- Backend recalculates on save

### Mental Mapping

| Excel | App |
|-----|-----|
| Sheet | Page |
| Cell | Grid cell |
| Formula | JS function |
| Save | API call |

AG Grid is used for:
- Recipe Master
- Feed batches
- Poultry daily records

---

## 10. CALCULATIONS

### Where calculations live


Examples:
- Feed cost
- Batch cost
- Total expenses
- Proceeds / profit

### Rules
- UI calculation = feedback only
- Backend calculation = source of truth
- Always validate against Excel sheets

---

## 11. DATABASE MODELS (MVP SCOPE)

Minimum models:

- User
- Ingredient
- Recipe
- RecipeItem
- FeedBatch
- PoultryFlock
- PoultryDailyRecord
- Expense
- Sale

Keep schemas simple. Add fields later.

---

## 12. ROADMAP (START → MVP)

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

---

## 13. DEVELOPMENT RULES (DO NOT IGNORE)

- One repo
- No microservices
- No premature optimization
- Backend is source of truth
- Build one feature fully before moving on
- Validate numbers against Excel constantly

---

## 14. MVP DEFINITION (DONE WHEN)

- Users can log in
- Roles work
- Feed Mill tables behave like Excel
- Poultry records can be entered
- Proceeds can be calculated
- Boss can use it daily

---

## FINAL NOTE

This project is not about fancy architecture.
It is about **reliability, clarity, and usability**.

Ship the MVP.
Improve later.

