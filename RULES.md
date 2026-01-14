# Inventory Architecture Decision — Store vs Module Inventories (Codex Build Spec)

This document answers:
- Should Feed Mill and Poultry have their own inventory tabs?
- Or should Store Inventory be the single source of truth?
- What is the best operational flow (Store ↔ Modules ↔ Procurement)?
- How to implement CRUD without creating conflicting stock truths?

Goal: avoid double-counting, keep flows realistic, and keep the system scalable to SaaS.

---

## 1) Recommended Approach (Best Practice)

✅ **Use ONE unified Inventory system (Store as the single source of truth)**  
and let module pages (Feed Mill / Poultry) show **filtered views** of that same inventory.

### Why this is best
- Prevents having 2–3 different “stocks” for the same item (double-counting nightmare)
- Ensures every item has exactly one quantity on hand
- Makes audit + accountability simple
- Matches real-world operations: the store/warehouse owns stock truth

> If Feed Mill and Store both track “Maize stock”, your numbers will diverge and you’ll fight it forever.

---

## 2) How modules should “have inventory tabs” without separate inventories

### Correct design
- **Store Inventory = the inventory**
- Feed Mill inventory tab = **view** of store inventory filtered by category or “allowed items”
- Poultry inventory tab = **view** of store inventory filtered similarly

This gives module managers the UX they want (their own tab), but avoids multiple sources of truth.

---

## 3) Operational Flow (What you described is correct, with 1 tweak)

Your idea:
> Module managers reach out to Store when they’re out; if Store can’t replenish, Store reaches out to Procurement.

✅ This is the best flow.

### Improved version (with proper statuses)
Module Manager requests items from Store (ISSUE REQUEST)
↓
Store Keeper issues stock if available (ISSUED)
↓
If Store is short:
Store Keeper creates procurement request (PROCUREMENT REQUEST)
↓
Procurement approves/rejects (APPROVED/REJECTED)
↓
When items arrive:
Store Keeper receives into inventory (RECEIVED)
↓
Store Keeper then issues to module (ISSUED)

Key rule:
- Procurement increases inventory only on **RECEIPT**
- Modules decrease inventory only through **ISSUE/USAGE**

---

## 4) What to build: Two types of "Requests"

### A) Module → Store: Issue Request (Internal)
Purpose: module asking store for items to use in operations/production.

Statuses:
- `PENDING` (requested by module)
- `APPROVED` (storekeeper accepted request)
- `ISSUED` (items given out; inventory reduced)
- `REJECTED` (storekeeper rejects request)
- `CANCELLED`

### B) Store → Procurement: Procurement Request (External)
Purpose: store asking procurement to buy items.

Statuses:
- `PENDING`
- `APPROVED`
- `REJECTED`
- `RECEIVED` (storekeeper confirms delivery; inventory increases)

---

## 5) Inventory CRUD — What is allowed where?

### Unified Store Inventory CRUD (true CRUD)
Store keeper can:
- Create inventory items (master data)
- Update metadata (name, category, reorder level, unit)
- Archive items

Stock changes are NOT direct edits; they are movements:
- Receive stock
- Issue stock
- Adjust stock (with reason)

### Module Inventory Tabs (Feed Mill / Poultry)
Modules should NOT “CRUD stock” directly.

Instead, modules can:
- View items + available quantity
- Submit Issue Requests to Store
- View request history
- For production:
  - production consumes inventory via server function (ledger OUT)

This prevents:
- module staff editing numbers manually
- conflicting stock quantities across tabs

---

## 6) How to keep “Feed Mill inventory tab” useful without separate stock

Feed Mill tab should show:
- Ingredients relevant to feed formulas
- Available stock quantity
- Low stock warning
- Button: `Request from Store`

Poultry tab should show:
- Poultry-specific items (meds, feed, equipment)
- Available stock
- Button: `Request from Store`

Both tabs read from the same tables:
- `inventory_items`
- computed `stock_on_hand` from ledger or snapshot

---

## 7) Database Model (Minimal, Scalable)

### Inventory Items (Master)
`inventory_items`
- id, name, category, unit, reorder_level, is_active, timestamps

### Inventory Ledger (Truth)
`inventory_ledger`
- id
- item_id
- type: `RECEIPT` | `ISSUE` | `ADJUSTMENT` | `PRODUCTION_USAGE`
- direction: `IN` | `OUT`
- quantity
- unit_cost (for receipts)
- reference_type + reference_id
- created_by
- created_at

Stock on hand is:
`SUM(IN) - SUM(OUT)` per item  
(or maintain `inventory_balances` snapshot later)

### Issue Requests (Module → Store)
`issue_requests`
- id
- requested_by (user)
- requesting_module: `FEED_MILL` | `POULTRY`
- status
- notes
- timestamps

`issue_request_lines`
- id
- issue_request_id
- item_id
- requested_qty
- issued_qty (filled on issuance)

### Procurement Requests (Store → Procurement)
`procurement_requests`
- id
- created_by (storekeeper)
- status
- notes
- timestamps

`procurement_request_lines`
- id
- procurement_request_id
- item_id
- requested_qty
- received_qty
- unit_cost_at_receipt

### Activity Logs
`activity_logs`
- id, user_id, action, entity_type, entity_id, metadata(json), created_at

---

## 8) Route / UI Structure (What Codex builds)

### Store Section
Route: `/store`
Tabs:
- `/store/inventory`
- `/store/requests`
- `/store/procurement-requests` (optional, store view)

Inventory page:
- grid of items + stock
- actions: Receive / Issue / Adjust
Requests page:
- list Issue Requests from modules
- approve/reject/issue actions
- when issuing:
  - validate stock
  - write ledger OUT entries
  - update request status to ISSUED
Procurement requests:
- create procurement request when stock is insufficient

### Procurement Section
Route: `/procurement`
- list pending procurement requests
- approve/reject with comments
- does not change inventory

### Feed Mill Inventory View
Route: `/feed-mill/inventory`
- filtered inventory view (category FEED_MILL or shared)
- create issue request to store

### Poultry Inventory View
Route: `/poultry/inventory`
- filtered inventory view (category POULTRY or shared)
- create issue request to store

---

## 9) API / Server-side Requirements (Avoid RLS/Client issues)

All writes must be server-side endpoints:
- `POST /api/issue-requests` (module creates request)
- `POST /api/issue-requests/:id/approve` (storekeeper)
- `POST /api/issue-requests/:id/issue` (storekeeper; creates ledger OUT)
- `POST /api/procurement-requests` (storekeeper creates procurement request)
- `POST /api/procurement-requests/:id/approve|reject` (procurement manager)
- `POST /api/procurement-requests/:id/receive` (storekeeper; creates ledger IN)

Production endpoints:
- validate and create ledger OUT entries of type `PRODUCTION_USAGE`

All of these must also write `activity_logs` entries server-side.

---

## 10) Why NOT a "Store Reserve + Module Inventory" split?

If you maintain:
- Store stock AND Feed Mill stock AND Poultry stock separately

You will need:
- transfers
- reconciliation
- double ledger systems
- constant mismatch resolution

This becomes ERP-level complexity quickly.

✅ A single inventory + issue request flow gives the same real-world behavior with far less complexity.

---

## Success Criteria

- Only one inventory truth exists
- Modules can request stock from store
- Store can issue stock, or escalate to procurement
- Procurement approves purchases; receiving increases stock
- Production and usage deduct stock safely
- Admin can audit who did what and when

---
