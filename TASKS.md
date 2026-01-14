# Inventory Flow Decision — Single Store vs Multi-Location Stock (FeedMill/Poultry + Store + Procurement)

This document explains two valid inventory models and recommends when to use each.

---

## 1) The Two Real-World Models

### Model A: Single Source of Truth (Store-Only Stock)
- All physical stock is owned by **Store**
- Feed Mill and Poultry do NOT hold separate stock in the system
- Modules request items from store OR production deducts from store directly
- "Module inventory tab" is a filtered view of store stock

✅ Pros:
- Simple to build
- Fewer bugs / mismatches
- Easier audits
- Faster MVP

❌ Cons:
- Not accurate if departments physically keep their own sub-stores
- Hard to answer: “What is inside Feed Mill store-room vs main store?”

---

### Model B: Multi-Location Inventory (Recommended for realism)
- Stock exists in multiple “locations”:
  - STORE (Main warehouse)
  - FEED_MILL (Feed mill store-room)
  - POULTRY (Poultry store-room)
- Each location has its own balance
- Stock moves via **Transfers**

Example:
- Maize in FEED_MILL = 1kg
- Maize in STORE = 5kg
- Total farm maize = 6kg

✅ Pros:
- Matches real operations
- Lets modules work independently until depleted
- Accurate tracking of where stock physically is
- Better accountability (“who transferred/received?”)

❌ Cons:
- More complex than Model A
- Requires transfer flows, approvals, and reconciliation
- Needs stronger logging + transaction safety

---

## 2) Is Your Maize Example Correct?
YES ✅

In Model B:
- Store inventory is NOT the same as Feed Mill inventory
- They are separate balances by location
- Total farm stock is the sum across locations

That is correct and realistic.

---

## 3) Recommended Best Approach (Practical)
### Start with Model A for MVP, then upgrade to Model B only if needed.

However, if your boss explicitly expects:
- “Store sends items to feed mill”
- “Feed mill has its own stock”
- “Poultry also has its own stock”
Then you should implement Model B now.

---

## 4) If we choose Model B (Multi-Location), here is the correct flow

### A) Procurement → Store (receiving into the farm)
1. Procurement approves purchase
2. Store Keeper receives goods into STORE location
3. STORE stock increases

### B) Store → Module (transfer to Feed Mill / Poultry)
1. Module raises request
2. Store transfers stock to FEED_MILL (or POULTRY)
3. STORE stock decreases
4. FEED_MILL stock increases

### C) Module usage (production consumes module stock)
1. Feed Mill produces feed
2. Ingredients are deducted from FEED_MILL location stock
3. Finished goods increase (in finished goods location or feed mill output)

Escalation rule:
- If STORE cannot fulfill transfer, STORE creates procurement request.

---

## 5) Data Model for Model B (Codex should build this)

### Inventory Items (Master)
`inventory_items`
- id, name, unit, category, is_active, timestamps

### Locations
`inventory_locations`
- id
- name: `STORE`, `FEED_MILL`, `POULTRY`
- is_active

### Inventory Ledger (Truth)
`inventory_ledger`
- id
- item_id
- location_id
- type: `RECEIPT` | `TRANSFER_IN` | `TRANSFER_OUT` | `USAGE` | `ADJUSTMENT`
- quantity (positive)
- direction: `IN` | `OUT`
- unit_cost (for receipts)
- reference_type + reference_id
- created_by
- created_at

### Transfer Requests
`transfer_requests`
- id
- from_location_id (STORE)
- to_location_id (FEED_MILL or POULTRY)
- status: `PENDING` | `APPROVED` | `REJECTED` | `COMPLETED`
- requested_by
- approved_by
- completed_by
- notes
- timestamps

`transfer_request_lines`
- id
- transfer_request_id
- item_id
- quantity_requested
- quantity_transferred

### Procurement Requests (only from STORE)
`procurement_requests`
- id
- status: `PENDING` | `APPROVED` | `REJECTED` | `RECEIVED`
- created_by (storekeeper)
- approved_by (procurement)
- received_by (storekeeper)
- notes
- timestamps

`procurement_request_lines`
- id
- procurement_request_id
- item_id
- quantity_requested
- quantity_received
- unit_cost_at_receipt

---

## 6) UI Implications (What Codex should build)

### Store pages
- Store Inventory (location=STORE)
- Transfer Requests (outgoing to modules)
- Procurement Requests (escalations)

### Feed Mill pages
- Feed Mill Inventory (location=FEED_MILL)
- Request transfer from STORE
- Production consumes FEED_MILL stock

### Poultry pages
- Poultry Inventory (location=POULTRY)
- Request transfer from STORE
- Poultry usage consumes POULTRY stock

---

## 7) Integrity Rules (Non-Negotiable)
- Stock changes must be transactional
- Never allow negative stock in a location
- Transfer completion creates:
  - ledger OUT in STORE
  - ledger IN in destination
- Procurement receiving creates:
  - ledger IN in STORE
- Production usage creates:
  - ledger OUT in module location

---

#