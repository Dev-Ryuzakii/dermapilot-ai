# DermaPilot AI

DermaPilot AI turns a YouCam skin scan into visual cosmetic insights and practical skincare guidance. Users can take or upload a photo, review available spotted-area overlays on their image, revisit saved scans, set skincare preferences, browse matching catalog products, and ask an AI skincare guide questions about their results.

The app is a Next.js 15 and React 19 prototype built with TypeScript, Tailwind CSS, MediaPipe, the YouCam Skin Analysis API, Afribase Auth/Database/Storage, and the OpenAI Responses API. Scan results are cosmetic observations, not medical diagnoses.

## Run locally

1. Install Node.js 20 or newer and run `npm install`.
2. Create `.env.local` with the environment variables below. Keep this file private; it is ignored by Git.
3. Configure an Afribase project with the app's tables and a private `scan-snapshots` Storage bucket. See [the storage setup notes](docs/afribase-storage-setup.md).
4. Run `npm run dev` and open `http://localhost:3000`.

```dotenv
AFRIBASE_URL=https://YOUR-PROJECT.afribase.dev
AFRIBASE_ANON_KEY=YOUR_AFRIBASE_ANON_KEY
NEXT_PUBLIC_AFRIBASE_URL=https://YOUR-PROJECT.afribase.dev
NEXT_PUBLIC_AFRIBASE_ANON_KEY=YOUR_AFRIBASE_ANON_KEY
YOUCAM_API_KEY=YOUR_YOUCAM_API_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

`OPENAI_API_KEY` is needed for the optional AI adviser chat. The default chat model is `gpt-4.1-mini`; set `OPENAI_CHAT_MODEL` to override it. Set `YOUCAM_API_BASE_URL` only if your YouCam account uses a different API endpoint. Never commit real keys to the repository.

## What the app does

- Uses a MediaPipe face guide and automatic crop to help users capture a suitable scan image.
- Sends the image to YouCam Skin Analysis and displays returned scores and available visual masks without inventing missing metrics.
- Saves scan records and available photo snapshots privately in Afribase, with authenticated owner-only Storage access.
- Uses saved goals, preferences, currency, and budget to filter catalog products and suggest a simple routine.
- Offers an opt-in OpenAI chat that receives scan scores and preferences, but not the selfie.

## Checks

Run `npm run typecheck` and `npm test` before submitting changes.

## Privacy

The scan page asks for consent before sending an image to YouCam and saving available snapshots. The AI chat asks for separate consent before sending scan scores and preferences to OpenAI. Review [the privacy page](app/dashboard/privacy/page.tsx) and [storage setup notes](docs/afribase-storage-setup.md) before deploying to a new project.
