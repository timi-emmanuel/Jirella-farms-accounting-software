This document explains how Inventory, Recipes, and Production are connected in the Feed Mill system, including the formulas, validation rules, and production flow.

This system is designed to replicate and improve the existing Excel workflow while remaining scalable and auditable.

1. Core Design Philosophy

UI calculations are feedback only

Backend calculations are the source of truth

Always validate against existing Excel logic

Store raw inputs only (percentages, quantities, prices)

Never store derived totals unless required for auditing

Inventory deductions must be transactional

2. Core Modules & Responsibilities
2.1 Inventory (Raw Materials)

Represents what is currently in stock.

Responsibilities:

Store available quantity per ingredient (kg)

Store unit cost per kg

Serve as the source for production validation

2.2 Recipe Master

Defines feed formulas.

Responsibilities:

Define inclusion percentage per ingredient

Define target batch size (e.g. 1000kg)

Provide ingredient requirements for production

Recipes do not care about inventory availability.

2.3 Production

Bridges Recipe and Inventory.

Responsibilities:

Accept production requests

Validate ingredient availability

Deduct raw materials

Record production history and costs

3. Production Flow (Step-by-Step)
Step 1: User selects production inputs

Recipe (feed type)

Quantity to produce (kg)

Example:

Recipe: Broiler Grower
Quantity to produce: 1000 kg

Step 2: Calculate required ingredients (UI + Backend)

For each ingredient in the recipe:

required_kg = (inclusion_percentage / 100) × production_quantity


Example:

Maize (50%) → 500 kg

Soybean Meal (20%) → 200 kg

This calculation already exists in the Recipe Master UI and must be duplicated on the backend for validation.

Step 3: Inventory availability validation

For each ingredient:

if inventory.available_kg < required_kg
  → block production


Example error:

Cannot produce:
Soybean Meal short by 35kg


⚠️ No inventory is deducted at this stage.

Step 4: User clicks “Produce”

When production is confirmed:

Re-validate inventory

Deduct required quantities

Save production record

Save ingredient consumption snapshot

All steps must happen inside a database transaction.

4. Production Cost Calculations
4.1 Cost per kg (does NOT change with quantity)
cost_per_kg =
  Σ (ingredient_required_kg × ingredient_unit_cost)
  ÷ total_production_kg


Cost per kg is constant, regardless of production size, assuming ingredient prices don’t change.

This is normal and correct.

4.2 Cost per bag

Assuming standard bag sizes:

cost_per_15kg_bag = cost_per_kg × 15
cost_per_25kg_bag = cost_per_kg × 25


Interpretation:

Cost per 15kg / 25kg represents the cost of producing ONE bag of that size.

5. Data Model (Suggested)
Inventory
RawMaterial
- id
- name
- quantity_kg
- unit_cost

Recipes
Recipe
- id
- name
- target_batch_size

RecipeIngredient
- recipe_id
- raw_material_id
- inclusion_percentage

Production
ProductionBatch
- id
- recipe_id
- quantity_produced_kg
- cost_per_kg
- produced_by
- created_at

ProductionConsumption
- production_id
- raw_material_id
- quantity_used_kg
- unit_cost_at_time


Storing unit_cost_at_time ensures historical accuracy even if prices change later.

6. Critical Backend Rules (DO NOT BREAK)

Inventory deduction must happen only on the backend

Use database transactions

Never partially deduct inventory

Never trust UI-only calculations

Always re-calculate and re-validate on the server

7. Why This Design Is Correct

This architecture enables:

Accurate stock tracking

Production blocking when materials are insufficient

Correct cost accounting

Auditability (who produced what, when, and at what cost)

Smooth migration away from Excel

This is how real ERP / feed-mill systems are built.

8. Implementation Phases (Recommended)
Phase 1 – MVP

Calculate ingredient requirements

Validate inventory availability

Block production if insufficient

Phase 2

Deduct inventory on production

Store production records

Phase 3

Production history

Cost & profit reports

Role-based production permissions

9. Final Notes

Production is the only place where inventory changes

Recipes are static definitions

Inventory is the single source of stock truth

Backend logic always wins over UI

✅ This README reflects both the Excel logic and a scalable software design.
You are building this the right way.