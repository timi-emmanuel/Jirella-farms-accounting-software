# Feed Mill → Poultry Feed Usage Flow (Model B) — Update Spec for Codex

This spec updates the current design so that:
- Feed Mill **produces finished feed**
- Poultry **consumes finished feed**
- Some finished feed is **sold to the public**
- Not all feed produced is consumed internally

This reflects real farm operations:
- Feed Mill output is a finished product (bags/kg)
- Poultry feeding should not “re-produce” feed
- Internal usage happens via transfer from Feed Mill to Poultry

---

## 1) Core Decision

✅ Finished feeds produced in Feed Mill are **Finished Goods**.

Examples:
- Layers Mash 25kg
- Grower Mash 25kg
- Starter Mash 15kg

Finished goods can go to:
1. **Internal consumption** (transfer to POULTRY)
2. **External sales** (public sales)

---

## 2) Locations (Model B)

Inventory is location-scoped:
- `STORE` (optional central warehouse)
- `FEED_MILL` (finished feed stock is here after production)
- `POULTRY` (feed stock available for feeding birds)

For MVP:
- Finished feed stock starts at `FEED_MILL` after production.
- Poultry feed stock is replenished only via `FEED_MILL -> POULTRY` transfer.

---

## 3) Data Model (Minimal Changes)

### A) Finished Feed Products
Represent each produced feed product as a `Product` (or an InventoryItem flagged as finished good).

Option A (recommended): use `products` table + finished goods ledger.
Option B (simpler MVP): use `inventory_items` for finished feed as well.

Codex should pick ONE approach and apply consistently.

---

## 4) Workflow Overview

### Step 1 — Produce Feed (Feed Mill)
Input:
- recipeId
- quantityProducedKg (or bags + bagSize)

System actions:
1. Validate raw ingredient availability in `FEED_MILL` location (or STORE depending on how you do raw material storage).
2. Deduct raw materials from FEED_MILL location (ledger OUT, type=PRODUCTION_USAGE).
3. Create finished feed stock in FEED_MILL location (ledger IN, type=PRODUCTION_OUTPUT).
4. Store production costing snapshots:
   - costPerKg
   - costPerBag15kg
   - costPerBag25kg

Result:
- Finished feed is now available in FEED_MILL for either sale or transfer.

---

### Step 2 — Transfer Finished Feed to Poultry (Internal Supply)
When poultry needs feed:
- Poultry creates a **Transfer Request** from `FEED_MILL -> POULTRY` for a specific finished feed product.

Statuses:
- PENDING
- APPROVED
- COMPLETED

On completion:
1. Deduct finished feed stock from FEED_MILL (ledger OUT, type=TRANSFER_OUT).
2. Add finished feed stock into POULTRY (ledger IN, type=TRANSFER_IN).
3. Carry cost information forward (unitCostAtTime) for accurate poultry costing.

Result:
- Poultry now has feed stock to consume daily.

---

### Step 3 — Poultry Daily Feeding Uses Finished Feed Stock
When poultry logs daily feeding:
- User selects feed product (e.g., Layers Mash 25kg)
- enters `feedConsumedKg` (or bags consumed, but internally store as KG)

Validation:
- Check available stock for that feed product in POULTRY location.
- If insufficient → block save and show shortage.

On save:
1. Create PoultryDailyLog record.
2. Deduct finished feed stock from POULTRY (ledger OUT, type=USAGE).
3. Compute KPI fields (HDP, FCR, etc.) (derived).

Result:
- Poultry feeding cost is based on the produced feed cost, not raw ingredients.

---

### Step 4 — Public Sales from Feed Mill Stock
Sales of feed to public are recorded from FEED_MILL location.

When logging a sale:
- Product = finished feed product
- Location for stock deduction = FEED_MILL
- Quantity sold (bags or kg)
- Unit selling price

Validation:
- Check FEED_MILL finished feed stock >= qty sold

On submit:
1. Insert Sale record (module=FEED_MILL).
2. Deduct stock from FEED_MILL (ledger OUT, type=SALE_OUT).
3. Compute revenue, COGS, profit (derived or stored snapshot for audit).

Result:
- Feed Mill can sell externally and also supply poultry internally.

---

## 5) Important Rules (Must Enforce)

1. Poultry does NOT consume raw ingredients directly (maize/soya) in normal flow.
   - Poultry consumes finished feed products.

2. Production creates finished feed stock at FEED_MILL.
   - That stock is the only source for poultry feed usage and public sales.

3. Transfer is required for internal consumption:
   - Poultry stock increases only via FEED_MILL -> POULTRY transfer.

4. Costs must be preserved:
   - Use `unitCostAtTime` carried through transfers and usage to compute cost-per-crate accurately.

---

## 6) UI Requirements (Routes)

### Feed Mill
- `/feed-mill/production` (create production batch)
- `/feed-mill/stock` (view finished feed stock at FEED_MILL)
- `/feed-mill/sales` (public sales)
- `/feed-mill/transfers` (outgoing transfers to POULTRY)

