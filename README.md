# Measy MissCall

Multi-tenant SaaS platform that automates missed call handling for businesses. When a customer's call goes unanswered, Twilio IVR captures their intent (callback request), sends an SMS with a booking link, and the customer can book appointments online.

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (credentials provider, JWT)
- **Voice/SMS:** Twilio SDK
- **Payments:** Stripe (subscriptions, customer portal)
- **UI:** Tailwind CSS + shadcn/ui components
- **State:** TanStack React Query
- **Validation:** Zod

## Features

- **Multi-Tenant Architecture** — Row-level isolation with `tenantId`, slug-based customer pages
- **Twilio IVR Call Flow** — Missed call detection → IVR menu → SMS with booking link
- **Online Booking** — Customers book appointments via SMS link with time slot picker
- **Stripe Billing** — Subscription plans, Stripe Checkout, Customer Portal
- **5-Step Onboarding** — Business profile, phone setup, services, plan selection, review & go live
- **Tenant Dashboard** — Calls log, appointments, services CRUD, SMS logs, billing, settings
- **Super Admin Panel** — Tenant management, plan CRUD, platform analytics, shared Twilio/IVR config
- **Role-Based Access** — SUPER_ADMIN, TENANT_OWNER, TENANT_STAFF with middleware enforcement

## Call Flow

```
Customer calls business Twilio number
  → /api/twilio/voice — Forward call to business phone (configurable timeout)
  → /api/twilio/status — If unanswered → play IVR
     "Press 1 for callback"
  → /api/twilio/gather — Process digit
     Press 1 → SMS with booking link → customer books online
  → /api/twilio/sms-status — Track SMS delivery
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Twilio account (optional for development)
- Stripe account (optional for development)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Configure Environment

Edit `.env` with your values:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/measy_misscall"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Twilio (optional)
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Stripe (optional)
STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Database Setup

```bash
# Create database tables
npx prisma migrate dev --name init

# Seed with demo data
npm run db:seed
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@measy.com | admin123 |
| Tenant Owner | joe@example.com | owner123 |

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, Register
│   ├── (dashboard)/         # Tenant dashboard (protected)
│   │   └── dashboard/
│   │       ├── calls/
│   │       ├── appointments/
│   │       ├── services/
│   │       ├── sms-logs/
│   │       ├── billing/
│   │       ├── settings/
│   │       └── onboarding/
│   ├── (admin)/             # Super admin panel
│   │   └── admin/
│   │       ├── tenants/
│   │       ├── plans/
│   │       ├── analytics/
│   │       └── settings/
│   ├── shop/[slug]/         # Customer-facing pages
│   │   ├── book/
│   └── api/
│       ├── auth/
│       ├── twilio/          # Voice, status, gather, sms-status
│       ├── stripe/          # Webhook, checkout, portal
│       ├── admin/
│       └── public/
├── components/
│   ├── ui/                  # Button, Card, Table, Dialog, etc.
│   ├── layout/              # Sidebar, Header, AdminSidebar
│   └── shared/              # PageHeader, StatusBadge, EmptyState
├── lib/
│   ├── auth.ts              # NextAuth config
│   ├── prisma.ts            # Prisma client
│   ├── twilio.ts            # Twilio client factory
│   ├── twiml.ts             # TwiML response builders
│   ├── sms.ts               # SMS sending utility
│   ├── stripe.ts            # Stripe client + helpers
│   ├── validations.ts       # Zod schemas
│   └── utils.ts             # Utilities
├── providers/               # Session, Query, Tenant providers
├── hooks/                   # React Query hooks
├── types/                   # TypeScript types + NextAuth augmentation
└── middleware.ts             # Auth gate + role routing
```

## Database Models

| Model | Purpose |
|-------|---------|
| User | Auth users (SUPER_ADMIN, TENANT_OWNER, TENANT_STAFF) |
| Tenant | Business entity with Twilio config, subscription, onboarding state |
| Service | Services offered by a business |
| Call | Missed call records with IVR response tracking |
| Appointment | Customer bookings linked to services |
| SmsLog | All SMS sent with delivery status |
| BusinessHours | Per-day open/close times per tenant |
| Plan | Subscription plans with limits |
| Subscription | Stripe subscription records per tenant |
| PlatformSettings | Shared Twilio config, default IVR messages |

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run db:migrate   # Run Prisma migrations
npm run db:push      # Push schema to database
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
npm run lint         # Run ESLint
```

## Testing the Twilio Flow

1. Set up [ngrok](https://ngrok.com/) to expose your local server
2. Configure your Twilio phone number webhook to `https://your-ngrok-url/api/twilio/voice`
3. Call the Twilio number and let it ring
4. Hear the IVR, press 1 or 2
5. Receive SMS with booking link
6. Open the link and complete the form

## License

MIT
