# System Design
Farm Management & Proceeds Calculation System

---

## 1. Architecture Overview

The system follows a full-stack JavaScript architecture using Next.js as both frontend and backend.

Client (Browser)
→ Next.js (UI + Server Components)
→ API Routes (Business Logic)
→ Prisma ORM
→ PostgreSQL Database

---

## 2. Frontend Architecture

### Framework
- Next.js (App Router)
- React

### Styling
- Tailwind CSS
- shadcn/ui

### Responsibilities
- Authentication UI
- Role-based dashboards
- Data entry forms
- Reports, tables, and charts

---

## 3. Authentication & Authorization

### Authentication
- Implemented using NextAuth (Auth.js)
- Credentials-based login (email + password)

### Authorization
- Each user has a role stored in the database:

role: ADMIN | MANAGER | WORKER | ACCOUNTANT

- Role checks are enforced:
  - In API routes
  - In server components
  - In UI rendering logic

---

## 4. Backend & Business Logic

### API Layer
- Built using Next.js API routes
- Handles:
  - CRUD operations
  - Calculations
  - Aggregations
  - Input validation

### Business Logic Example

profit = totalSales - (feedCost + laborCost + miscExpenses)

All calculations are executed server-side.

---

## 5. Excel-like Formula Handling

### Phase 1 – Hardcoded Logic
- Excel formulas are translated into JavaScript functions
- Safer and easier to debug
- Suitable for stable formulas

### Phase 2 – Configurable Formulas (Future)
- Store formulas in the database
- Evaluate formulas using a safe math parser
- Allows formula updates without redeploying the application

---

## 6. Database Design

### Core Tables
- users
- feed_records
- livestock
- expenses
- sales
- reports

### ORM
- Prisma is used for:
  - Schema definition
  - Migrations
  - Type-safe queries

---

## 7. Reporting & Aggregation

- Server-side aggregation for performance
- Time-based reports:
  - Daily
  - Weekly
  - Monthly

---

## 8. Security

- Password hashing
- Role-based access control
- Input validation
- Server-side calculations only

---

## 9. Scalability

- Modular API routes
- Centralized business logic
- Database structured for growth and multi-farm support

---

## 10. Future Enhancements

- Audit logs
- Inventory alerts
- Notifications
- Multi-farm support
- Mobile-first improvements
