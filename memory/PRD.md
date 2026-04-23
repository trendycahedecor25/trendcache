# HEARD - Product Requirements Document

## Problem Statement
Web application named "HEARD" designed to support single and unsupported mothers. Core feature is an advanced, empathetic AI companion named "Willow" that listens first and offers tailored solutions.

## Core Requirements
- Dashboard with mood tracking, journaling (with AI prompts), and calendar
- Proactive AI (Willow) that learns emotional baseline and remembers past context
- Vibrant, warm, and uplifting UI/UX design
- Monetization via Stripe subscriptions ($4.99/mo with 7-day free trial)
- Referral system (Share HEARD, get a free month)
- Admin analytics dashboard
- Legal pages (Privacy Policy, Terms of Service)

## Tech Stack
- Frontend: React.js, Tailwind CSS, Framer Motion
- Backend: FastAPI, PyMongo (Motor async), Emergentintegrations
- Auth: Emergent-managed Google Auth (JWT via Cookies + localStorage fallback)
- Payments: Stripe (LIVE key active)
- AI: OpenAI GPT-5.2 (Emergent LLM Key)
- DB: MongoDB

## What's Been Implemented
- Full-stack app with Google Auth, Dashboard, Mood Tracking, Journal (AI prompts), Calendar
- Willow AI companion with persistent memory system and user profile extraction
- Editable "What Willow Knows About Me" card (ChatGPT-style memory editing)
- Stripe subscriptions (LIVE key active) with checkout and webhooks
- Referral program with batch lookups
- Admin analytics dashboard with MongoDB aggregation pipelines
- Static legal pages (Privacy Policy, Terms of Service)
- Cross-domain auth fix (relative API paths, dual cookie/localStorage)
- Admin access for tucksmom0527@gmail.com
- Security fix: Cryptographically random admin secret
- Performance fix: Aggregation pipelines for admin analytics
- Willow personality overhaul with user-defined tone rules
- Persistent user profile system with auto-extraction after each conversation
- Enhanced context: mood shift detection, journal content, calendar events, day/time awareness

## Key Components
- `/app/frontend/src/components/WillowMemory.js` — Editable dashboard card showing Willow's memory
- `/app/frontend/src/components/Dashboard.js` — Main dashboard
- `/app/frontend/src/components/WillowChat.js` — Chat with Willow
- `/app/backend/server.py` — All backend routes, AI, Stripe, auth

## Key API Endpoints
- `GET /api/profile/willow-memory` — Get what Willow knows
- `PUT /api/profile/willow-memory` — Edit memory fields
- `DELETE /api/profile/willow-memory` — Clear memory fields or entire memory

## Key DB Collections
- users, user_profiles, conversations, journal_entries, calendar_events, mood_entries, referrals, payment_transactions, user_sessions

## Admin Account
- Email: tucksmom0527@gmail.com (is_admin: true)

## Backlog
### P1
- Community Section for mothers to connect and support each other

### P2
- Dedicated Meditation/Video Guides Module
- Backend modularization (server.py ~1230 lines)
