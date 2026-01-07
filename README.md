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

Architecture style:
- Modular monolith
- Domain-based separation (auth, feed mill, poultry, sales)
- Shared database
- No microservices

Each Excel sheet maps to:
- One domain
- One database model (or set of related models)
- One AG Grid-based UI


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
State philosophy:
- Server is source of truth
- AG Grid manages table state
- React Context used sparingly (auth, layout)



### Do I need a design palette?
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
- Backend recalculations always override frontend values
- Never trust client-submitted totals

No separate backend service.

---

## 5. DATABASE (BEST CHOICE, NO OVER-ENGINEERING)

### Database
**Supabase (PostgreSQL)**
- Database hosted on Supabase
- SQL-first schema
- App-level business logic in Next.js

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
- Store raw inputs only (quantities, prices, percentages)
- Never store derived totals unless required for auditing


---

## 11. DATABASE MODELS (MVP SCOPE)

Initial MVP models (can evolve):
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


---
## DATA VALIDATION & AUDITABILITY

- All financial calculations must be reproducible
- Input changes must be traceable
- Backend recalculates totals on every save
- Future versions may include audit logs

Goal:
Numbers shown today must be explainable tomorrow.


## File Structure
app/
├── (auth)/
│   └── login/
│       └── page.tsx
├── dashboard/
│   ├── page.tsx
│   ├── feed-mill/
│   │   ├── recipe-master/
│   │   │   └── page.tsx
│   │   ├── rm-inventory/
│   │   │   └── page.tsx
│   │   └── production/
│   │       └── page.tsx
│   │   ├── sales/
│   │   │   └── page.tsx
│   │   └── poultry/
│   │       └── page.tsx   (future)
├── api/
│   ├── auth/
│   ├── users/
│   ├── feed-mill/
│   └── inventory/
├── features/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── auth.service.ts
│   ├── dashboard/
│   │   └── DashboardCards.tsx
│   ├── feed-mill/
│   │   ├── RecipeGrid.tsx
│   │   ├── RMInventoryGrid.tsx
│   │   ├── ProductionGrid.tsx
│   │   └── feedMill.service.ts
│   └── sales/
│       └── SalesGrid.tsx
├── components/
│   ├── AppLayout.tsx
│   ├── Sidebar.tsx
│   ├── RoleGuard.tsx
│   └── TableToolbar.tsx
├── lib/
│   ├── db.ts          # Prisma client
│   ├── auth.ts        # NextAuth config
│   ├── permissions.ts
│   └── calculations/ # Excel formulas go here
│       ├── recipe.ts
│       ├── inventory.ts
│       └── production.ts
│
├── constants/
│   └── roles.ts
│
├── types/
│   └── index.ts




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

