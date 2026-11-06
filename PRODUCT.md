# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
User-authorized Next.js, TypeScript, Tailwind CSS, Supabase PostgreSQL. Hosting undecided; prepare Vercel instructions.
## Users
Thai-speaking iPhone users tracking daily parking; desktop access supported.
## Product Purpose
Start or stop parking in a browser or through Siri via Apple Shortcuts. Show elapsed time, free allowance, cost, and historical statistics.
## Operating Context
Safari, installable PWA, Asia/Bangkok. Server timestamps, shared persistent database, no background timer required.
## Capabilities and Constraints
Hourly steps for new sessions: elapsed <120 minutes costs 0 THB; at 120 costs 20 THB; at 180 costs 40 THB; another 20 THB every completed 60-minute boundary thereafter. Saved billing_model preserves legacy minute pricing for existing sessions. History editing and deletion, statistics, revocable hashed scoped API tokens, idempotent transactional start/stop, single-owner access without login, offline honesty. No payment, GPS, ads.
## Brand Commitments
Parking Timer. Thai concise copy. User-requested flat layout: prefer whitespace, type hierarchy and dividing rules over colored message boxes; remove redundant explanatory copy. IBM Plex Sans and Thai companion. Lucide icons. No gradients or emoji. Supplied Scam Detection Figma reference guides the interface; do not claim it is copied if inaccessible.
## Evidence on Hand
Complete user requirements. No live credentials or real parking data supplied. No invented records in live views.
## Product Principles
One clear action. Never lose the original start. Never confirm a write until server success. One shared owner dataset; no account system. Browser access is not restricted by user identity. Scoped Siri tokens remain.
## Accessibility & Inclusion
Light/dark, screen readers, reduced motion, keyboard focus, large mobile targets.

## Single-owner revision
No signup, login, logout, password reset, auth cookies or Supabase Auth account required. A database singleton supplies the owner ID. Existing single-owner records/tokens are preserved by migration; mixed-owner data must not be silently merged. Anyone with access to the web URL uses the same dataset.
