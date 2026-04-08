# MacShip & Xero Integration Plan - Chem Connect

Hi Jonny,

Here's the detailed flow for the MacShip (shipping) and Xero (accounting) integrations. Please review and confirm before we start building.

---

## PART 1: MacShip Integration (Shipping)

### What Changes for Customers

**Product Pages:**
- Remove "Shipping: $X / Free" display
- Remove "Available in [Region]"
- Keep "Ships from your state" delivery info text

**Cart Page:**
- Instead of showing per-product shipping fees, show: **"Shipping calculated at checkout"**

**Checkout Page:**
- Customer enters delivery address including **postcode**
- Customer selects: **"Forklift available on site"** or **"No forklift on site"** (required dropdown)
- System calls MacShip API to get a live shipping quote
- Shipping cost appears in the order summary
- If postcode is not serviceable, show: **"We can't calculate shipping for your area. Submit a request and we'll get back to you."** with a button that emails admin

### How It Works Behind the Scenes

**Step 1: Customer enters postcode at checkout**

Our system calls MacShip "Get Routes" API:
```
POST https://live.machship.com/apiv2/routes/returnRoutes
```
We send:
- Pickup location (closest warehouse to customer)
- Delivery postcode (customer's address)
- Items: packaging size (20L, 200L, 1000L IBC), weight, dimensions
- DG classification (from product data - DG Class 3, 8, etc. or Non-DG)
- Tailgate required on delivery (YES if customer has no forklift)
- Tailgate required on pickup: always NO (all warehouses have forklifts)

MacShip returns multiple carrier options with prices. We show the price to the customer.

**Step 2: Customer places order (pays via Stripe or PO)**

Our system calls MacShip "Create Consignment" API:
```
POST https://live.machship.com/apiv2/consignments/createConsignment
```
This books the actual shipment with the carrier. We get back:
- MacShip consignment ID (for tracking)
- Carrier consignment ID
- Tracking URL

We store these on the order in our database.

**Step 3: Admin dispatches the order**

When admin marks order as "Processing" or "In Transit", we call MacShip "Manifest" API:
```
POST https://live.machship.com/apiv2/manifests/manifest
```
This tells the carrier to pick up the goods. Labels are auto-generated and can be printed.

**Step 4: Tracking**

We periodically check MacShip for tracking updates:
```
GET https://live.machship.com/apiv2/consignments/getConsignment?id={consignmentId}
```
Tracking status and POD (Proof of Delivery) are synced to our order tracking system.

### Warehouse Selection Logic

You have 5 warehouses. When a customer orders:

1. System checks which warehouses carry that product (based on the product's region setting)
2. From the available warehouses, picks the **closest one to the customer's postcode**
3. Uses that warehouse as the pickup location for the MacShip quote

| Warehouse | Location | State |
|-----------|----------|-------|
| ChemBuild | Dandenong South | VIC |
| Environex | Crestmead | QLD |
| Chemology | Lonsdale | SA |
| Environex | (WA location) | WA |
| Formula Chemicals | West Ryde | NSW |

**Question for you:** Should these warehouse addresses be configurable in the admin dashboard, or are they fixed? I'd recommend making them admin-configurable so you can add/change warehouses without code changes.

### What We Need From You

1. **MacShip API Token** - Create a test-mode user in MacShip and generate a token for us (Settings > Users > Create API User). We need both a test token and a production token.

2. **Item Types** - In MacShip, you have saved item types (like "IBC"). Please confirm the item names/SKUs for:
   - 20L Drum (dimensions: length, width, height, weight)
   - 200L Drum (dimensions)
   - 1000L IBC (dimensions)
   - Or tell us the MachShip item type IDs if you've already set them up

3. **Company ID** - Your MachShip company ID (we can get this from the API once we have the token)

4. **Carrier Preference** - When MacShip returns multiple carrier options, should we:
   - Always pick the cheapest?
   - Always pick a specific carrier?
   - Show the customer options to choose from?

5. **Warehouse Addresses** - Please confirm the full addresses for all 5 warehouses (we have partial from our call, need full street addresses with postcodes)

---

## PART 2: Xero Integration (Accounting)

### A. Automatic Invoicing (for Purchase Order customers)

**Current flow (manual):**
1. Customer pays by Purchase Order on our platform
2. You manually go to Xero, create an invoice, add the PO number, send to customer

**New flow (automatic):**
1. Customer pays by Purchase Order on our platform
2. System automatically:
   - Checks if customer exists as a Xero Contact (by email)
   - If not, creates them as a new Xero Contact
   - Creates an Invoice in Xero with:
     - Customer's PO number
     - All line items (product name, qty, price)
     - Shipping cost
     - GST
     - Due date (your standard payment terms)
   - Invoice status set to AUTHORISED (ready to send)
   - You can review and send from Xero, or we can auto-send

**Question for you:** What are your standard payment terms for PO customers? (e.g., Due in 30 days? 14 days?)

### B. Automatic Purchase Orders (to warehouses)

**Current flow (manual):**
1. Customer places order on our platform
2. You manually go to Xero, create a Purchase Order to the warehouse
3. Send it to the warehouse so they can make/ship the product

**New flow (automatic):**
1. Customer places order on our platform
2. System automatically:
   - Determines which warehouse to order from (based on product region + closest to customer)
   - Creates a Purchase Order in Xero to that warehouse Contact with:
     - Product details (name, qty, packaging size)
     - Warehouse-specific pricing
     - Delivery address (customer's address)
     - Reference to our order number
   - Purchase Order sent to warehouse

**Question for you:** You mentioned each warehouse has different prices for the same product. We need a way to store these. Options:
- **Option A:** We create a "Warehouse Pricing" section in admin where you enter prices per warehouse per product
- **Option B:** We fetch pricing from Xero (if you already have it there)
- Which do you prefer?

### C. Customer Contact Sync

When a new customer signs up on our platform, we create them as a Contact in Xero so invoices can be issued.

**At registration, we'll collect:**
- Company name (already collected)
- Contact name (already collected)
- Email (already collected)
- Phone (already collected)
- ABN (already collected)
- Address (already collected)

This is enough to create a Xero Contact. No changes needed to the signup form.

### What We Need From You

1. **Xero OAuth Credentials** - Go to https://developer.xero.com/app/manage and create a new app:
   - App name: "Chem Connect"
   - Redirect URI: we'll provide this once we set up the auth flow
   - You'll get a Client ID and Client Secret

2. **Xero Tenant ID** - We need this to make API calls (we can get it after OAuth)

3. **Payment Terms** - Default due days for PO invoices (14, 30, etc.)

4. **Warehouse Contacts** - Confirm the Xero Contact IDs for each warehouse (or their names so we can look them up)

5. **Revenue Account Code** - Which Xero account code should sales revenue go to? (e.g., "200 - Sales")

6. **Warehouse Pricing** - A table of product prices per warehouse (or tell us if you want to manage this in admin)

---

## PART 3: Admin Dashboard Changes

### New Admin Page: "Shipping & Warehouses"

- **Warehouses**: Add/edit warehouse addresses (name, full address, state, contact)
- **Warehouse-Product mapping**: Which products ship from which warehouses
- **MacShip settings**: API token, default carrier preferences

### New Admin Page: "Xero Integration"

- **Connect to Xero**: OAuth button to authorize
- **Sync status**: Show if Xero is connected
- **Invoice settings**: Payment terms, revenue account
- **Contact sync**: View synced contacts

### Existing Order Page Updates

- Show MacShip tracking info (consignment ID, tracking URL, carrier name)
- Button to view shipment in MacShip
- Show if Xero invoice was created (with link to Xero)
- Show if Xero PO was created to warehouse

---

## PART 4: Timeline & Priority

I'd recommend building this in order:

**Phase 1 (Priority): MacShip Shipping**
- Remove old per-product shipping from UI
- Build checkout postcode + forklift flow
- Integrate MacShip quote API
- Integrate MacShip consignment creation
- Build warehouse selection logic
- Add tracking sync

**Phase 2: Xero Invoicing**
- Set up OAuth flow
- Auto-create contacts on signup
- Auto-create invoices for PO orders

**Phase 3: Xero Purchase Orders**
- Build warehouse pricing management
- Auto-create POs to warehouses when orders come in

---

## Summary of What We Need

| Item | From You | Priority |
|------|----------|----------|
| MacShip API token (test + production) | ASAP | High |
| Item dimensions (20L, 200L, IBC) | ASAP | High |
| Full warehouse addresses (all 5) | ASAP | High |
| Carrier preference (cheapest/specific/choice) | Before Phase 1 | High |
| Xero Client ID + Secret | Before Phase 2 | Medium |
| Payment terms for PO invoices | Before Phase 2 | Medium |
| Warehouse Xero Contact IDs | Before Phase 3 | Medium |
| Warehouse-specific product pricing | Before Phase 3 | Medium |

Please review this and let me know if anything looks off or if you have questions. Once I have the MacShip API token and item dimensions, I can start building Phase 1.

Thanks,
Sohaib
