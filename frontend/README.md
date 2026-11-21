# SwingPulse Frontend

Next.js 14 dashboard (App Router) for the agent-pipeline swing trading desk.

## Structure

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Main dashboard — metrics, watchlist, positions, pipeline, risk, agent log |
| `app/layout.tsx` | Root layout with Inter font |
| `app/globals.css` | Tailwind + SwingPulse design tokens (dark trading terminal theme) |
| `components/ui.tsx` | Shared UI primitives: Card, Metric, StatusDot, Badge, Button |
| `lib/api.ts` | API fetch wrapper + WebSocket event socket |

## Design System

- **Surface:** Monitor (density, glanceability, no hero)
- **Theme:** Dark trading terminal — oklch palette, teal/amber accents, mono for numbers
- **Components:** shadcn-style primitives, no external UI library dependency

## Connect

Set `NEXT_PUBLIC_API_URL` to point at the FastAPI backend (default: `http://localhost:8000`).

## Run

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:3000
```
