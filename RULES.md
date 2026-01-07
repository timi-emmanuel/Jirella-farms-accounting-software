# RULES.md
Feed Mill Management System – Core Engineering & Domain Rules

This document defines the non-negotiable rules that guide the design, implementation, and evolution of the Feed Mill system.  
Any feature, refactor, or optimization **must comply** with these rules.

---

## 1. Source of Truth Rules

### 1.1 Backend is the Source of Truth
- All authoritative calculations must happen on the backend (database / server logic).
- The frontend must never be trusted as the final authority for any numeric result.

> If UI and backend values differ, the backend value is correct.

---

### 1.2 UI Calculations Are Feedback Only
Frontend calculations exist solely for:
- user feedback
- previews
- form validation hints

They must **never** be relied upon for:
- persistence
- reporting
- auditing
- financial decisions

---

## 2. Data Storage Rules

### 2.1 Store Raw Inputs Only
Only persist **raw, user-entered values**, such as:
- ingredient percentages
- batch size
- unit prices
- quantities

❌ Do NOT store:
- total cost
- cost per kg
- computed weights
- derived summaries

---

### 2.2 Derived Values Must Be Recomputable
Every derived value must be:
- reproducible
- deterministic
- explainable from stored inputs

If a value cannot be recomputed from stored data, it should not be stored.

---

### 2.3 Never Mutate Historical Data
Once data is used for:
- production
- sales
- reports

It must not change retroactively.

Future changes require:
- versioning
- snapshots
- or explicit overrides

---

## 3. Excel Alignment Rules

### 3.1 Excel Is the Reference Standard
Existing Excel sheets are the **validation baseline**.

All system calculations must be verifiable against:
- current Excel formulas
- historical Excel outputs

If results differ:
> The system is wrong until proven otherwise.

---

### 3.2 Excel Logic Must Be Explainable
Every Excel formula used must be:
- explainable in plain English
- translatable to backend logic (SQL / TypeScript)

Unexplainable or opaque formulas are not allowed.

---

## 4. Calculation Rules

### 4.1 Percentages Must Sum to 100%
- Recipe formulations must total exactly **100%**
- UI should warn
- Backend must enforce

Invalid formulations must never be saved.

---

### 4.2 Batch Size Drives All Calculations
- Batch size is the multiplier for all weights and costs.
- Changing batch size must:
  - not mutate stored ingredient data
  - only affect computed outputs

---

### 4.3 No Silent Unit Conversions
- All units must be explicit (kg, g, ₦/kg, ₦/ton)
- Any conversion must be:
  - documented
  - centralized
  - deterministic

No hidden or implicit conversions.

---

## 5. Database Integrity Rules

### 5.1 No Orphan Records
- Every RecipeItem must reference:
  - a valid Recipe
  - a valid Ingredient

Use:
- foreign keys
- constraints
- referential integrity

---

### 5.2 Deletions Must Be Intentional
Bulk delete + reinsert (e.g. recipe items) is allowed **only if**:
- data is not historical
- the operation is logically atomic

Future enhancement:
- transactions
- versioned formulas

---

## 6. Authentication & Authorization Rules

### 6.1 Authentication ≠ Authorization
- Supabase Auth handles identity
- Application logic handles:
  - roles
  - permissions
  - access control

Never rely on frontend role checks alone.

---

### 6.2 Backend Must Enforce Permissions
- UI hiding is not security
- Sensitive operations must be protected by:
  - backend logic
  - database policies (RLS)

---

## 7. Domain-Specific Rules (Feed Mill)

### 7.1 Ingredients Are Global
- Ingredients are master data
- Recipes reference ingredients
- Ingredient data must not be duplicated per recipe

---

### 7.2 Costs Are Time-Sensitive
- Ingredient costs can change over time
- Recipes should reflect **current costs** by default

Future enhancement:
- cost snapshots per production run

---

## 8. Transparency & Debugging Rules

### 8.1 Every Number Must Be Explainable
For any number shown, the system must be able to answer:
- which ingredients contributed?
- at what percentage?
- at what unit price?
- at what weight?

Black-box numbers are forbidden.

---

### 8.2 Prefer Explicit Over Clever
- Simple, readable logic is preferred
- Avoid compact but unreadable formulas

Clarity > cleverness.

---

## 9. Absolute Non-Negotiables (TL;DR)

These rules must **never** be broken:

- Backend is the source of truth
- Store raw inputs only
- UI calculations are feedback
- Excel is the validation reference
- Percentages must equal 100%
- Never store derived totals
- Every number must be explainable

---

