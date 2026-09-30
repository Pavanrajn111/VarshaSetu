# Varsha Setu — Frontend Application

Production frontend application built with TanStack Start, React 19, TypeScript, and Tailwind CSS for the Varsha Setu Hyperlocal Monsoon AI platform.

---

## Deployment on Vercel

> [!IMPORTANT]
> **Vercel Project Settings**: The **Root Directory** must be set to `frontend`.
> Do not leave it at the repository root.

- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `vite build` (or automatic via `vercel.json`)
- **Output Directory**: Automatically configured by `@lovable.dev/vite-tanstack-config` with `NITRO_PRESET: "vercel"` to `.vercel/output`.
- **Environment Variables**:
  - `VITE_API_BASE_URL`: URL of your deployed backend service (e.g. `https://varsha-setu-backend.onrender.com`).

---

## Local Development

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The dev server will start at `http://localhost:8080`.

## Scripts

- `npm run dev`: Launch the local development server.
- `npm run build`: Build the production server and client bundle.
- `npm run preview`: Preview the production build locally.
- `npm run lint`: Run ESLint checks.
- `npm run format`: Format code using Prettier.
