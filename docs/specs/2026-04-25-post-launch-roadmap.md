# Post-Launch Roadmap — Closing the ServiceM8 Gap

**Status:** Approved 2026-04-25 (verbal), ready to execute
**Goal:** Make SOLVR a no-brainer switch for ServiceM8 users.
**Cadence:** 4 sprints × ~3 weeks = ~13 weeks of focused work.

This document is the source of truth for what to build next. Each sprint is independent enough to ship without the next, so we can re-prioritise between sprints if customer feedback shifts.

---

## Strategic frame

A ServiceM8 user has 1–5 years of customer history, photos, and recurring schedules locked in. They only switch when **cost of staying ≥ cost of switching**. Three bars to clear:

1. **Parity on essentials** — anything ServiceM8 does daily that we can't kills the demo.
2. **Migration path** — one-button import, side-by-side period.
3. **A wedge** — one or two things we do *better* (AI receptionist + voice-to-quote already; sharpen them).

---

## Sprint 1 — Close demo-killers (weeks 1–3)

| # | Feature | Why | Est |
|---|---|---|---|
| 1.1 | **Stripe Connect Express + Pay Now on invoices** | Customer pays from invoice email in 30s, money lands in tradie's bank. Without it, "pay by card" = friction = bad debt. | 1 wk |
| 1.2 | **Two-way SMS conversation threading** | Customer reply to a quote SMS today lands in nowhere. Conversation per customer. | 1.5 wks |
| 1.3 | **Map view of today's jobs (with route order)** | Tradie wakes up, opens app, sees today's 4 jobs on a map. Today the calendar is a list. | 1 wk |

**Sprint 1 outcome:** A demo where the tradie creates a job → quotes → wins → invoices → customer pays via card link, all in under 5 minutes. Plus a tradie can wake up and see their day on a map.

---

## Sprint 2 — Wow factor + conversion lift (weeks 4–6)

| # | Feature | Why | Est |
|---|---|---|---|
| 2.1 | **"On the way" SMS with live ETA** | THE thing customers tell their friends about ServiceM8. Geofence on existing staff GPS check-in fires SMS within 10 km of site, with a tracking link. | 1 wk |
| 2.2 | **Quote follow-up automation** | "Still interested in the bathroom quote?" auto-SMS at 3, 7, 14 days if quote stays in `sent`. Cron + existing SMS path. Conversion lift, no new infra. | 4 days |
| 2.3 | **Migration tooling — ServiceM8 CSV import** | Customers + jobs (history). One-button paste of ServiceM8 export → SOLVR records. Removes the lock-in objection. | 1 wk |

---

## Sprint 3 — Close the money loop (weeks 7–10)

| # | Feature | Why | Est |
|---|---|---|---|
| 3.1 | **Real Xero integration v1 (per existing scoping doc)** | OAuth + push invoices on creation. Spec at `docs/specs/2026-04-25-xero-integration-design.md`. | 2 wks |
| 3.2 | **Stripe Connect tightening** | Refunds, partial payments, dispute notifications surfaced in SOLVR, application fee tuning. Builds on Sprint 1. | 1 wk |

---

## Sprint 4 — Recurring revenue + AI wedge (weeks 11–13)

| # | Feature | Why | Est |
|---|---|---|---|
| 4.1 | **Asset / equipment register per customer** | Plumbers track HWS, electricians track switchboards. Foundation for #4.2. | 1 wk |
| 4.2 | **Maintenance schedule with auto-create** | Annual service reminders → auto-create job N days before due. Auto-SMS customer "your service is due, want to book?". This is the recurring-revenue lever. | 1 wk |
| 4.3 | **Voice agent books jobs in real-time** | Today the AI receptionist transcribes calls. Make it transactional — checks the calendar live, offers slots, books the job, fires the confirmation SMS, all on the call. **ServiceM8 cannot do this.** | 1.5 wks |

---

## Backlog (post-Sprint-4, prioritise based on demand)

- **#7 Asset register depth** — photos, install dates, model/serial.
- **Smart scheduling** — drag job onto calendar, AI suggests slot based on travel + skills.
- **AI insights synthesis** — "you converted 67% of hot water jobs last month".
- **Compliance autopilot** — auto-attach right SWMS, expiring-cert alerts.
- **Stock/inventory** — only if customer demand surfaces; heavy lift.
- **Customer self-booking widget** — embeddable iframe.
- **Job-completion customer signature** — 3-day add, dispute reduction.

---

## Explicit non-goals (don't chase even if asked)

- Multi-team / multi-location (target = solo + small team).
- Customer self-service portal (ServiceM8 has it, nobody uses it).
- Subcontractor full-invoicing-back-to-tradie (basic subbie support only).
- Native Android tablet experience (mobile-first phone is the target).

---

## Success criteria for the roadmap

By end of Sprint 4, a tradie demo should answer "yes" to all of these:
1. Can the customer pay the invoice with a card from the email? (1.1)
2. Can I see customer SMS replies in-app? (1.2)
3. Can I see today's jobs on a map? (1.3)
4. Does the customer get an "on the way" SMS automatically? (2.1)
5. Do I auto-chase quotes that go quiet? (2.2)
6. Can I import my ServiceM8 customers in 5 minutes? (2.3)
7. Do invoices sync to Xero automatically? (3.1)
8. Can the AI receptionist actually *book* a job during a call? (4.3)
9. Will the system remind me + the customer about annual servicing? (4.2)

If yes to ≥ 7 of 9, the demo wins against ServiceM8.
