🐟 Catfish Pricing & Size Classification Settings

Admin Configuration Panel
Built with: Next.js + Supabase (Self-hosted) + RLS

🎯 Objective

Implement a Catfish Price Settings page that:

Defines seed price per size range (cm)

Automatically assigns batch classification name based on cm range

Restricts access to Admin users only

Allows updating pricing without affecting historical records

This setting applies to:

Fingerlings

Juvenile

Future catfish stages

📂 Routing Structure

Under Catfish module:

/catfish/settings/pricing

Only visible to:

role = "admin"

Not visible to normal users.

🗄 Database Schema
1️⃣ catfish_size_pricing
CREATE TABLE catfish_size_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    min_cm NUMERIC NOT NULL,
    max_cm NUMERIC NOT NULL,
    price_per_piece NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
📊 Initial Seed Data

Based on boss instruction:

Name	Min CM	Max CM	Price
Small / Ijebu Fingerlings	2	3	25
Standard Fingerlings	3	4	50
Post-Fingerlings	5	6	80
Juveniles	6	8	100
Jumbo / Post-Juveniles	10	12	120
🧠 Business Logic
1️⃣ Batch Size Classification

When creating or updating a batch:

User enters:

average_length_cm

System should:

Query catfish_size_pricing

Find where:

average_length_cm >= min_cm
AND
average_length_cm <= max_cm
AND is_active = true

Assign:

batch.size_category_name = pricing.name
batch.seed_price_per_piece = pricing.price_per_piece

This must be automatic.

2️⃣ Important Rule

Classification must be:

Dynamic at creation

Stored permanently on batch

Not affected by future price changes

Meaning:

If admin changes Juvenile price from ₦100 → ₦110

Old batches keep ₦100.

🗄 Batch Table Updates

Add fields to batches:

ALTER TABLE batches
ADD COLUMN size_category_name TEXT,
ADD COLUMN initial_size_cm NUMERIC,
ADD COLUMN seed_price_per_piece NUMERIC;
🔐 RLS Requirements

Only admin can:

Insert pricing ranges

Update pricing

Deactivate pricing ranges

Regular users:

Can read active pricing

Cannot modify

🖥 UI Requirements
Page: /catfish/settings/pricing
Table View

Columns:

Category Name

CM Range

Price Per Piece

Status (Active / Inactive)

Actions (Edit / Deactivate)

Add / Edit Modal

Fields:

Name

Min CM

Max CM

Price per piece

Validation:

min_cm < max_cm

No overlapping active ranges

Price must be > 0

🚨 Overlapping Protection

Before inserting:

Ensure:

(new_min <= existing_max)
AND
(new_max >= existing_min)
AND is_active = true

If overlap → reject.

🔁 Batch Creation Flow Update

When creating Fingerlings or Juvenile batch:

User inputs:

Initial size (cm)

Quantity

System auto-fills:

Category Name

Seed price per piece

Initial seed cost = quantity × seed_price_per_piece

Make category read-only on frontend.

📊 Financial Integration

Seed cost should flow into:

production_expenses
category = 'seed'

Or be stored directly in batch financial snapshot.

🎨 Sidebar Update

Under Catfish:

Catfish
   Dashboard
   Fingerlings
   Juvenile
   Melange
   Settings
       Pricing

Settings visible only to Admin.

⚠️ Business Rules

Cannot delete pricing used by existing batch.

Deactivation allowed.

Historical batches must preserve original price.

Only one active pricing range per CM interval.

🧠 Engineering Principles

Pricing ranges are configuration, not transactional data.

Batch stores snapshot of price at time of creation.

No recalculation of historical seed cost.

All classification logic should run server-side (not frontend only).

🚀 Final Outcome

When user enters:

6 cm

System auto-assigns:

Juveniles
₦100 per piece

No manual classification needed.

Admin controls pricing centrally.

Historical integrity preserved.