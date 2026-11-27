# Dayfolio

Guest-first answers for everyday household questions. This copy includes paycheck and housing cash flow.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Calculations run through `/api/v1/evaluations`. Household facts change only when someone chooses **Remember this pay** or **Update household pay**.

If `DATABASE_URL` is unset, facts and saved comparisons stay in memory for this server process. With `DATABASE_URL` set, the same repository uses Postgres. The schema is in `drizzle/0000_household.sql`.

```bash
npm test
npm run lint
```

## What is included

- **What does my paycheck add up to?** Take-home pay in, a typical pay month next to the monthly average, and the difference between 26 and 24 paychecks.
- **How would these housing payments fit our budget?** Two named options, monthly cash left, and upfront cash. Changing one option does not change household pay.

Kid pickup is not part of this product. Lease, purchase, finance, and the birth-certificate guide are separate tools.

## Register another tool

Add a module under `src/modules/<tool-id>/` and register it in `src/registry/index.ts`. If it has a screen, add that screen in `src/registry/forms.tsx`. Do not edit `src/modules/paycheck` or `src/modules/housing`.

A tool declares its question, the educate / sandbox / compare targets, Zod input schema, and a pure `evaluate` function. Domain calculators in `src/domain` do not import React, Next.js, or the network. Time and saved facts stay in `src/server`.
