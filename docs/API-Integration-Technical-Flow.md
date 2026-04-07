# API Integration Technical Flow Document
# MachShip Shipping + Xero Accounting
# ChemMarket Elora - Integration Reference

---

## TABLE OF CONTENTS

1. [MachShip API](#1-machship-api)
   - Authentication
   - Get Shipping Quotes (Routes/Pricing)
   - Create Pending Consignment
   - Create Consignment
   - Track Shipments / PODs
   - Manifest / Dispatch
   - Labels
2. [Xero Accounting API](#2-xero-accounting-api)
   - Authentication (OAuth2)
   - Contacts
   - Invoices
   - Purchase Orders
3. [Integration Flow Summary](#3-integration-flow-summary)

---

## 1. MACHSHIP API

### 1.1 Authentication

- **Method:** Token-based header authentication
- **Header:** `token: <api_token>`
- **Base URL:** `https://live.machship.com`
- **API Path Prefix:** `/apiv2/`
- **Swagger Docs:** `https://live.machship.com/swagger/index.html`
- **Swagger JSON:** `https://live.machship.com/swagger/v2/swagger.json`

**Validate Token:**
```
POST https://live.machship.com/apiv2/authenticate/ping
Headers: { token: "YOUR_API_TOKEN" }

Response (200 OK):
{ "object": true, "errors": null }
```

**Token Notes:**
- Tokens are created on user accounts within MachShip
- Tokens inherit the permissions of the parent user
- Token is passed as a custom `token` header (NOT Authorization/Bearer)

### 1.2 Sandbox / Testing

- **No separate sandbox environment** - MachShip uses an integrated test mode
- Test mode is assigned at the user/token level
- Tokens created on test-mode users generate test consignments
- Test consignments do NOT trigger actual carrier API calls
- Test consignments show an exclamation icon in the MachShip UI

### 1.3 Rate Limits

- No documented rate limits
- Bulk tracking endpoints recommend max 10 consignments per request
- Recently updated consignments endpoint: retrieveSize 40-200 (default 40)

---

### 1.4 Get Shipping Quotes (Routes & Pricing)

**Purpose:** Get available carrier options with prices for a shipment before creating it.

#### Endpoint: Return Routes

```
POST https://live.machship.com/apiv2/routes/returnRoutes
Header: token: <api_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "companyId": 12345,
  "fromLocation": {
    "suburb": "SYDNEY",
    "postcode": "2000"
  },
  "fromAddressLine1": "123 George St",
  "toLocation": {
    "suburb": "MELBOURNE",
    "postcode": "3000"
  },
  "toAddressLine1": "456 Collins St",
  "items": [
    {
      "itemType": "Carton",
      "name": "Chemical Product A",
      "sku": "CHEM-001",
      "quantity": 2,
      "weight": 10.5,
      "length": 40,
      "width": 30,
      "height": 20
    }
  ],
  "dispatchDateTimeLocal": "2026-04-05T09:00:00.000Z",
  "carrierIds": [1, 2, 3],
  "questionIds": [13]
}
```

**Key Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| fromLocation | object | Yes (or fromCompanyLocationId) | `{suburb, postcode}` |
| toLocation | object | Yes (or toCompanyLocationId) | `{suburb, postcode}` |
| items | array | Yes | At least one item |
| items[].itemType | string | Yes | Carton, Skid, Pallet, Crate, Satchel, Roll, Panel, Bag, Tube, Stillage, Envelope, Pack, Rails, TimberPack, Pipe, BDouble, Semi, TwentyFootContainer, FortyFootContainer, Bundle, Case |
| items[].quantity | int | Yes | |
| items[].weight | number | Yes | In KG |
| items[].length | number | Yes | In CM |
| items[].width | number | Yes | In CM |
| items[].height | number | Yes | In CM |
| companyId | int | No | Defaults to requester's company |
| dispatchDateTimeLocal | string | No | ISO 8601 format |
| carrierIds | int[] | No | Filter to specific carriers |
| questionIds | int[] | No | 7=Tailgate, 8=Crane, 13=Residential, 14=Auth to leave, 36=Hand unload |

**Alternative item referencing (saved items):**
```json
{ "items": [{ "companyItemId": 999 }] }
// OR
{ "items": [{ "sku": "CHEM-001" }] }
```

#### Response Body

```json
{
  "object": {
    "id": "UUID",
    "routes": [
      {
        "carrier": {
          "id": 1,
          "name": "TNT",
          "abbreviation": "TNT",
          "displayName": "TNT"
        },
        "carrierService": {
          "id": 10,
          "name": "Road Express",
          "abbreviation": "RE",
          "displayName": "Road Express"
        },
        "carrierAccount": {
          "id": 100,
          "name": "Main Account",
          "accountCode": "ACC001",
          "carrierId": 1,
          "displayName": "Main Account"
        },
        "companyCarrierAccountId": 50,
        "companyId": 12345,
        "consignmentTotal": {
          "totalSellPrice": 45.50,
          "totalCostPrice": 38.00,
          "totalBaseSellPrice": 35.00,
          "totalBaseCostPrice": 30.00,
          "totalTaxSellPrice": 4.14,
          "totalTaxCostPrice": 3.45,
          "sellFuelLevyPrice": 5.25,
          "costFuelLevyPrice": 4.20,
          "consignmentRouteSellPrice": 35.00,
          "consignmentRouteCostPrice": 30.00,
          "totalSellBeforeTax": 41.36,
          "totalCostBeforeTax": 34.55,
          "sellPricesCleared": false,
          "consignmentCarrierSurchargesCostPrice": 0,
          "consignmentCarrierSurchargesSellPrice": 0
        },
        "despatchOptions": [
          {
            "despatchDateLocal": "2026-04-05T09:00:00",
            "despatchDateUtc": "2026-04-04T23:00:00Z",
            "etaLocal": "2026-04-07T17:00:00",
            "etaUtc": "2026-04-07T07:00:00Z",
            "totalBusinessDays": 2,
            "isTimeWindow": false
          }
        ],
        "fuelLevyPercentage": 15.0,
        "taxPercentage": 10.0,
        "electiveSurcharges": [],
        "automaticSurcharges": [],
        "totalWeight": 21.0,
        "totalCubic": 0.048,
        "totalVolume": 48000
      }
    ]
  },
  "errors": null
}
```

**Key response values for integration:**
- `routes[].carrier.id` - needed for consignment creation
- `routes[].carrierService.id` - needed for consignment creation
- `routes[].companyCarrierAccountId` - needed for consignment creation
- `routes[].consignmentTotal.totalSellPrice` - the price to display to customer
- `routes[].despatchOptions[].etaLocal` - estimated delivery date

#### For Complex Items (DG/Hazmat)

```
POST https://live.machship.com/apiv2/routes/returnRoutesWithComplexItems
```
Same structure but supports dangerous goods fields in items.

---

### 1.5 Create Pending Consignment (Draft)

**Purpose:** Create a draft shipping job that warehouse staff complete later. Use when order is placed but not yet ready to ship.

```
POST https://live.machship.com/apiv2/pendingConsignments/createPendingConsignment
Header: token: <api_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "companyId": 12345,
  "fromCompanyLocationId": 100,
  "toName": "Customer Pty Ltd",
  "toContact": "John Smith",
  "toPhone": "0412345678",
  "toEmail": "john@customer.com",
  "toAddressLine1": "456 Collins St",
  "toLocation": {
    "suburb": "MELBOURNE",
    "postcode": "3000"
  },
  "customerReference": "ORD-2026-0001",
  "customerReference2": "PO-5678",
  "specialInstructions": "Call before delivery",
  "carrierId": 1,
  "carrierServiceId": 10,
  "items": [
    {
      "itemType": "Carton",
      "name": "Chemical Product A",
      "quantity": 2,
      "height": 20,
      "weight": 10.5,
      "length": 40,
      "width": 30
    }
  ],
  "questionIds": ["13"],
  "sendTrackingEmail": true,
  "staffMemberName": "System API"
}
```

**Additional fields for international:**
```json
{
  "isInternational": true,
  "internationalToCity": "Auckland",
  "internationalToPostcode": "1010",
  "internationalToProvince": "Auckland",
  "toCountryCode": "NZ"
}
```

**DG items in pending consignment:**
```json
{
  "items": [{
    "itemType": "Carton",
    "name": "Hazardous Chemical",
    "quantity": 1,
    "height": 30, "weight": 15, "length": 40, "width": 30,
    "pendingConsignmentItemDgItems": [{
      "unNumber": 1234,
      "packingGroup": 2,
      "containerType": 1,
      "aggregateQuantity": 15.0,
      "isAggregateQuantityWeight": true,
      "numberOfContainers": 1,
      "dgClassType": 3,
      "properShippingName": "Flammable Liquid"
    }]
  }]
}
```

#### Response Body

```json
{
  "object": {
    "id": 987654,
    "consignmentNumber": "PC987654"
  },
  "errors": []
}
```

**Note:** Pending consignments must be converted to full consignments before manifesting.

---

### 1.6 Create Consignment (Full)

**Purpose:** Create a ready-to-ship consignment with carrier assigned.

#### Standard Creation

```
POST https://live.machship.com/apiv2/consignments/createConsignment
Header: token: <api_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "companyId": 12345,
  "carrierId": 1,
  "carrierServiceId": 10,
  "companyCarrierAccountId": 50,
  "fromCompanyLocationId": 100,
  "toName": "Customer Pty Ltd",
  "toContact": "John Smith",
  "toPhone": "0412345678",
  "toEmail": "john@customer.com",
  "toAddressLine1": "456 Collins St",
  "toAddressLine2": "",
  "toLocation": {
    "suburb": "MELBOURNE",
    "postcode": "3000"
  },
  "customerReference": "ORD-2026-0001",
  "customerReference2": "PO-5678",
  "specialInstructions": "Call before delivery",
  "dispatchDateTimeLocal": "2026-04-05T09:00:00.000Z",
  "items": [
    {
      "itemType": "Carton",
      "name": "Chemical Product A",
      "sku": "CHEM-001",
      "quantity": 2,
      "height": 20,
      "weight": 10.5,
      "length": 40,
      "width": 30
    }
  ],
  "questionIds": ["13"],
  "sendingTrackingEmail": true,
  "dgsDeclaration": false,
  "staffMemberName": "System API"
}
```

**Route selection options (pick one):**
- Specify `carrierId` + optional `carrierServiceId` (from returnRoutes response)
- Use `"defaultRouteSelection": "cheapest"` or `"fastest"` for auto-selection

#### Complex Items (DG)

```
POST https://live.machship.com/apiv2/consignments/createConsignmentWithComplexItems
```

#### Response Body

```json
{
  "object": {
    "id": 123456,
    "consignmentNumber": "MS123456",
    "carrierConsignmentId": "TNT-CON-789",
    "status": {
      "id": 1,
      "name": "Unmanifested",
      "description": "Consignment created, not yet dispatched"
    },
    "trackingPageAccessToken": "abc123def456",
    "consignmentTotal": {
      "totalSellPrice": 45.50,
      "totalCostPrice": 38.00,
      "totalBaseSellPrice": 35.00,
      "totalTaxSellPrice": 4.14,
      "sellFuelLevyPrice": 5.25,
      "consignmentRouteSellPrice": 35.00,
      "totalSellBeforeTax": 41.36
    },
    "items": [
      {
        "itemType": "Carton",
        "name": "Chemical Product A",
        "quantity": 2,
        "height": 20,
        "weight": 10.5,
        "length": 40,
        "width": 30,
        "references": ["REF001"]
      }
    ],
    "despatchDateLocal": "2026-04-05T09:00:00",
    "despatchDateUtc": "2026-04-04T23:00:00Z",
    "etaLocal": "2026-04-07T17:00:00",
    "etaUtc": "2026-04-07T07:00:00Z",
    "carrier": { "id": 1, "name": "TNT", "displayName": "TNT" },
    "carrierService": { "id": 10, "name": "Road Express", "displayName": "Road Express" },
    "isTest": false
  },
  "errors": []
}
```

**Key response values to store:**
- `object.id` - MachShip consignment ID (for tracking, manifesting)
- `object.consignmentNumber` - Display number (MS prefix)
- `object.carrierConsignmentId` - Carrier's tracking number
- `object.trackingPageAccessToken` - For tracking page URL
- `object.consignmentTotal.totalSellPrice` - Final shipping cost

---

### 1.7 Track Shipments & Proof of Delivery

#### Get Single Consignment

```
GET https://live.machship.com/apiv2/consignments/getConsignment?id={machship_id}
Header: token: <api_token>
```

#### Get by Pending Consignment ID

```
GET https://live.machship.com/apiv2/consignments/getConsignmentByPendingConsignmentId?id={pending_id}
Header: token: <api_token>
```

#### Bulk Lookup (max 10 per request)

```
POST https://live.machship.com/apiv2/consignments/returnConsignments
Body: [123456, 123457, 123458]

POST https://live.machship.com/apiv2/consignments/returnConsignmentsByCarrierConsignmentId
Body: ["TNT-CON-789", "TNT-CON-790"]

POST https://live.machship.com/apiv2/consignments/returnConsignmentsByReference1
Body: ["ORD-2026-0001", "ORD-2026-0002"]

POST https://live.machship.com/apiv2/consignments/returnConsignmentsByReference2
Body: ["PO-5678", "PO-5679"]

POST https://live.machship.com/apiv2/consignments/returnConsignmentsByPendingConsignmentIds
Body: [987654, 987655]
```

#### Poll for Recent Updates

```
GET https://live.machship.com/apiv2/consignments/getRecentlyCreatedOrUpdatedConsignments
    ?fromDateUtc=2026-04-01T00:00:00Z
    &toDateUtc=2026-04-04T23:59:59Z
    &companyId=12345
    &startIndex=0
    &retrieveSize=100
    &carrierId=1
    &includeChildCompanies=false
Header: token: <api_token>
```

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| fromDateUtc | string | Yes | ISO 8601 |
| toDateUtc | string | No | ISO 8601 |
| companyId | int | No | Filter by company |
| startIndex | int | No | Pagination offset |
| retrieveSize | int | No | 40-200, default 40 |
| carrierId | int | No | Filter by carrier |

#### Tracking Response includes

```json
{
  "carrierConsignmentId": "TNT-CON-789",
  "status": {
    "id": 5,
    "name": "COMPLETE",
    "description": "Delivered"
  },
  "manifestId": 111222,
  "bookedDate": "2026-04-05T09:00:00",
  "completedDate": "2026-04-07T14:30:00",
  "completedDateUtc": "2026-04-07T04:30:00Z",
  "attachmentCount": 1,
  "totalWeight": 21.0,
  "totalCubic": 0.048,
  "consignmentTotal": {
    "totalSellPrice": 45.50,
    "totalBaseSellPrice": 35.00,
    "totalTaxSellPrice": 4.14,
    "sellFuelLevyPrice": 5.25
  }
}
```

**Status history** is included as an array with each status change timestamped.

#### Get Proof of Delivery

**Step 1: Check status = "COMPLETE" and attachmentCount > 0**

**Step 2: List attachments**
```
POST https://live.machship.com/apiv2/consignments/getAttachments
Body: { "consignmentId": 123456 }

Response:
{
  "object": [
    {
      "id": 555,
      "fileName": "POD_TNT789.jpg",
      "dateAdded": "2026-04-07T14:30:00"
    }
  ]
}
```

**Step 3: Download attachment**
```
GET https://live.machship.com/apiv2/attachments/getAttachment?id=555
(Returns raw file - JPEG, PDF, TIFF, etc.)

GET https://live.machship.com/apiv2/attachments/getAttachmentPodReport?id=555
(Returns formatted PDF with consignment details)
```

**Bulk POD download:**
```
GET https://live.machship.com/apiv2/attachments/getAttachmentsByConsignmentIds?ids=123456&ids=123457
(Returns ZIP archive if multiple - recommend max 10 per request)
```

---

### 1.8 Manifesting / Dispatching

**Purpose:** Group unmanifested consignments and book carrier pickup.

#### Step 1: Group Consignments

**Option A - Specific consignments:**
```
POST https://live.machship.com/apiv2/manifests/groupConsignmentsForManifest
Body: [123456, 123457]
```

**Option B - All unmanifested:**
```
POST https://live.machship.com/apiv2/manifests/groupAllUnmanifestedConsignmentsForManifest
Body: "12345"   // companyId as string
```

#### Grouping Response

```json
{
  "object": [
    {
      "consignmentIds": [123456, 123457],
      "companyId": 12345,
      "pickupDateTime": "2026-04-05T09:00:00",
      "palletSpaces": 0,
      "pickupClosingTime": "2026-04-05T17:00:00",
      "pickupSpecialInstructions": "",
      "pickupAlreadyBooked": false,
      "carrierName": "TNT"
    }
  ],
  "errors": null
}
```

Consignments are auto-grouped by carrier, location, and despatch date.

#### Step 2: Create Manifest

```
POST https://live.machship.com/apiv2/manifests/manifest
Body:
[
  {
    "consignmentIds": [123456, 123457],
    "companyId": 12345,
    "pickupDateTime": "2026-04-05T09:00:00.000Z",
    "palletSpaces": 3,
    "pickupClosingTime": "2026-04-05T17:00:00.000Z",
    "pickupSpecialInstructions": "Driver must be inducted",
    "pickupAlreadyBooked": false,
    "carrierName": "TNT"
  }
]
```

#### Manifest Response

```json
{
  "object": [
    {
      "id": 111222,
      "consignmentIds": [123456, 123457],
      "companyId": 12345,
      "carrierReference": null,
      "bookingSuccessful": true,
      "errorMessage": null
    }
  ],
  "errors": null
}
```

Check `bookingSuccessful` to confirm pickup was booked with carrier.

---

### 1.9 Labels

```
GET https://live.machship.com/apiv2/labels/getLabelsPdf?consignmentId={id}
GET https://live.machship.com/apiv2/labels/getLabels?consignmentId={id}
Header: token: <api_token>
```

---

### 1.10 Supporting Endpoints

```
GET  /apiv2/companies/getAll                                    - List companies/business units
GET  /apiv2/companies/getAvailableCarriersAccountsAndServices   - List carriers
GET  /apiv2/companyLocations                                    - List saved locations
GET  /apiv2/companyItems                                        - List saved items
GET  /apiv2/locations?suburb=SYD&postcode=2000                  - Search MachShip locations
POST /apiv2/consignments/editUnmanifestedConsignment            - Edit before manifesting
POST /apiv2/consignments/deleteUnmanifestedConsignments         - Delete unmanifested
```

---

## 2. XERO ACCOUNTING API

### 2.1 Authentication (OAuth 2.0)

- **Type:** OAuth 2.0 Authorization Code Flow
- **Authorization URL:** `https://login.xero.com/identity/connect/authorize`
- **Token URL:** `https://identity.xero.com/connect/token`
- **Base API URL:** `https://api.xero.com/api.xro/2.0`

#### Required Scopes

| Scope | Purpose |
|-------|---------|
| `openid` | Required for all flows |
| `profile` | User profile info |
| `email` | User email |
| `accounting.transactions` | Read/write invoices, purchase orders, credit notes |
| `accounting.transactions.read` | Read-only invoices |
| `accounting.contacts` | Read/write contacts |
| `accounting.contacts.read` | Read-only contacts |
| `accounting.settings.read` | Read org settings (tax rates, accounts) |
| `accounting.attachments` | Read/write attachments |

#### Auth Flow

**Step 1: Redirect user to authorize**
```
GET https://login.xero.com/identity/connect/authorize
    ?response_type=code
    &client_id={CLIENT_ID}
    &redirect_uri={REDIRECT_URI}
    &scope=openid profile email accounting.transactions accounting.contacts accounting.settings.read
    &state={RANDOM_STATE}
```

**Step 2: Exchange code for tokens**
```
POST https://identity.xero.com/connect/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)

grant_type=authorization_code
&code={AUTH_CODE}
&redirect_uri={REDIRECT_URI}
```

**Step 3: Refresh tokens (tokens expire in 30 minutes)**
```
POST https://identity.xero.com/connect/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)

grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
```

#### Required Headers for All API Calls

```
Authorization: Bearer {ACCESS_TOKEN}
Xero-tenant-id: {TENANT_ID}
Content-Type: application/json
Accept: application/json
```

**Get tenant ID:**
```
GET https://api.xero.com/connections
Authorization: Bearer {ACCESS_TOKEN}

Response: [{ "tenantId": "xxx-xxx-xxx", "tenantType": "ORGANISATION", ... }]
```

### 2.2 Rate Limits

- **Minute limit:** 60 calls per minute per tenant
- **Daily limit:** 5000 calls per day per tenant
- **App limit:** 10,000 calls per day across all tenants
- Rate limit headers returned: `X-Rate-Limit-Problem`, `Retry-After`
- When exceeded: HTTP 429 Too Many Requests

### 2.3 Sandbox / Testing

- **Demo Company:** Every Xero developer account gets a demo company
- Register app at `https://developer.xero.com/app/manage`
- Use demo company tenant ID for testing
- Demo data resets periodically

### 2.4 Pagination

- Default page size: 100 records
- Use `?page=1`, `?page=2`, etc.
- Response includes pagination object:
```json
{
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "pageCount": 3,
    "itemCount": 250
  }
}
```

---

### 2.5 Contacts API

**Purpose:** Manage customers and suppliers in Xero.

#### Get Contacts

```
GET https://api.xero.com/api.xro/2.0/Contacts
    ?where=ContactStatus=="ACTIVE"
    &order=Name ASC
    &page=1
    &includeArchived=false
    &searchTerm=Customer Name
    &summaryOnly=true
```

| Parameter | Type | Notes |
|-----------|------|-------|
| where | string | Filter expression, e.g. `ContactStatus=="ACTIVE"` |
| order | string | Sort field + direction |
| IDs | UUID[] | Comma-separated ContactIDs |
| page | int | Pagination (100 per page) |
| includeArchived | bool | Include archived contacts |
| searchTerm | string | Searches Name, FirstName, LastName, ContactNumber, EmailAddress |
| summaryOnly | bool | Lightweight response |
| If-Modified-Since | header | Only return contacts modified after date |

**Scopes required:** `accounting.contacts` or `accounting.contacts.read`

#### Get Single Contact

```
GET https://api.xero.com/api.xro/2.0/Contacts/{ContactID}
```

#### Create/Update Contacts

```
PUT https://api.xero.com/api.xro/2.0/Contacts
POST https://api.xero.com/api.xro/2.0/Contacts
```

PUT = create new (bulk), POST = create or update.

#### Contact JSON Structure

```json
{
  "Contacts": [
    {
      "ContactID": "uuid (read-only on create)",
      "ContactNumber": "EXT-CUST-001 (max 50 chars, API-writable only)",
      "AccountNumber": "ACC-001 (max 50 chars)",
      "ContactStatus": "ACTIVE | ARCHIVED | GDPRREQUEST",
      "Name": "Customer Pty Ltd (max 255, required)",
      "FirstName": "John (max 255)",
      "LastName": "Smith (max 255)",
      "CompanyNumber": "ABN123 (max 50)",
      "EmailAddress": "john@customer.com (max 255)",
      "TaxNumber": "12345678901 (ABN/GST/VAT, max 50)",
      "AccountsReceivableTaxType": "OUTPUT",
      "AccountsPayableTaxType": "INPUT",
      "IsCustomer": true,
      "IsSupplier": false,
      "Addresses": [
        {
          "AddressType": "STREET | POBOX",
          "AddressLine1": "456 Collins St",
          "AddressLine2": "",
          "AddressLine3": "",
          "AddressLine4": "",
          "City": "Melbourne",
          "Region": "VIC",
          "PostalCode": "3000",
          "Country": "Australia"
        }
      ],
      "Phones": [
        {
          "PhoneType": "DEFAULT | DDI | MOBILE | FAX",
          "PhoneNumber": "1234567",
          "PhoneAreaCode": "03",
          "PhoneCountryCode": "61"
        }
      ],
      "ContactPersons": [
        {
          "FirstName": "Jane",
          "LastName": "Doe",
          "EmailAddress": "jane@customer.com",
          "IncludeInEmails": true
        }
      ],
      "Balances": {
        "AccountsReceivable": {
          "Outstanding": 760.00,
          "Overdue": 920.00
        },
        "AccountsPayable": {
          "Outstanding": 231.60,
          "Overdue": 360.00
        }
      }
    }
  ]
}
```

---

### 2.6 Invoices API

**Purpose:** Create sales invoices (ACCREC) and purchase bills (ACCPAY).

#### Get Invoices

```
GET https://api.xero.com/api.xro/2.0/Invoices
    ?where=Status=="AUTHORISED"
    &order=InvoiceNumber ASC
    &page=1
    &Statuses="DRAFT","SUBMITTED"
    &ContactIDs="uuid1","uuid2"
    &InvoiceNumbers="INV-001","INV-002"
    &createdByMyApp=true
    &summaryOnly=false
    &includeArchived=false
```

**Scopes required:** `accounting.transactions` or `accounting.transactions.read`

#### Get Single Invoice

```
GET https://api.xero.com/api.xro/2.0/Invoices/{InvoiceID}
```

#### Create Invoices

```
PUT https://api.xero.com/api.xro/2.0/Invoices
```

#### Update Invoices

```
POST https://api.xero.com/api.xro/2.0/Invoices
```

#### Invoice JSON Structure

```json
{
  "Invoices": [
    {
      "Type": "ACCREC",
      "Contact": {
        "ContactID": "uuid"
      },
      "LineItems": [
        {
          "LineItemID": "uuid (read-only on create)",
          "Description": "Chemical Product A - 25kg",
          "Quantity": 2.0,
          "UnitAmount": 150.00,
          "ItemCode": "CHEM-001",
          "AccountCode": "200",
          "TaxType": "OUTPUT",
          "TaxAmount": 30.00,
          "LineAmount": 300.00,
          "DiscountRate": 0,
          "Tracking": [
            {
              "Name": "Region",
              "Option": "NSW"
            }
          ]
        }
      ],
      "Date": "2026-04-04",
      "DueDate": "2026-05-04",
      "LineAmountTypes": "Exclusive | Inclusive | NoTax",
      "InvoiceNumber": "INV-0001 (max 255, auto-generated if omitted)",
      "Reference": "ORD-2026-0001",
      "BrandingThemeID": "uuid",
      "Url": "https://chemmarket.com/orders/123",
      "CurrencyCode": "AUD",
      "CurrencyRate": 1.0,
      "Status": "DRAFT | SUBMITTED | AUTHORISED | PAID | VOIDED | DELETED",
      "SentToContact": false,
      "ExpectedPaymentDate": "2026-05-04",
      "SubTotal": 300.00,
      "TotalTax": 30.00,
      "Total": 330.00,
      "TotalDiscount": 0.00,
      "InvoiceID": "uuid (read-only)",
      "AmountDue": 330.00,
      "AmountPaid": 0.00,
      "AmountCredited": 0.00
    }
  ]
}
```

**Invoice Types:**
- `ACCREC` - Accounts Receivable (sales invoice to customer)
- `ACCPAY` - Accounts Payable (bill from supplier)

**Invoice Statuses:**
- `DRAFT` - Not yet approved
- `SUBMITTED` - Awaiting approval
- `AUTHORISED` - Approved, awaiting payment
- `PAID` - Fully paid
- `VOIDED` - Cancelled
- `DELETED` - Removed

**Creating a PAID invoice (in one step):**
```json
{
  "Type": "ACCREC",
  "Contact": { "ContactID": "uuid" },
  "Status": "AUTHORISED",
  "LineItems": [...],
  "Payments": [{
    "Account": { "Code": "090" },
    "Date": "2026-04-04",
    "Amount": 330.00
  }]
}
```

---

### 2.7 Purchase Orders API

**Purpose:** Create purchase orders to suppliers.

#### Get Purchase Orders

```
GET https://api.xero.com/api.xro/2.0/PurchaseOrders
    ?Status=AUTHORISED
    &DateFrom=2026-01-01
    &DateTo=2026-04-04
    &order=PurchaseOrderNumber ASC
    &page=1
```

**Scopes required:** `accounting.transactions` or `accounting.transactions.read`

#### Get Single Purchase Order

```
GET https://api.xero.com/api.xro/2.0/PurchaseOrders/{PurchaseOrderID}
```

#### Create Purchase Orders

```
PUT https://api.xero.com/api.xro/2.0/PurchaseOrders
```

#### Update Purchase Orders

```
POST https://api.xero.com/api.xro/2.0/PurchaseOrders
```

#### Purchase Order JSON Structure

```json
{
  "PurchaseOrders": [
    {
      "PurchaseOrderID": "uuid (read-only)",
      "PurchaseOrderNumber": "PO-0001 (auto-generated if omitted)",
      "Contact": {
        "ContactID": "uuid (required)"
      },
      "LineItems": [
        {
          "LineItemID": "uuid (read-only on create)",
          "Description": "Chemical Product A - 25kg drum",
          "Quantity": 10.0,
          "UnitAmount": 120.00,
          "ItemCode": "CHEM-001",
          "AccountCode": "300",
          "TaxType": "INPUT",
          "TaxAmount": 120.00,
          "LineAmount": 1200.00
        }
      ],
      "Date": "2026-04-04",
      "DeliveryDate": "2026-04-15",
      "LineAmountTypes": "Exclusive | Inclusive | NoTax",
      "Reference": "Warehouse restock Q2",
      "CurrencyCode": "AUD",
      "Status": "DRAFT | SUBMITTED | AUTHORISED | BILLED | DELETED",
      "SentToContact": false,
      "DeliveryAddress": "123 George St, Sydney NSW 2000",
      "AttentionTo": "Warehouse Manager",
      "Telephone": "02 9876 5432",
      "DeliveryInstructions": "Deliver to loading dock B (max 500 chars)",
      "ExpectedArrivalDate": "2026-04-15",
      "SubTotal": 1200.00,
      "TotalTax": 120.00,
      "Total": 1320.00
    }
  ]
}
```

**Purchase Order Statuses:**
- `DRAFT` - Not yet approved
- `SUBMITTED` - Awaiting approval
- `AUTHORISED` - Approved, sent to supplier
- `BILLED` - Converted to bill
- `DELETED` - Removed

---

## 3. INTEGRATION FLOW SUMMARY

### Flow 1: Customer Places Order (Checkout)

```
1. Customer selects products in cart
2. Call MachShip returnRoutes to get shipping quotes
   POST /apiv2/routes/returnRoutes
   (pass delivery suburb/postcode + item dimensions/weights)
3. Display carrier options + prices to customer
4. Customer selects carrier and completes payment
5. Create/find Xero Contact for customer
   PUT /api.xro/2.0/Contacts
6. Create Xero Invoice (ACCREC) with line items + shipping line
   PUT /api.xro/2.0/Invoices
7. Create MachShip Pending Consignment (or full consignment)
   POST /apiv2/pendingConsignments/createPendingConsignment
   (store pendingConsignmentId and consignmentNumber in order record)
```

### Flow 2: Warehouse Processes Order

```
1. Warehouse staff picks and packs order
2. Convert pending consignment to full consignment (via MachShip UI or API)
   POST /apiv2/consignments/createConsignment
3. Print labels
   GET /apiv2/labels/getLabelsPdf?consignmentId={id}
4. Group consignments for manifest
   POST /apiv2/manifests/groupConsignmentsForManifest
5. Create manifest (book carrier pickup)
   POST /apiv2/manifests/manifest
6. Update order status to "Shipped"
```

### Flow 3: Track and Complete

```
1. Poll for tracking updates
   GET /apiv2/consignments/getRecentlyCreatedOrUpdatedConsignments
   (run on schedule, e.g. every 15 minutes)
2. When status = COMPLETE, retrieve POD
   POST /apiv2/consignments/getAttachments
   GET /apiv2/attachments/getAttachmentPodReport?id={id}
3. Update Xero invoice to PAID when payment confirmed
   POST /api.xro/2.0/Invoices
```

### Flow 4: Purchase Order to Supplier

```
1. Create Xero Contact for supplier (if not exists)
   PUT /api.xro/2.0/Contacts { IsSupplier: true }
2. Create Xero Purchase Order
   PUT /api.xro/2.0/PurchaseOrders
3. When goods received, convert PO to bill
   POST /api.xro/2.0/Invoices { Type: "ACCPAY" }
```

---

## APPENDIX: Error Handling

### MachShip Error Response Format
```json
{
  "object": null,
  "errors": [
    {
      "validationType": "string",
      "memberNames": ["fieldName"],
      "errorMessage": "Description of the error"
    }
  ]
}
```
Always check `errors` array before processing `object`.

### Xero Error Response Format
```json
{
  "ErrorNumber": 10,
  "Type": "ValidationException",
  "Message": "A validation exception occurred",
  "Elements": [
    {
      "ValidationErrors": [
        {
          "Message": "The Contact Name already exists."
        }
      ]
    }
  ]
}
```

### Xero SummarizeErrors Parameter
Add `?summarizeErrors=false` to POST/PUT requests to get per-record errors when submitting multiple records in a batch.

---

## APPENDIX: Key IDs to Configure

| Setting | Where to Find | Purpose |
|---------|--------------|---------|
| MachShip API Token | MachShip > Users > API Tokens | All API calls |
| MachShip Company ID | GET /apiv2/companies/getAll | Identifies business unit |
| MachShip From Location ID | GET /apiv2/companyLocations | Warehouse pickup address |
| Xero Client ID | developer.xero.com/app/manage | OAuth2 app registration |
| Xero Client Secret | developer.xero.com/app/manage | OAuth2 token exchange |
| Xero Tenant ID | GET /connections after auth | Identifies Xero organisation |
| Xero Account Codes | Xero > Chart of Accounts | For invoice line items (e.g. 200=Sales, 300=Purchases) |
