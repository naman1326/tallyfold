# Tallyfold — Receipts, Reconciled

<div align="center">

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![AWS](https://img.shields.io/badge/AWS-S3%20%7C%20Lambda%20%7C%20DynamoDB-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![QuickBooks](https://img.shields.io/badge/QuickBooks-Online%20Sandbox-2CA01C?logo=quickbooks&logoColor=white)](https://developer.intuit.com/)
[![Design](https://img.shields.io/badge/Design-Apple%20Fluid%20HIG-000000?logo=apple&logoColor=white)](#apple-design-system--uiux)

**Automated receipt capture, OCR verification, and ledger reconciliation pipeline bridging physical expenses into QuickBooks Online.**

</div>

---

## Architecture Overview

Tallyfold operates across three tightly decoupled tiers: a modern fluid frontend, a serverless AWS receipt processing backend, and Intuit QuickBooks Online.

<div align="center">
  <img src="./docs/architecture.png" alt="Tallyfold 3-Tier Architecture Diagram" width="800" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</div>

### Interactive Flowchart

```mermaid
flowchart TD
    subgraph Tier1["🖥️ 1. Frontend — Review Screen"]
        UI_Dash["Dashboard &amp; Metrics<br/>(Spend Breakdown, Category Bars, KPI Cards)"]
        UI_Review["Review Queue &amp; Inspection Sheet<br/>(Live OCR Confidence, Eligibility Checklist)"]
        UI_Upload["AirDrop-style Upload Dropzone<br/>(Step Pipeline &amp; File Validation)"]
    end

    subgraph Tier2["🗄️ 2. AWS Backend Pipeline"]
        GW["Dev Proxy Gateway / CloudFront<br/>(Injects API_KEY &amp; REVIEW_TOKEN)"]
        S3["Amazon S3 Private Bucket<br/>(Presigned PUT with x-amz-meta-* binding)"]
        OCR["AWS Lambda + Tesseract OCR<br/>(Extracts Merchant, Date, Total, Tax, Category)"]
        DDB["Amazon DynamoDB<br/>(Key: userId / SK: date#receiptId · State Machine)"]
    end

    subgraph Tier3["📖 3. QuickBooks Online (Sandbox)"]
        QBO_API["Intuit QBO Accounting API"]
        QBO_Ledger["Sandbox Expense Register<br/>(Account 35 · Checking Ledger)"]
    end

    UI_Upload -->|1. Request Presigned URL| GW
    GW -->|POST /upload| S3
    S3 -->|2. S3 ObjectCreated Trigger| OCR
    OCR -->|3. Store Extracted Data (NEEDS_REVIEW)| DDB
    UI_Review <-->|4. GET /expenses &amp; POST /review| GW
    GW -->|5. Validate Review Token &amp; Dispatch| DDB
    DDB -->|6. Async Ledger Sync (PENDING → SYNCED)| QBO_API
    QBO_API -->|7. Verified Expense Entry| QBO_Ledger

    classDef screen fill:#18181b,stroke:#027a75,stroke-width:2px,color:#f4f4f5;
    classDef aws fill:#18181b,stroke:#f59e0b,stroke-width:2px,color:#f4f4f5;
    classDef qbo fill:#18181b,stroke:#22c55e,stroke-width:2px,color:#f4f4f5;
    class Tier1 screen;
    class Tier2 aws;
    class Tier3 qbo;
```

---

## The Three Tiers Explained

### 1. Frontend — Review & Inspection Screen
- **Role**: Client interface where finance teams review, audit, and approve receipts before they hit accounting books.
- **Key Capabilities**:
  - **Live OCR Confidence Gauge**: Color-coded meter indicating document readability and extraction certainty.
  - **Eligibility Verification Checklist**: Inline validation confirming status is `NEEDS_REVIEW`, confidence is $\ge 75\%$, currency is `USD`, account is `Checking 35`, and category is approved.
  - **Slide-over Sheet Drawer**: Non-modal inspection sheet with keyboard accessibility (`Esc` dismiss) and smooth Apple spring animation.
  - **Multi-attribute Filtering & Sorting**: Real-time text search, quick status chips, date range filtering, column-based sorting, and instant CSV export.
  - **Zero-secret Client Model**: Never stores `API_KEY` or `REVIEW_TOKEN` in client code or bundle.

### 2. AWS Backend Pipeline
- **Role**: Ingestion, OCR parsing, persistent state storage, and rule enforcement.
- **Key Services**:
  - **Amazon S3**: Stores raw receipt images in a private bucket. Uploads require exact `Content-Type` and `x-amz-meta-*` headers bound to presigned URLs.
  - **AWS Lambda + Tesseract OCR**: Automatically triggered upon S3 upload to parse merchant name, receipt date, subtotal, tax, total amount, and categorized spend.
  - **Amazon DynamoDB**: Stores receipt state records partitioned by `userId`. State machine progression:
    $$\text{NEEDS\_REVIEW} \longrightarrow \text{PENDING} \longrightarrow \text{SYNCING} \longrightarrow \text{SYNCED} \quad (\text{or } \text{FAILED})$$
  - **Review Authority**: The backend Lambda is the single source of truth for review eligibility; frontend checklist mirrors the policy to provide immediate feedback.

### 3. QuickBooks Online (Sandbox)
- **Role**: General ledger and accounting sandbox environment.
- **Key Flow**:
  - Once an expense is approved, the backend schedules an asynchronous sync job.
  - Generates verified transaction records under the Sandbox company with linked payment accounts and expense categories.
  - Reports transaction ID (`qboId`) and synchronization status back to DynamoDB.

---

## Apple Design System & UI/UX

The interface was redesigned from the ground up according to the **Apple Design Guidelines** ([SKILL.md](./SKILL.md)):

- **Translucent Materials & Depth (§12)**:
  - Header, slide-over drawer, and notifications use `backdrop-filter: blur(24px) saturate(190%)` frosted glass styling.
  - Hairline borders (`rgba(0, 0, 0, 0.08)` / `rgba(255, 255, 255, 0.09)`) and layered ambient elevation shadows.
- **Fluid Motion & Latency Elimination (§1, §3, §4)**:
  - Immediate `:active` tactile downstate (`transform: scale(0.965); transition: transform 90ms ease-out;`).
  - Critically damped spring physics (`cubic-bezier(0.25, 1, 0.5, 1)`) for UI elements and slight bounce for drawers and notifications.
  - Sheet grab-handle indicator at the top of the detail drawer for spatial familiarity.
- **Optical Typography (§15)**:
  - Native system typography stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text"`).
  - Negative letter-tracking on display headings, positive tracking on micro badges, and `tabular-nums` on monetary figures.
- **Apple Segmented Controls & Appearance Selector (§10, §14)**:
  - Apple-style 3-state segmented theme switcher (Light / Dark / Auto) in the navigation bar.
  - Settings page featuring interactive macOS mini window previews with traffic light controls (close, minimize, zoom dots) and active checkmarks.
- **Accessibility & Adaptive Preferences (§14)**:
  - Full support for `prefers-reduced-motion` (instant fades, disabled springs).
  - Support for `prefers-reduced-transparency` (solid surfaces, disabled blurs).
  - Support for `prefers-contrast` (high-contrast borders).

---

## Status State Machine

| Status | Visual Indicator | Meaning | Next Actions |
|---|---|---|---|
| `NEEDS_REVIEW` | 🟡 Amber Pill | Receipt OCR complete; awaiting human verification | Review in Slide-over Drawer &rarr; Approve |
| `PENDING` | 🔵 Sky Blue Pill | Approved by user; queued for QuickBooks sandbox sync | Automatically picked up by background worker |
| `SYNCING` | 🟣 Indigo Pill | Currently communicating with QuickBooks Online API | Wait for completion response |
| `SYNCED` | 🟢 Mint Green Pill | Successfully posted to QuickBooks Online Sandbox | View QBO ID and verified ledger entry |
| `FAILED` | 🔴 Coral Red Pill | Synchronization failed due to rule or API error | Inspect sync error details |

---

## Quickstart

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Run

```bash
# 1. Clone repository
git clone https://github.com/naman1326/tallyfold.git
cd tallyfold

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
```

### Environment Configuration (`.env`)

```ini
# Live AWS API Gateway mode (Default)
API_BASE_URL=https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/prod
API_KEY=your-dev-api-key
REVIEW_TOKEN=your-secret-review-token

# Or enable built-in offline Demo Mode (No AWS credentials needed)
VITE_DEMO=true
```

### Start Development Server

```bash
npm run dev
# Open http://localhost:5173
```

### Run Tests & Production Build

```bash
# Run unit tests with Vitest
npm test

# Type-check and create production bundle in dist/
npm run build
```

---

## Security Model & Zero-Secret Architecture

1. **Browser Security**: Neither `API_KEY` nor `REVIEW_TOKEN` is bundled into client JavaScript.
2. **Local Development Proxy**: `vite.config.ts` runs a dev-only gateway middleware. The browser issues requests to `/api/*`; the Node.js server injects authorization headers before proxying upstream.
3. **S3 Presigned Signature Binding**: Client PUT operations must match the cryptographic `x-amz-meta-*` headers generated by Lambda, preventing arbitrary file injection or unauthorized bucket writes.
4. **Production Deployment**: Build static files (`npm run build`) and host behind **CloudFront with Origin Access Control (OAC)** and a private S3 bucket. Forward `/api/*` through an API Gateway or Lambda edge layer that handles real user authentication (e.g. AWS Cognito).

---

## Directory Structure

```text
tallyfold/
├── docs/
│   └── architecture.png       # High-resolution 3-tier architecture diagram
├── public/
│   ├── favicon.svg            # Apple squircle vector brand icon
│   └── architecture.png
├── src/
│   ├── api.ts                 # Backend HTTP client & demo data fallbacks
│   ├── App.tsx                # Application shell, routing & views
│   ├── lib.ts                 # Formatting, sorting, CSV export & review rules
│   ├── lib.test.ts            # Unit tests for normalization & validation
│   ├── main.tsx               # React DOM bootstrap
│   ├── styles.css             # Apple Fluid Design System & CSS variables
│   ├── theme.tsx              # Theme provider (Light / Dark / System)
│   └── toast.tsx              # Dynamic Island style notification system
├── index.html                 # App shell with Apple meta tags & fonts
├── package.json               # Dependencies & build scripts
├── SKILL.md                   # Apple Design Guidelines & motion principles
├── tsconfig.json              # TypeScript compiler configuration
└── vite.config.ts             # Vite dev server & secure API proxy gateway
```

---

## License

MIT © [Tallyfold](https://github.com/naman1326/tallyfold)
