# Tallyfold — receipts, reconciled
React + Vite + TypeScript frontend for the existing AWS receipt pipeline (S3, Lambda + Tesseract OCR, DynamoDB, QuickBooks Sandbox). It does not rebuild or modify the backend, and it does not run OCR in the browser.

## Run
```bash
npm install
cp .env.example .env     # fill API_KEY and REVIEW_TOKEN (server-side only)
npm run dev              # http://localhost:5173
npm test && npm run build
```
Demo mode (no backend calls, sample data with a visible banner): set `VITE_DEMO=true` in `.env`.

## How secrets are handled
`vite.config.ts` contains a dev-only gateway. The browser calls `/api/*`; the gateway adds `x-api-key` and, for `POST /review`, the `reviewToken`. Neither value is ever in browser code. **This gateway does not exist in a production build** (`dist/` is static files), so deployment needs the following.

## Backend contracts relied on
- `POST /upload` body `{userId, contentType, currency, paymentAccountId, paymentType}` returns `{uploadUrl, receiptId, contentType, requiredMetadataHeaders}`. The S3 PUT must send `Content-Type` plus every `x-amz-meta-*` header returned, or S3 rejects the signature. The bucket CORS must allow PUT with those headers.
- `GET /expenses?userId=` returns `{items:[...]}`. DynamoDB decimals arrive as strings and are normalized in `src/lib.ts`.
- `POST /review` body `{userId, sk, merchant, receiptDate, total, category, currency, paymentAccountId, paymentType, reviewToken}`. Values must equal the stored record. Rules: status NEEDS_REVIEW, confidence >= 0.75, USD, account `35`, an approved category, `paymentType` Cash or Check. The UI mirrors these rules, but the Lambda is the authority.

## Limitations and missing backend capabilities
- No real authentication: `userId` is a browser-supplied value, not identity. Add Cognito or another authorizer before any real use.
- Receipt images cannot be shown: the bucket is private. Add an authorized endpoint that returns a short-lived presigned GET URL.
- No edit, reject, or retry-failed-sync endpoints. The UI shows read-only fields and a disabled Reject button.
- `list-expenses` returns at most 100 items with no pagination token, so the CSV export covers loaded rows only.
- `get-upload-url` always stores `receipt-verified=false`, so every receipt lands in NEEDS_REVIEW by design.
- Features built: full dark mode theme system (Light / Dark / System), sortable columns, responsive slide-over drawer, toast feedback notifications, quick filter chips, and enriched demo datasets.
- Remaining roadmap: currency and date-range preferences, backend reject and retry endpoints, presigned receipt image GET endpoint.

## Deploy (AWS, cost-conscious)
Build with `npm run build`, then host `dist/` in a **private** S3 bucket behind CloudFront (Origin Access Control, HTTPS). Route `/api/*` through CloudFront to a small Lambda or API Gateway layer that injects the API key and review token and enforces real user login. Do not make the bucket public and do not put the API key in any `VITE_` variable. An S3 website endpoint alone has no HTTPS and no access control.
