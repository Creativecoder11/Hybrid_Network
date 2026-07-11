# Hybrid Networks Portal

A billing, usage-tracking, and customer-management platform for an ISP distributor reselling connectivity (Starlink, Fiber, VSAT) to end customers. Built with Next.js 16, MongoDB/Mongoose, and TypeScript.

## Tech stack

- **Framework:** Next.js 16 (App Router, Server Actions, Route Handlers)
- **Language:** TypeScript (strict)
- **Database:** MongoDB via Mongoose
- **Styling:** Tailwind CSS v4, dark theme
- **Auth:** Custom JWT sessions (`jose`) in httpOnly cookies — no third-party auth provider
- **Email:** Nodemailer (falls back to console logging when SMTP isn't configured)
- **CDR parsing:** `xlsx` (SheetJS) + `papaparse`
- **PDF invoices:** `@react-pdf/renderer`
- **Charts:** `recharts`

## Prerequisites

- Node.js 20+ (project was built/tested on Node 21)
- A running MongoDB instance (local or Atlas)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables** — copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `MONGODB_URI` | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/hybrid-networks` |
   | `JWT_SECRET` | Long random string used to sign session tokens (`openssl rand -base64 48`) |
   | `NEXT_PUBLIC_APP_URL` | Public base URL of the app, e.g. `http://localhost:3000` — used in invite/reset/invoice links |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP credentials for sending real email. **Leave blank in development** — emails are logged to the console instead of sent, including the invite/reset/invoice links, so you can click through flows without a mail server. |
   | `EMAIL_FROM` | From-address used on outgoing email |

   If you don't have MongoDB running locally, the quickest option is a local install via Homebrew (`brew install mongodb-community`) or Docker (`docker run -d -p 27017:27017 mongo:8`). A managed MongoDB Atlas free tier also works — just put its connection string in `MONGODB_URI`.

3. **Seed the database**

   ```bash
   npm run seed
   ```

   This clears and repopulates the database with:
   - 1 Super Admin, 1 Sub Admin
   - 3 service plans (Starlink, Fiber)
   - 5 sample customers (varied statuses: active, suspended, invited) with subscriptions and 6 months of usage history
   - 10 invoices in mixed statuses (draft/due/overdue/paid/cancelled)

   **The seed script prints login credentials to the console** — copy them from there. As a starting point:

   - Super Admin: `admin@hybridnetworks.com` / `HybridAdmin@123`
   - Sub Admin: `ayesha@hybridnetworks.com` / `HybridSub@123`
   - Sample active customers: password `Customer@123` for all (see console output for emails/IDs)

   One seeded customer (`ZZSP100`, card name `NI-APAC_SUPPORT`, ICCID `KITP00279271`) intentionally matches the real CDR sample file in `design-reference/Rated_CDRs-NI-APAC_SUPPORT.xlsx`, so uploading that file via **Admin → CDR Upload** immediately produces a matched, non-trivial result.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). You'll land on `/login`; role-based redirects send admins to `/admin` and customers to `/portal`.

## Other scripts

```bash
npm run build       # production build
npm run start        # run the production build
npm run lint          # ESLint
npm run typecheck  # tsc --noEmit
```

## Project structure

```
app/
  (auth)/         # login, set-password, forgot/reset password (public)
  admin/          # SUPER_ADMIN / SUB_ADMIN area
  portal/         # CUSTOMER area
  api/            # Route Handlers (CDR upload, PDF generation, unmatched CSV export)
components/
  ui/             # design-system primitives (Button, Card, Table, Modal, ...)
  admin/          # admin-only components
  portal/         # customer-portal components
  support/        # shared support-ticket thread UI
lib/
  auth/           # session/JWT, password hashing, invite tokens, the auth DAL
  actions/        # Server Actions (customers, plans, team, billing, CDR, support, profile)
  cdr/            # Rated-CDR parser, generic fallback parser, matcher, aggregator
  billing/        # invoice line-item calculation, PDF data assembly, overdue status sync
  dashboard/      # admin dashboard stats aggregation
  db/             # Mongoose connection singleton
  pdf/            # @react-pdf/renderer invoice document
  validations/    # zod schemas
models/           # Mongoose schemas
emails/           # HTML email templates
proxy.ts          # route protection (Next.js 16's replacement for middleware.ts)
scripts/seed.ts   # database seed script
```

## Notes on a few implementation decisions

- **CDR aggregation** sums `Volume In/Out/Total Bundle` across all matched rows for a billing period, per the literal aggregation rule in the CDR spec. The real sample file's own grand-totals row doesn't total those particular columns (only the data-volume columns), which is worth knowing if you're reconciling numbers against a source export by eye.
- **Invoice status flow** is `DRAFT → DUE (on send) → OVERDUE (auto, once the due date passes) → PAID`. The `SENT` status exists in the schema for flexibility but the app moves straight to `DUE` on send, matching how the UI only ever surfaces Due/Overdue badges for outstanding bills.
- **"Revenue by Usage Type"** on the admin dashboard is derived from actual invoice line-item categories we track (plan subscriptions, data overage, voice overage) rather than a fixed Satellite/Mobile/National/International taxonomy the data model has no way to represent.
- Generic (non-Rated-CDR) file uploads use best-effort column-name matching rather than an interactive mapping wizard — sufficient to ingest a differently-shaped export, but without a save-as-template step.
