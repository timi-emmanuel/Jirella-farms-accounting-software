CALCULATIONS & BUSINESS LOGIC GUIDE

(Derived from Excel Feedmill Accounting System)

This document defines all business calculations used in the system.
It replaces Excel formulas with explicit, auditable logic.

Rule: Excel is the reference.
The backend is the source of truth.

GENERAL PRINCIPLES

Store raw inputs only (quantities, prices, percentages)

Never trust frontend totals

Backend recalculates everything on save

Derived values are recomputed, not manually edited

Dashboard values are never stored

FILE ORGANIZATION

All calculation logic lives in:

src/lib/calculations/
├── recipe.ts
├── inventory.ts
├── production.ts
├── sales.ts


Each file corresponds to one Excel domain.

1️⃣ RECIPE MASTER CALCULATIONS
Purpose

Define feed composition and calculate feed cost.

A. Percentage Validation

Excel concept:
Total ingredient percentages must equal 100%.

Logic:

Sum all ingredient percentages

Recipe is valid only if total = 100

Used for:

Save validation

Error feedback in UI

B. Ingredient Quantity Calculation

Excel formula concept:

ingredient_quantity = (ingredient_percentage / 100) × batch_size


Used for:

Production planning

Cost calculation

C. Ingredient Cost Contribution

Excel formula concept:

ingredient_cost = ingredient_quantity × ingredient_unit_price


Each ingredient contributes independently to total cost.

D. Total Recipe Cost

Excel formula concept:

total_recipe_cost = SUM(all ingredient_costs)

E. Cost Per Unit (kg / ton)

Excel formula concept:

cost_per_unit = total_recipe_cost / total_batch_weight

Storage Rules

Store: percentages, batch size

Do NOT store: total cost, cost per unit

2️⃣ RAW MATERIAL INVENTORY (RM INVENTORY)
Purpose

Track raw material movement, balance, and valuation.

A. Closing Balance

Excel formula concept:

closing_balance = opening_balance + total_in - total_out


Used for stock tracking.

B. Weighted Average Unit Price

Excel formula concept:

average_price = total_value / total_quantity


Used when materials are purchased at different prices.

C. Inventory Valuation

Excel formula concept:

inventory_value = closing_balance × average_price

Storage Rules

Store: movements (IN / OUT), prices

Do NOT store: balances (derive them)

3️⃣ PRODUCTION (FEED MILL)
Purpose

Convert raw materials into finished feed batches.

A. Raw Material Consumption

Excel formula concept:

rm_used = batch_quantity × ingredient_percentage


Pulled directly from Recipe Master.

B. Batch Cost

Excel formula concept:

batch_cost = SUM(raw_material_costs) + overhead_costs

C. Cost Per Unit Output

Excel formula concept:

cost_per_unit = batch_cost / output_quantity

Storage Rules

Store: batch inputs, overheads

Do NOT store: calculated costs

4️⃣ SALES CALCULATIONS
Purpose

Track revenue and profit.

A. Line Total

Excel formula concept:

line_total = quantity × unit_price

B. Total Sales

Excel formula concept:

total_sales = SUM(all line_totals)

C. Profit

Excel formula concept:

profit = total_sales - cost_of_goods_sold


COGS comes from Production & Inventory.

Storage Rules

Store: quantities, prices

Do NOT store: profit

5️⃣ DASHBOARD CALCULATIONS (DERIVED ONLY)
Purpose

Provide summaries and insights.

A. Period Totals

Excel concept:

daily / weekly / monthly totals = SUM(values in period)

B. Profit Summary

Excel concept:

total_profit = total_sales - total_expenses

🚨 IMPORTANT RULE

Dashboard values:

Are computed via queries

Are never stored

Always reflect live data

6️⃣ FRONTEND VS BACKEND RESPONSIBILITY
Frontend (AG Grid)

Preview calculations

Immediate user feedback

Editable input cells only

Backend (Authoritative)

Recalculate everything

Validate inputs

Persist only raw data

7️⃣ VALIDATION RULES

Percentages must sum to 100

Quantities must be ≥ 0

Prices must be ≥ 0

Production cannot exceed inventory

Staff roles cannot edit calculated fields

FINAL NOTE

This system replaces implicit Excel logic with explicit software logic.

If a number cannot be explained:

It is a bug