Jirella Farms Aquaculture Management System

This document describes the Hatchery & Breeding Unit module to be integrated into the existing Catfish Production System.

The hatchery module manages broodstock maintenance, spawning events, fry production, and internal transfers to the Fingerlings module.

1. System Context

The farm production lifecycle is:

Hatchery
   ↓
Fingerlings
   ↓
Juvenile
   ↓
Grow-out (Adults)

The Hatchery Module is responsible for producing fry, which are internally transferred to the Fingerlings module.

2. Navigation Structure

Add Hatchery to the main navigation under the Catfish module.

Catfish
 ├── Overview
 ├── Hatchery
 │   ├── Broodstock Logs
 │   ├── Spawning Events
 │   ├── Fry Transfers
 │   └── Hatchery Financials
 ├── Fingerlings
 ├── Juvenile
 └── Grow-out
3. Hatchery Pages
3.1 Broodstock Logs Page

Tracks feeding and mortality of broodstock fish used for reproduction.

Route
/catfish/hatchery/broodstock
Table Fields
Field	Type	Description
log_date	date	Date of feeding
feed_brand	text	Brand of feed
feed_amount_kg	number	Quantity used
feed_unit_price	number	Price per kg
daily_feed_cost	computed	feed_amount × unit_price
mortality_count	integer	Number of broodstock deaths
Supabase Table
broodstock_logs
Computed Field
daily_feed_cost = feed_amount_kg * feed_unit_price
4. Spawning Events Page

Tracks breeding operations where eggs are produced.

Route
/catfish/hatchery/spawning
Table Fields
Field	Type	Description
event_date	date	Spawning date
females_stripped	integer	Number of female broodstock used
hormone_cost	number	Cost of hormone used
male_fish_cost	number	Cost of male broodstock
sacrificed_male_weight_kg	number	Weight of male fish sacrificed
status	enum	Incubating / Completed / Failed
Supabase Table
spawning_events
Status Lifecycle
Incubating → Completed
Incubating → Failed
5. Fry Transfers Page

This page closes the hatchery cycle.

It records the number of fry produced and transferred to the Fingerlings module.

Route
/catfish/hatchery/transfers
Table Fields
Field	Type	Description
spawning_event_id	uuid	reference to spawning event
transfer_date	date	date fry moved
live_fry_count	integer	number of fry
internal_price_per_fry	number	accounting transfer price
sacrificed_male_meat_price	number	price/kg of male meat
total_transfer_value	computed	financial value
Supabase Table
fry_transfers
Computation
total_transfer_value =
(live_fry_count * internal_price_per_fry)
+
(sacrificed_male_meat_price * sacrificed_male_weight_kg)

This value becomes the inventory cost for the Fingerlings module.

6. Automatic Transfer to Fingerlings

When a fry transfer is recorded, the system should automatically create a fingerlings batch.

Logic
Insert fry_transfer
      ↓
Create Fingerlings Batch
Data Passed
Hatchery	Fingerlings
live_fry_count	initial_stock
transfer_date	batch_start_date
total_transfer_value	batch_cost
7. Hatchery Financials Page
Route
/catfish/hatchery/financials
Metrics

Display aggregated totals:

Metric	Calculation
Total Broodstock Feed Cost	SUM(daily_feed_cost)
Total Hormone Cost	SUM(hormone_cost)
Total Male Fish Cost	SUM(male_fish_cost)
Total Fry Produced	SUM(live_fry_count)
Total Transfer Value	SUM(total_transfer_value)
8. UI Components

Use the same UI pattern used across other modules.

Components needed:

DataTable
CreateModal
EditModal
DeleteConfirm
FinancialSummaryCards
9. Supabase Tables
broodstock_logs
id
log_date
feed_brand
feed_amount_kg
feed_unit_price
daily_feed_cost (generated)
mortality_count
spawning_events
id
event_date
females_stripped
hormone_cost
male_fish_cost
sacrificed_male_weight_kg
status
fry_transfers
id
spawning_event_id
transfer_date
live_fry_count
internal_price_per_fry
sacrificed_male_meat_price
total_transfer_value (generated)
10. Access Control

Use Supabase RLS.

Role	Permissions
Admin	Full access
Staff	Create + View
Viewer	Read only
11. Important Business Logic
1️⃣ Hatchery feeds Fingerlings
Hatchery fry transfer
      ↓
Fingerlings batch creation
2️⃣ Hatchery has no sales

Hatchery only transfers internally.

3️⃣ Financial Tracking

All hatchery costs should contribute to:

Fingerlings production cost

This ensures true farm profitability tracking.

12. Future Improvements (Optional)

Possible enhancements:

• Hatch rate tracking
• Fertilization success rate
• Fry survival percentage
• incubation monitoring

Final Architecture
Catfish System

Hatchery
 ├─ Broodstock Logs
 ├─ Spawning Events
 └─ Fry Transfers
       ↓
Fingerlings
       ↓
Juvenile
       ↓
Grow-out


