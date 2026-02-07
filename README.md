# Family Log Front End

A cozy, journal-inspired React web app for logging baby events.

## Getting Started

```bash
npm install
npm run dev
```

## Environment

Set the API base URL to connect the baby log service.

```bash
VITE_BABY_LOG_API_URL="https://baby-log-server-prod.onrender.com/v1/babies"
```

If the env var is not set, the UI uses local mock entries.

## Deploy To Cloudflare Pages

This app is a Vite static frontend, so Cloudflare Pages is a good fit.

### Option 1: Deploy from GitHub (recommended)

1. Push this repo to GitHub.
2. In Cloudflare, go to `Workers & Pages` -> `Create` -> `Pages` -> `Connect to Git`.
3. Select this repository.
4. Use these build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/` (leave default unless your app is in a subfolder)
5. Add production environment variable:
   - `VITE_BABY_LOG_API_URL=https://baby-log-server-prod.onrender.com/v1/babies`
6. Deploy.

### Option 2: Deploy with Wrangler CLI

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name baby-log-fe
```

If prompted, log in to Cloudflare and create/select the Pages project.

### After Deploy

1. Confirm your backend CORS allows the Cloudflare Pages domain.
2. In Cloudflare Pages settings, make sure `VITE_BABY_LOG_API_URL` is set for Production (and Preview if needed).
3. Trigger a redeploy after changing env vars.
