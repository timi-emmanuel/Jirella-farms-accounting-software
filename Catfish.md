🐟 Juvenile Production Module

Stage 2 of Catfish Lifecycle (Post-Fingerlings)
Built with: Next.js + Supabase (Self-hosted) + RLS

🎯 Objective

Implement the Juvenile Production Module as an independent production stage that:

Receives stock via transfer from Fingerlings

Tracks daily feed & mortality

Tracks sampling data (ABW + length)

Computes biomass and FCR

Calculates cost of production

Supports transfer to Melange

Supports external harvest/sales

Provides full financial visibility per batch

Juvenile is a batch-driven operational unit.

🧱 Architecture Overview
Catfish
   ↓
Fingerlings
   ↓
Juvenile
   ↓
Melange

Juvenile batches:

Are created manually OR

Are auto-created via transfer from Fingerlings

Each batch maintains:

Stock tracking

Growth tracking

Feed cost tracking

Profitability tracking

📂 Routing Structure (Next.js App Router)
Module Level
/catfish/juvenile
Pages

/catfish/juvenile

/catfish/juvenile/new

/catfish/juvenile/analytics

Batch Level
/catfish/juvenile/[batchId]

Subroutes:

/catfish/juvenile/[batchId]/logs
/catfish/juvenile/[batchId]/finance
/catfish/juvenile/[batchId]/transfer
/catfish/juvenile/[batchId]/harvest
/catfish/juvenile/[batchId]/sales
/catfish/juvenile/[batchId]/settings
🗄 Database Schema
1️⃣ Juvenile Daily Logs

From documentation 

juvenile

:

CREATE TABLE juvenile_daily_logs ( 
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE, 
    log_date DATE NOT NULL DEFAULT CURRENT_DATE, 
    feed_brand TEXT NOT NULL, 
    feed_amount_kg NUMERIC NOT NULL, 
    feed_unit_price NUMERIC NOT NULL, 
    daily_feed_cost NUMERIC GENERATED ALWAYS AS (feed_amount_kg * feed_unit_price) STORED, 
    mortality_count INTEGER DEFAULT 0, 
    abw_grams NUMERIC, 
    average_length_cm NUMERIC, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) 
);
📊 Operational Logic
1️⃣ Stock Calculation
current_stock =
initial_stock
- SUM(mortality_count)
- SUM(external_sales_quantity)
- SUM(transfer_out_quantity)
+ SUM(transfer_in_quantity)

Must never drop below 0.

2️⃣ Feed Cost
total_feed_cost =
SUM(daily_feed_cost)

Derived from logs.

3️⃣ Biomass
biomass_kg =
(current_stock × latest_abw_grams) / 1000

ABW comes from latest log where abw_grams is not null.

4️⃣ FCR
FCR =
total_feed_kg / total_weight_gain_kg

Weight gain:

(current_biomass - initial_biomass)
💰 Financial Model

Juvenile must track:

Transfer cost from Fingerlings

Feed cost

Operational expenses

Revenue (sales or transfer to Melange)

Cost Structure
total_cost =
transfer_cost_basis
+ total_feed_cost
+ other_expenses
Cost Per Fish
cost_per_fish =
total_cost / current_stock
Cost Per Kg
cost_per_kg =
total_cost / biomass_kg
Revenue

From:

External sales

Transfer valuation to Melange

Profit
gross_profit = total_revenue - total_cost
🔁 Transfer Logic (Juvenile → Melange)

Route:

/catfish/juvenile/[batchId]/transfer

Transfer form:

Quantity

Transfer date

Destination: Melange

Notes

On Transfer:

Deduct stock

Calculate cost_per_fish

Compute transfer_cost_basis

Create Melange batch

Record linkage via parent_batch_id

📈 UI Requirements
Batch Dashboard

Display:

Current stock

Mortality total

Total feed cost

Latest ABW

Average length

Biomass

FCR

Cost per fish

Profit status badge

Logs Page

Table view:

Date

Feed brand

Feed kg

Feed cost

Mortality

ABW

Length

Add Log modal:

Feed brand

Feed kg

Feed price

Mortality

Optional ABW

Optional Length

Finance Page

Display:

Transfer cost basis

Feed cost

Total cost

Revenue

Profit

Margin

Expense breakdown chart

🔐 RLS Requirements

Policies must ensure:

Only users from same farm can view batches

Transfers limited within same farm

Logs restricted by batch ownership

⚠️ Business Rules

ABW only required on sampling days

Cannot transfer more than available stock

Batch auto-completes if stock = 0

Financial calculations must be SQL-based

Deleting logs must trigger recalculation

📊 Module Analytics Page

/catfish/juvenile/analytics

Show:

Average FCR across batches

Mortality trends

Best performing batch

Cost comparison per batch

Growth curve visualization

🧠 Engineering Principles

All calculations in SQL views

UI consumes computed values

Maintain historical cost integrity

Transfer cost basis must be frozen at time of transfer

Never recalc historical transfers

🚀 Final Expected Outcome

Each Juvenile batch behaves as:

A growth tracker

A financial unit

A lifecycle stage

A transfer bridge to Melange

Fully integrated into:

Fingerlings → Juvenile → Melange production chain.