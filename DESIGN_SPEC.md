# SwingPulse — Design Specification
## Surface: Monitor (Dashboard)

**Primary surface archetype:** Monitor — the user is watching state change (P&L, agent pipeline, open positions, risk limits). Density, glanceable hierarchy, no marketing framing, no centered hero.

**Secondary surfaces:** Operate (positions table, signal queue actions), Configure (risk limits, agent thresholds).

---

## Design System Tokens

### Color (OKLCH)
- **Background:** oklch(0.18 0 0) / `#1a1a1a`
- **Surface:** oklch(0.235 0 0) / `#2a2a2a`
- **Surface Elevated:** oklch(0.28 0 0) / `#333333`
- **Border:** oklch(0.32 0 0) / `#444444`
- **Ink (primary text):** oklch(0.95 0 0) / `#f2f2f2`
- **Muted text:** oklch(0.6 0 0) / `#999999`
- **Accent (primary action / long bias):** oklch(0.65 0.15 160) / teal-emerald `#14b8a6`
- **Accent Inverse (short bias):** oklch(0.65 0.18 25) / `#f59e0b` amber
- **Danger (kill-switch / loss):** oklch(0.6 0.2 25) / `#ef4444`
- **Success (win / approved):** oklch(0.7 0.15 150) / `#22c55e`
- **Warning (pending / review):** oklch(0.75 0.15 60) / `#eab308`

### Typography
- **Headings:** system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto — semibold, tight tracking
- **Body:** system-ui, 13px, leading-5
- **Numbers / Prices:** "JetBrains Mono", "Fira Code", ui-monospace, 12px, tabular-nums
- **Small labels:** 11px, uppercase, tracking-wider, muted text

### Spacing
- Grid unit: 4px
- Card padding: 16px
- Gap between widgets: 12px
- Section gap: 24px

### Radius & Shadows
- Radius: 6px (small, tight — trading terminals are utilitarian)
- Shadow: none on dark surfaces; use 1px border on surface elevation instead

### Motion Posture
- Subtle transitions (150ms ease-out) for state changes (agent dot green→red)
- No loops, no decorative animation
- `prefers-reduced-motion` respected

---

## Component Inventory

| Component | Purpose | Surface |
|-----------|---------|---------|
| StatusDot | Agent online/offline/error | Monitor |
| MetricCard | Big number + sparkline + delta | Monitor |
| PositionsTable | Open swings with unrealized P&L, stop, target | Operate |
| SignalQueue | Kanban-style pipeline A1→A2→A3→A4→A5 | Operate/Monitor |
| RiskHeatmap | Correlation matrix, sector exposure bars | Monitor |
| KillSwitch | Prominent danger button, halts all new entries | Operate |
| AgentLog | Scrollable JSON trace of agent decisions | Monitor |
| EmptyState | No positions / no signals today | Monitor |

---

## Layout Composition (1920×1080 reference)

```
┌─────────────────────────────────────────────────────────────┐
│ [SwingPulse]  ● All agents online   [Kill Switch ⚠]        │
├──────────┬──────────────────────────┬───────────────────────┤
│          │                          │                       │
│  Watch-  │   Equity Curve (big)     │   Risk Heatmap        │
│  list    │   Today P&L  Win Rate    │   Sector Exposure     │
│          │   Open Positions count   │   Daily Loss Left     │
│          │                          │                       │
├──────────┼──────────────────────────┼───────────────────────┤
│          │   Open Positions Table   │   Signal Pipeline     │
│          │   (symbol, side, entry,  │   (Scanner→Signal→    │
│          │    stop, target, P&L)    │    Risk→Exec→Ops)     │
│          │                          │                       │
└──────────┴──────────────────────────┴───────────────────────┘
```

---

## Anti-Slop Self-Audit

Scored against the 10 tells from `claude-design`:

1. Tech gradient — **0** (flat dark, no gradients)
2. Generic tech hue — **0** (teal/amber chosen deliberately for trading)
3. Feature-tile grid — **0** (metric cards are data-dense, not equal-weight feature tiles)
4. Accent rail — **0** (no decorative left strips)
5. Unearned blur — **0** (no glassmorphism)
6. Monument stat — **0** (numbers sized for reading, not filling space)
7. Icon topper — **0** (no icon-above-heading pattern)
8. Center stack — **0** (left-aligned, grid-based composition)
9. Default type — **0** (system-ui + mono for numbers, deliberate)
10. Wrong surface — **0** (Monitor surface committed; no hero)

**Slop score: 0/10.** Proceed to build.

---

## Next Action

Build `dashboard.html` as a self-contained prototype with all five views, then move to Phase 2 (backend infrastructure via `claude-code`).
