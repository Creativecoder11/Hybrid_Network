# HYBRID NETWORKS PORTAL
## Application Feature & System Documentation
**Comprehensive Technical & Business Architecture Guide**
*Document Version: 2.0 | Release Date: September 2026 | Prepared for Client Presentation & Operations*

---

# TABLE OF CONTENTS
1. [Application Overview](#1-application-overview)
2. [Application Modules](#2-application-modules)
3. [User Roles & Permission Matrix](#3-user-roles--permission-matrix)
4. [Feature Overview](#4-feature-overview)
5. [Detailed Feature Documentation](#5-detailed-feature-documentation)
   - 5.1 Authentication & Security Gate
   - 5.2 Customer Management & Multi-Account Linking
   - 5.3 CDR File Ingestion & Automatic Detection
   - 5.4 CDR Rating Engine & Product Code Matching Matrix
   - 5.5 Unallocated Records Alert & Unmatched CDR Reporting
   - 5.6 Billing, Invoicing & PDF Generation
   - 5.7 Terminal Inventory & Live Starlink / Satellite Telemetry
   - 5.8 Interactive GPS Fleet Tracking Map
   - 5.9 Service Plans Management
   - 5.10 Customer Helpdesk & Support Desk
   - 5.11 Team Management & System Settings
6. [Main User Workflows](#6-main-user-workflows)
   - 6.1 Authentication & Mandatory First-Login Reset
   - 6.2 CDR Import, Rating & Unallocated Exception Flow
   - 6.3 Invoice Lifecycle & Payment Flow
   - 6.4 Fleet Tracking & Telemetry Flow
7. [Admin Workflow](#7-admin-workflow)
8. [Customer / User Workflow](#8-customer--user-workflow)
9. [System Architecture](#9-system-architecture)
10. [Data Flow](#10-data-flow)
11. [Database Overview & Entity Relationships](#11-database-overview--entity-relationships)
12. [Authentication & Security Controls](#12-authentication--security-controls)
13. [External Integrations](#13-external-integrations)
14. [Reports & Data Management](#14-reports--data-management)
15. [Implementation Status Matrix](#15-implementation-status-matrix)
16. [Current Limitations](#16-current-limitations)
17. [Future Improvement Opportunities](#17-future-improvement-opportunities)
18. [Final Summary](#18-final-summary)

---

# 1. APPLICATION OVERVIEW

### 1.1 What the Application Is
The **Hybrid Networks Portal** is a specialized, multi-tenant enterprise connectivity management, wholesale-to-retail billing, and fleet tracking platform tailored for satellite communication providers, maritime operators, internet service distributors, and enterprise clients.

### 1.2 The Problem It Solves
1. **Complex Telecom & Satellite CDR Billing:** Satellite operators (such as Starlink, Inmarsat, Iridium, and VSAT) produce high-volume, raw Call Detail Records (CDRs) with disparate wholesale formats, complex product codes, and separate voice, SMS, and data streams. Manually parsing and pricing these is error-prone. Hybrid Networks automates file ingestion, product rating, and customer reconciliation.
2. **Multi-Account Client Structures:** Enterprise clients frequently operate multiple vessels, subsidiaries, or projects with distinct account numbers. Hybrid Networks enables multi-account linking under a unified customer login without creating disconnected credentials.
3. **Real-time Fleet Visibility:** Fleet managers require real-time visibility into vessel locations, latency, satellite link health, and data consumption. The platform integrates live Starlink/SLASH APIs and interactive Google Maps tracking.
4. **Automated Tax Invoicing:** Streamlines monthly billing by dynamically combining recurring service plan subscriptions with rated usage charges into branded, tax-compliant PDF invoices.

### 1.3 Target Audience & Users
* **Executive & Billing Administrators:** Manage customer accounts, configure pricing markups, process wholesale CDR uploads, oversee invoices, and monitor revenue analytics.
* **Technical & Operations Staff:** Track fleet health, monitor satellite terminal telemetry (latency, throughput, signal drops), resolve support tickets, and configure service packages.
* **End Customers & Corporate Clients:** View aggregated usage across all linked accounts, inspect live vessel positions, download PDF invoices, and open support tickets.

---

# 2. APPLICATION MODULES

```
+-----------------------------------------------------------------------------------+
|                            HYBRID NETWORKS PLATFORM                               |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [AUTHENTICATION & SECURITY]   [CUSTOMER MANAGEMENT]     [BILLING & CDR ENGINE]   |
|  - Role-based Login Gate       - Multi-Account Linking   - Bulk CSV Parser        |
|  - First-Login Forced Reset    - Starlink Vessel Link    - Product Code Matcher   |
|  - JWT Session / DAL Guards    - Lifecycle Controls      - Unallocated Alerts     |
|                                                                                   |
|  [INVOICING & PAYMENTS]        [FLEET & SATELLITE]       [HELPDESK & SUPPORT]     |
|  - Auto Monthly Invoicing      - Live Starlink Telemetry - Ticket Threading       |
|  - PDF Render Engine           - Google Maps GPS Fleet   - Priority Management    |
|  - Payment Status Lifecycle    - Terminal Inventory      - Customer Portal Chat   |
|                                                                                   |
|  [ANALYTICS & REPORTING]       [TEAM & ACCESS]           [SYSTEM SETTINGS]        |
|  - Consumption Graphs          - Super Admin vs Staff    - Company & Tax Details  |
|  - Unallocated CDR Export      - Audit Activity Logs     - SMTP & API Config      |
+-----------------------------------------------------------------------------------+
```

---

# 3. USER ROLES & PERMISSION MATRIX

The application enforces strict Role-Based Access Control (RBAC) across three distinct roles:

| Module / Capability | SUPER_ADMIN (Executive) | SUB_ADMIN (Staff) | CUSTOMER (Client) |
| :--- | :---: | :---: | :---: |
| **Admin Portal Access** (`/admin/*`) | ✅ Full Access | ✅ Full Access | ❌ Forbidden (Redirected) |
| **Customer Portal Access** (`/portal/*`) | ❌ Staff Boundary | ❌ Staff Boundary | ✅ Full Access |
| **Customer Creation & Editing** | ✅ Create / Edit / Delete | ✅ Create / Edit | ❌ Read Own Only |
| **Multi-Account Assignment** | ✅ Full Access | ✅ Full Access | ❌ Read Own Only |
| **CDR Ingestion & Rating** | ✅ Full Access | ✅ Full Access | ❌ View Own Charges Only |
| **Unallocated CDR Report Export** | ✅ Full Access | ✅ Full Access | ❌ Not Permitted |
| **Retail Plan & Pricing Config** | ✅ Create / Edit / Delete | ✅ Create / Edit | ❌ Not Permitted |
| **Invoice Generation & PDF Export** | ✅ Generate / Void / Delete | ✅ Generate / View | ✅ View & Download Own |
| **Terminal Inventory & Remote State**| ✅ Full Access | ✅ Full Access | ✅ View Own Terminals |
| **Live GPS Fleet Tracking Map** | ✅ All Vessels Globally | ✅ All Vessels Globally | ✅ Own Vessels Only |
| **Service Plans Management** | ✅ Full Access | ✅ View / Edit | ✅ View Own Subscriptions |
| **Support Desk & Ticketing** | ✅ Full Access | ✅ Reply / Assign / Close | ✅ Create & Reply Own |
| **Staff & Team User Management** | ✅ Create / Suspend / Delete | ❌ Read Only | ❌ Forbidden |
| **System Settings & SMTP Config** | ✅ Full Access | ❌ Read Only | ❌ Forbidden |

---

# 4. FEATURE OVERVIEW

### Core Platform Capabilities
* **Dual Portal Separation:** Separate routing and middleware controls for Admin (`/admin`) and Customer (`/portal`) domains.
* **Strict First-Login Security Gate:** Automated issuance of temporary credentials with mandatory password change enforcement before granting portal access.
* **Multi-Account Customer Linking:** Ability to link multiple Customer Codes / Account Numbers (e.g., `ZZSP100, ACC-2001`) to a single user profile.
* **Wholesale-to-Retail CDR Rating Engine:** Processes bulk and single CSV files, auto-detects column headers, and rates records using configurable Percentage Markup (e.g., 50%) or Fixed Price models.
* **Product Code & Traffic Type Matching:** Identifies compound telecom codes (e.g., `Type,CALL - CODE 123`, `Type,SMS - CODE 245`, `DATA - CODE 789`).
* **Unallocated CDR Exception Management:** Protects data integrity by preventing fake account creation; generates prominent alerts and downloadable Unallocated CSV Reports for missing accounts.
* **Tax-Compliant PDF Invoicing:** Client-grade PDF generator using `@react-pdf/renderer` with detailed line items, tax calculations, payment instructions, and invoice status tracking.
* **Real-Time Starlink Integration:** SLASH API integration for live satellite telemetry (SNR, latency, throughput, uptime, ping drops).
* **Interactive Fleet Tracking:** Integrated Google Maps GPS visualization showing live coordinates, speed, heading, and vessel status.
* **Ticketing & Support Helpdesk:** Multi-tiered ticket tracking with categorization, priority levels, and real-time response threads.

---

# 5. DETAILED FEATURE DOCUMENTATION

## 5.1 Authentication & Security Gate
* **Purpose:** Ensures secure, authenticated access with role segregation and strict credential rotation.
* **Who Uses It:** All platform users (Administrators, Staff, and Customers).
* **Workflow:**
  1. User navigates to the login screen and submits identifier (email or Customer ID) and password.
  2. The system verifies bcrypt password hashes and checks lockout thresholds (max 5 failed attempts = 15-minute lock).
  3. If `mustChangePassword` is `true` (temporary password), the user is immediately redirected to `/first-login-change-password`.
  4. The user validates their temporary password and sets a new permanent password (min 8 chars, 1 digit).
  5. The system establishes an encrypted HTTP-only JWT session cookie (`hn_session`) and routes the user to their authorized portal.

## 5.2 Customer Management & Multi-Account Linking
* **Purpose:** Centralizes customer profiles, service subscriptions, and multi-account hierarchies.
* **Who Uses It:** Super Admins and Sub Admins.
* **Workflow:**
  1. Admin opens the Customer Form Modal.
  2. Enters contact details, service parameters, and comma-separated Customer Codes in `Customer Account Code(s)`.
  3. Optional: Links a Starlink Vessel ID to pull real-time satellite telemetry.
  4. The system validates uniqueness across existing customer codes in MongoDB.
  5. Saves the record, creates an active subscription, logs an audit entry, and dispatches an invitation email with temporary credentials.

## 5.3 CDR File Ingestion & Automatic Detection
* **Purpose:** Ingests wholesale CDR CSV files containing up to tens of thousands of usage transactions.
* **Who Uses It:** Billing Administrators.
* **Workflow:**
  1. Admin drags and drops a CSV file in `Billing ➔ CDR Import`.
  2. PapaParse stream-parses records while `detectColumns()` identifies headers using fuzzy aliases for Customer Codes, Product Codes, Record IDs, and Wholesale Amounts.
  3. Generates an SHA-256 hash of file content to detect duplicate batch uploads.

## 5.4 CDR Rating Engine & Product Code Matching Matrix
* **Purpose:** Calculates retail charges from wholesale costs based on active pricing rules.
* **Who Uses It:** Internal billing engine.
* **Workflow:**
  1. Matches the row's Customer Code against `User.customerCodes` map.
  2. Matches the row's Product Code / Identifier against active `RetailPlan` mappings.
  3. Computes retail charges: `wholesaleAmount * (1 + markupPercent / 100)` or `fixedPrice`.
  4. Snapshots the calculation in `CdrChargeRecord` to protect historical audit integrity even if plans change later.

## 5.5 Unallocated Records Alert & Unmatched CDR Reporting
* **Purpose:** Flags records with missing Customer Codes or unmapped Product Codes without creating invalid customer profiles.
* **Who Uses It:** Billing Administrators.
* **Workflow:**
  1. If any row cannot find an existing Customer Code in the system, it is marked as `UNMATCHED`.
  2. An **Unallocated Records Alert Card** displays on the batch screen.
  3. Admin clicks **"📥 Download Unallocated Report (.csv)"** to export a clean CSV with row numbers, unknown codes, and wholesale amounts.
  4. Admin adds the missing customer or maps the product code, then clicks **"Reprocess Unmatched"** to re-rate without re-uploading.

## 5.6 Billing, Invoicing & PDF Generation
* **Purpose:** Aggregates rated CDR records and recurring subscription fees into customer invoices.
* **Who Uses It:** Administrators and Customers.
* **Workflow:**
  1. Admin triggers invoice generation for a billing period.
  2. The system aggregates matched CDR charges and subscription line items, calculates tax, and sets status to `DRAFT`.
  3. Admin reviews and sends invoice; customer receives an email notification.
  4. Customer views invoice in portal and downloads the branded PDF invoice via `/api/invoices/[id]/pdf`.

## 5.7 Terminal Inventory & Live Starlink Telemetry
* **Purpose:** Monitors satellite terminals, antennas, and network hardware in real time.
* **Who Uses It:** Operations Staff and Customers.
* **Workflow:**
  1. System queries the SLASH API using `starlinkVesselId`.
  2. Retrieves real-time latency, download/upload throughput, ping drops, obstruction status, and connection state.
  3. Displays live visual indicators (`Online`, `Degraded`, `Offline`) with interactive telemetry charts.

## 5.8 Interactive GPS Fleet Tracking Map
* **Purpose:** Real-time spatial tracking of maritime vessels and mobile terminals.
* **Who Uses It:** Administrators (global fleet) and Customers (own vessels).
* **Workflow:**
  1. GPS latitude/longitude, speed, and heading are ingested via API / telemetry.
  2. Rendered on Google Maps with custom vessel markers, heading arrows, and status tooltips.

---

# 6. MAIN USER WORKFLOWS

### 6.1 Authentication & First-Login Security Flow
```
[User Receives Email] 
       │
       ▼
[Enter Temp Credentials on /login]
       │
       ▼
[System Checks: mustChangePassword == true] ──► YES ──► [Redirect to /first-login-change-password]
       │                                                                │
       ▼ NO                                                             ▼
[Generate Session JWT]                                    [Enter Temp PW + New Permanent PW]
       │                                                                │
       ▼                                                                ▼
[Role Dispatch: /admin or /portal]                         [Save Hash, mustChangePassword = false]
                                                                        │
                                                                        ▼
                                                           [Access Authorized Dashboard]
```

### 6.2 CDR Ingestion, Rating & Unallocated Exception Flow
```
[Admin Uploads Wholesale CDR CSV]
               │
               ▼
   [Auto-Detect Columns & Hash]
               │
               ▼
   [Iterate Over Data Rows]
       ├── Matches Customer Code? ──► NO  ──► [Mark UNMATCHED: "Unallocated Customer Code"]
       └── Matches Product Code?  ──► NO  ──► [Mark UNMATCHED: "Unmapped Product Code"]
       └── Matches Both?          ──► YES ──► [Calculate Retail Charge & Mark MATCHED]
               │
               ▼
   [Batch Import Summary Screen]
       ├── Any Unmatched Rows? ──► YES ──► [Display Unallocated Alert Card]
       │                                            │
       │                                            ▼
       │                                   [Download Unallocated CSV Report]
       │                                            │
       │                                            ▼
       │                                   [Admin Maps Code / Adds Customer]
       │                                            │
       │                                            ▼
       │                                   [Click "Reprocess Unmatched"]
       │
       └── All Matched? ──► [Ready for Monthly Invoice Generation]
```

---

# 7. ADMIN WORKFLOW
1. **Login & Dashboard:** Access `/admin`, review active subscriber metrics, revenue totals, terminal online status, and pending support requests.
2. **Customer Registration:** Add clients, link multiple account codes (`customerCodes`), assign Starlink Vessel IDs, and set initial subscriptions.
3. **CDR Processing:** Periodically import wholesale CDR files. Inspect matched amounts, review unallocated alert notifications, and download exception CSV reports.
4. **Product Rating:** Configure Retail Plans (percentage markup or fixed prices) and map new identifier codes.
5. **Invoice Management:** Generate monthly customer invoices, review line items, email notices, and record payments.
6. **Fleet Monitoring:** Monitor terminal telemetry, view live GPS positions on Google Maps, and manage support tickets.

---

# 8. CUSTOMER / USER WORKFLOW
1. **First-Time Access:** Receive invitation email, log in with temporary credentials, complete mandatory password change, and land on the overview dashboard.
2. **Unified Account View:** Monitor total data usage (GB), minute/SMS volume, and remaining allowances across all linked accounts from a single screen.
3. **Device Health:** Check whether assigned satellite terminals are Online or Offline, verify IP addresses, and inspect Starlink signal telemetry.
4. **Live Fleet Tracking:** Open the tracking tab to see real-time vessel positions on the interactive map.
5. **Invoices & Billing:** Review billing history, check balance due, and download branded PDF invoices for accounting.
6. **Support Helpdesk:** Create support tickets for network or billing inquiries and track staff replies.

---

# 9. SYSTEM ARCHITECTURE

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSERS                                   |
|                Admin Portal Users          Customer Portal Users                  |
+----------------------------------------+------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        NEXT.JS 16 FULL-STACK WEB APPLICATION                      |
|                                                                                   |
|  [EDGE MIDDLEWARE & PROXY]                                                        |
|  - Subdomain Mode Dispatch (PORTAL_MODE)                                          |
|  - Auth Session Validation & Route Protection                                     |
|                                                                                   |
|  [APPLICATION & UI LAYER]                                                         |
|  - App Router (Server Components & Client Components)                             |
|  - Tailwind CSS + Sonner Toasts + Recharts Analytics                              |
|                                                                                   |
|  [SERVER ACTIONS & API ROUTE HANDLERS]                                            |
|  - Auth / DAL Layer (JWT Cookie Validation via 'jose')                            |
|  - Customer, Subscription, and Invoice Actions                                    |
|  - CDR Ingestion, Parsing (PapaParse), & Deduplication                            |
|  - PDF Render Engine (@react-pdf/renderer)                                        |
|  - Real-Time SLASH API Connector (Starlink Telemetry)                             |
+----------------------------------------+------------------------------------------+
                                         │
                  +----------------------+----------------------+
                  │                                             │
                  ▼                                             ▼
+-----------------------------------+         +-------------------------------------+
|        MONGODB DATABASE           |         |         EXTERNAL SERVICES           |
|  - Users & Customer Accounts      |         |  - SLASH API (Starlink Data)        |
|  - Subscriptions & Service Plans  |         |  - Google Maps JavaScript API       |
|  - CDR Batches & Charge Records   |         |  - SMTP Server (Email Dispatch)     |
|  - Invoices & Usage Records       |         +-------------------------------------+
|  - Support Tickets & Audit Logs   |
+-----------------------------------+
```

---

# 10. DATA FLOW

1. **CDR Ingestion & Rating Flow:** Raw CSV ➔ PapaParse ➔ Column Detection ➔ Customer Matcher Map ➔ Retail Plan Map ➔ Snapshot Charge Record ➔ Aggregated Monthly Invoice.
2. **Telemetry Flow:** SLASH API ➔ `starlinkFetch` (deduplication & backoff) ➔ Normalization ➔ Real-Time UI Widgets & Google Maps Overlay.
3. **Invoicing Flow:** Rated CDR Records + Subscription Line Items ➔ Tax Calculator ➔ Invoice Entity ➔ React-PDF Renderer ➔ PDF Buffer Stream.

---

# 11. DATABASE OVERVIEW & ENTITY RELATIONSHIPS

### Primary Entities in MongoDB:
* **User:** Stores authentication credentials, user role (`SUPER_ADMIN`, `SUB_ADMIN`, `CUSTOMER`), account status (`INVITED`, `ACTIVE`, `SUSPENDED`), `mustChangePassword` flag, primary `customerCode`, multi-account array `customerCodes`, `starlinkVesselId`, and address/network info.
* **CustomerAccount:** Dedicated secondary entity for corporate account numbers, account names, and contact details.
* **Subscription:** Links a `User` (Customer) to a `ServicePlan`, storing static IP, terminal IDs, and activation dates.
* **ServicePlan:** Master catalog of ISP/Satellite packages with bandwidth (speed in Mbps), monthly price, shared ratios, and data allowances.
* **RetailPlan:** Configurable retail rating rules specifying `PERCENTAGE_MARKUP` (e.g. 50%) or `FIXED_PRICE`.
* **CdrIdentifierMapping:** Maps telecom product codes / CDR identifiers to active Retail Plans.
* **CdrImportBatch:** Header record of a CDR upload (file name, file hash, total rows, matched, unmatched, total wholesale/retail amounts, status).
* **CdrChargeRecord:** Granular transaction record storing raw row data, matched customer, applied retail plan, wholesale amount, calculated retail amount, status (`MATCHED`/`UNMATCHED`), error reasons, and invoice link.
* **Invoice:** Master billing document with invoice number, period, subtotal, tax amount, total, amount paid, balance due, status, line items, and payment references.
* **UsageRecord:** Monthly bucket of aggregated customer usage (data volume in bytes, voice minutes, SMS messages, source).
* **SupportTicket:** Customer inquiry record with ticket number, subject, category, priority, status, message thread, and assigned agent.
* **ActivityLog:** Comprehensive audit trail recording actor, target customer, action code, metadata, and timestamps.

---

# 12. AUTHENTICATION & SECURITY CONTROLS

* **Password Security:** Cryptographic password hashing using `bcryptjs` with salt rounds.
* **Session Management:** Secure, HTTP-only, SameSite cookies carrying encrypted JWT tokens signed via `jose` (HS256).
* **Brute-Force Protection:** Account lockout mechanism (5 consecutive failed attempts locks the account for 15 minutes).
* **First-Login Enforcement:** Gated redirection preventing any dashboard interaction until temporary passwords are changed.
* **Input Validation:** End-to-end schema validation on all server actions and API routes using `zod`.
* **Audit Logging:** Every critical administrative action (customer creation, suspension, plan changes, CDR uploads, password updates) is immutably logged in `ActivityLog`.

---

# 13. EXTERNAL INTEGRATIONS

1. **SLASH API (Starlink Enterprise Data):**
   * Communicates with `https://slash-api.rudra.sh/api/v1` via secure API key header (`X-API-Key`).
   * Fetches real-time vessel telemetry, terminal latency, ping loss, bandwidth consumption, and device diagnostics.
   * Employs automated request deduplication and exponential backoff retry handling.
2. **Google Maps JavaScript API:**
   * Powers interactive fleet tracking maps in both Admin and Customer portals.
3. **Nodemailer / SMTP Service:**
   * Dispatches transactional emails (invitations, password resets, temporary credentials, invoice notices).

---

# 14. REPORTS & DATA MANAGEMENT

* **Unallocated CDR Report (.csv):** Dedicated export for CDR rows that failed matching, detailing row numbers, missing customer codes, wholesale amounts, and error reasons.
* **CDR Batch Full Export (.csv):** Full export of all processed, matched, and invalid rows in an import batch.
* **Invoice PDF Generator:** Tax-compliant PDF generation with company ABN, line items, and payment instructions.
* **System Analytics Exports:** Downloadable reports for customer rosters, terminal inventories, usage histories, and financial summaries.

---

# 15. IMPLEMENTATION STATUS MATRIX

| Feature / Capability | Codebase Status | Verification Method |
| :--- | :---: | :--- |
| **Authentication & Role Guards** | ✅ Fully Implemented | Unit & E2E Tested |
| **First-Login Mandatory Password Gate**| ✅ Fully Implemented | Gated via Server Actions & DAL |
| **Multi-Account Customer Linking** | ✅ Fully Implemented | Verified via User.customerCodes |
| **Bulk & Single CDR Upload** | ✅ Fully Implemented | Verified via PapaParse & Retail Engine |
| **Product Code CDR Matching** | ✅ Fully Implemented | Tested against compound codes |
| **Unallocated CDR Alert & CSV Export** | ✅ Fully Implemented | Dedicated API Endpoint & Alert UI |
| **Retail Pricing Markup Engine** | ✅ Fully Implemented | Percentage & Fixed Price Tested |
| **Automated Invoice Generation** | ✅ Fully Implemented | Integrated with CDR Charges |
| **PDF Invoice Document Generation** | ✅ Fully Implemented | @react-pdf/renderer engine |
| **Live Starlink Telemetry via SLASH** | ✅ Fully Implemented | Live client with dedupe & retries |
| **Google Maps GPS Fleet Tracking** | ✅ Fully Implemented | Interactive coordinates & vessel pins |
| **Support Desk & Ticketing System** | ✅ Fully Implemented | Threaded replies & status controls |
| **Multi-Domain Hostinger Deployment** | ✅ Fully Implemented | proxy.ts portal-mode separation |

---

# 16. CURRENT LIMITATIONS

1. **Payment Gateway Automation:** Invoices currently support manual payment marking (e.g. Bank Transfer / Credit Card status updates) rather than an embedded live card checkout gateway (e.g. Stripe webhooks).
2. **Third-Party Telemetry Dependency:** Starlink telemetry depends on upstream SLASH API availability and valid tenant credentials.

---

# 17. FUTURE IMPROVEMENT OPPORTUNITIES

1. **Automated Payment Gateway Integration:** Adding Stripe or Adyen embedded checkout for instant invoice credit card payments.
2. **Automated Scheduled CDR Ingestion:** Setting up automated SFTP / S3 bucket polling to ingest wholesale CDR files automatically without manual upload.
3. **SMS Alerts:** Integrating Twilio or AWS SNS for instant SMS notifications on high bandwidth consumption or critical terminal offline alerts.

---

# 18. FINAL SUMMARY

The **Hybrid Networks Portal** is a production-ready, fully functional multi-portal software system. It successfully combines complex satellite telecommunication management, high-volume CDR rating, multi-account client architectures, live GPS fleet tracking, and automated PDF invoicing within a clean, secure, and intuitive web application.
