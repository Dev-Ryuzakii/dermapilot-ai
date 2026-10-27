# DermaPilot AI, BASE1.md

## Product
Inclusive skincare intelligence and shopping companion. Cosmetic guidance only, never diagnosis.

## Stack and infrastructure
- Next.js 15 App Router, TypeScript, Tailwind CSS 4.
- Afribase Auth/PostgREST using the public anon key and the signed-in user's access token so RLS applies.
- Scan selfies are sent to YouCam after consent; this app saves results in Afribase but does not store the selfie in Afribase Storage.
- Preview: https://7ixdzqvemkqu--preview.afribase.dev

## Design direction
Premium, calm skincare studio: warm off-white surfaces, deep botanical green, DM Sans and Manrope, rounded outlined cards, responsive layouts. DermaPilot leaf-mark logo lives in `components/brand.tsx`.

## Data model
Afribase migrations provision profiles, assessments/metrics, product catalog and ingredients, recommendations, routines/steps, scan consent, files, and API usage with RLS. Product sample records are labeled. Do not change schema except via migrations.

## Routes and experiences
- `/`: product landing page with attached spa/scan image.
- `/login`: split-screen branded auth form with outlined panel; signup/login/password recovery.
- `/dashboard`: overview, scan, results, advisor, products, routines, history, settings/profile, onboarding, privacy, guidance, protected admin.
- Auth routes under `/api/auth`; profile, scan, products, recommend, routines, history, and admin API routes under `/api`.

## Auth and personalisation
Email auto-confirm is enabled for this preview project. Profile/settings allow display name, skin type, goals, budget, and currency. Consent required for selfie processing. Auth cookies are HttpOnly.

## AI integration status
The server-side YouCam adapter uses the documented File API and v2.0 skin-analysis task flow. A complete live scan still requires an enabled YouCam plan and a consenting signed-in user. Recommendation explanations use deterministic catalog and preference logic; no LLM is configured.

## Run and verify
`npm run dev`, `npm run typecheck`, `npm test`, `npm run build`. Current check result: typecheck and recommendation tests pass; production build completes with an ESLint compatibility warning. Do not claim successful YouCam or live production deployment until verified.
