# SwingPulse — Agent-Pipeline Swing Trading Company
## Master Development Plan (Team Lead Directive)

**Objective:** Build an industry-grade, agent-driven swing trading desk with a web dashboard. Phase 1 = design + paper trading only. No live capital until Phase 4 sign-off.

---

## Build Order & Status (P1–P4 Complete → P5 Pending)

| Phase | Focus | Status | Deliverable | Gate Criteria |
|-------|-------|--------|-------------|---------------|
| **P1** | Design & Architecture | ✅ Done | DESIGN_SPEC.md + dashboard.html prototype | Design sign-off + anti-slop audit 0/10 |
| **P2** | Backend Infrastructure | ✅ Done | FastAPI + SQLAlchemy + Postgres/Timescale + Docker Compose | API health check + DB schema |
| **P3** | Agent Pipeline | ✅ Done | 5 agents + pipeline orchestrator + seed data + pipeline test | End-to-end pipeline tested; guardrails verified |
| **P4** | Frontend Dashboard | ✅ Built | Next.js dashboard (not yet connected to live API) | UI built; API connection ready |
| **P5** | Validation & Handoff | ⏳ Pending | Performance report, risk limits tuned, deploy docs | Positive expectancy in paper; ready for live review |

**Rule:** No agent writes to a broker with real money until P5 is complete and reviewed.

---

## Tech Stack (Locked)

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL + TimescaleDB
- **Agents:** Plain Python classes (no heavy frameworks yet), event-driven via DB/WebSocket
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Infra:** Docker Compose (Postgres, Timescale, API, Redis for agent queue), Nginx reverse proxy
- **Data:** Polygon.io / Yahoo Finance (paper), Alpaca Paper API (execution stub)
- **Deploy:** Docker, systemd or Docker Compose on VPS

---

## Agent Pipeline Contract

1. **Market Scanner** — Universe filter, regime detection (bull/bear/chop)
2. **Signal Generator** — Swing setups (pullback to EMA, breakout, trend continuation)
3. **Risk Manager** — Position sizing, correlation, daily loss limit, kill-switch gate
4. **Execution Agent** — Paper broker simulation → later Alpaca live stub
5. **Ops & Reporting** — P&L, equity curve, journal, dashboard feed

---

## Immediate Next Steps

1. Load `claude-design` skill → produce dashboard design spec
2. Scaffold repo (`PROJECT_PLAN.md`, `docker-compose.yml`, folder structure)
3. Load `claude-code` skill → generate backend + agent code per phase
4. Iterate through P1–P5 with user checkpoints at each gate

---

## Risk Guardrails (Non-Negotiable)

- Paper trading only until P5 sign-off
- Max 0.5% risk per trade, max 8 positions, daily -2% kill-switch
- All agent decisions logged to `agent_events` table for audit
- Kill-switch button in dashboard halts all new entries instantly