### Poultry
- `/poultry/inventory` (view finished feed stock at POULTRY)
- `/poultry/requests` (request feed from FEED_MILL)
- `/poultry/daily-log` (daily feeding + eggs + mortality)

---

## 7) MVP Tasks for Codex (Implementation Checklist)

1. Ensure finished feed products exist (one per recipe + bag size).
2. On feed mill production confirm:
   - deduct raw materials
   - add finished feed stock at FEED_MILL
3. Add transfer request flow for finished feed:
   - FEED_MILL -> POULTRY
4. Update Poultry Daily Log:
   - feed selection should reference finished feed product
   - validate stock at POULTRY
   - deduct finished feed on save
5. Update Sales:
   - allow public sales from FEED_MILL stock
   - validate and deduct finished feed stock
6. Update dashboards and reports:
   - poultry feed cost uses finished feed cost
   - feed mill profit separates internal transfer vs public sales (optional)

---

## 8) Notes / Simplifications

- Quantity should be stored consistently:
  - store as KG internally
  - UI can accept “bags” and convert to KG
- If you want STORE to be central later:
  - allow FEED_MILL -> STORE transfers too
  - and STORE -> POULTRY transfers
  - but MVP can be direct FEED_MILL -> POULTRY

---
# Finished Goods (Feed) — Stock Movement & History (Feed Mill)

This section clarifies how **finished feed stock** behaves in the system,
how its value increases, how it decreases, and how history must be tracked.

This applies specifically to **Feed Mill finished feeds**.

---

## 1) Core Principle (Non-Negotiable)

Finished feed stock behaves like this:

### ✅ Finished Feed Stock INCREASES in only ONE way
- When feed is **produced** in Feed Mill production.

### ❌ Finished Feed Stock DECREASES in exactly TWO ways
1. When feed is **transferred to Poultry** for bird feeding (internal consumption)
2. When feed is **sold to the public** (external sales)

There are **no other valid ways** finished feed stock should change in MVP.

---

## 2) Finished Goods Lifecycle

### A) Production (Stock Increase)
Location: `FEED_MILL`

When a production batch is confirmed:
1. Raw materials are deducted (ingredients ledger OUT)
2. Finished feed stock is created (ledger IN)

Ledger entry:
- type: `PRODUCTION_OUTPUT`
- direction: `IN`
- location: `FEED_MILL`
- quantity: produced feed (kg)
- unitCostAtTime: cost per kg from production

This is the **only operation that increases finished feed stock**.

---

### B) Internal Usage — Transfer to Poultry (Stock Decrease)
Location change: `FEED_MILL → POULTRY`

When Poultry requests feed:
1. Transfer request is approved
2. Finished feed stock is reduced at FEED_MILL
3. Same feed stock is increased at POULTRY

Ledger entries:
- FEED_MILL:
  - type: `TRANSFER_OUT`
  - direction: `OUT`
- POULTRY:
  - type: `TRANSFER_IN`
  - direction: `IN`

This represents **internal consumption preparation**, not a sale.

---

### C) External Usage — Public Sales (Stock Decrease)
Location: `FEED_MILL`

When feed is sold to customers:
1. Sale is recorded
2. Finished feed stock is reduced at FEED_MILL

Ledger entry:
- type: `SALE_OUT`
- direction: `OUT`
- location: `FEED_MILL`

This represents **external revenue generation**.

---

## 3) Finished Goods History (MANDATORY FEATURE)

A **Finished Goods History** view must exist to answer:

> “Why did the finished feed quantity reduce?”

### Feed Mill → Production → Finished Goods Tab

This page must show:
- current finished feed stock (by product)
- total produced
- total transferred to poultry
- total sold to public

---

## 4) Finished Goods Movement History Table

Each finished feed product must have a **movement history** showing:

Columns:
- Date
- Action Type:
  - `PRODUCED`
  - `TRANSFERRED_TO_POULTRY`
  - `SOLD`
- Quantity (kg / bags)
- Reference:
  - Production Batch ID
  - Transfer Request ID
  - Sale ID
- Performed By (user)
- Location (always FEED_MILL for reductions)
- Cost per Kg at time (for audit)

This history must be derived from the inventory ledger.

---

## 5) Rules Codex MUST Enforce

1. Finished feed stock can only increase via production.
2. Finished feed stock can only decrease via:
   - transfer to poultry
   - sale to public
3. Poultry feeding must never deduct directly from FEED_MILL.
   - It must deduct from POULTRY stock after transfer.
4. Sales must always deduct from FEED_MILL stock.
5. Every reduction must have:
   - a reason
   - a reference record
   - a user

No silent stock changes.

---

## 6) Why This Matters (Business Reasoning)

This design allows the boss to answer:
- How much feed did we produce?
- How much went to poultry?
- How much was sold?
- Where did the stock go?
- Are we losing feed internally or selling more?

It also:
- prevents stock manipulation
- supports audits
- matches real farm operations

---

## 7) Summary (Mental Model)

Finished feed is like money in a wallet:

- **Earned** only by production
- **Spent** either internally (poultry) or externally (sales)
- Every movement must be traceable

If it didn’t get produced, it cannot exist.
If it reduced, it must have gone somewhere.

---
