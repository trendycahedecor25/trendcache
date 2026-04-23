# HEARD - Product Requirements Document

## Problem Statement
Web application named "HEARD" designed to support single and unsupported mothers. Core feature is an advanced, empathetic AI companion named "Willow" that listens first and offers tailored solutions.

## Core Requirements
- Dashboard with mood tracking, journaling (with AI prompts), and calendar
- Proactive AI (Willow) that learns emotional baseline and remembers past context
- Calm Corner with micro-mindfulness activities for quick anxiety relief
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
- Calm Corner with 13 micro-mindfulness activities across 5 categories (grounding, breathing, physical, creative, sensory)
- Box Breathing guided visual exercise
- Willow's system prompt includes full Calm Corner toolkit for contextual suggestions
- Stripe subscriptions (LIVE key active) with checkout and webhooks
- Referral program with batch lookups
- Admin analytics dashboard with MongoDB aggregation pipelines
- Static legal pages (Privacy Policy, Terms of Service)
- Security: Cryptographically random admin secret
- Performance: Aggregation pipelines for admin analytics

## Key Pages & Components
- `/dashboard` — Dashboard.js (mood, journal, calendar, Willow memory card)
- `/chat` — WillowChat.js (Willow AI conversation)
- `/calm-corner` — CalmCorner.js (micro-mindfulness activities)
- `/journal` — Journal.js
- `/calendar` — CalendarView.js
- `/pricing` — PricingPage.js
- `/admin` — AdminDashboard.js

## Key API Endpoints
- `GET /api/calm-corner/activities` — All 13 activities and 5 categories
- `GET /api/profile/willow-memory` — Get what Willow knows
- `PUT /api/profile/willow-memory` — Edit memory fields
- `DELETE /api/profile/willow-memory` — Clear memory fields

## Admin Account
- Email: tucksmom0527@gmail.com (is_admin: true)

## Backlog
### P1
- Community Section for mothers to connect and support each other

### P2
- Interactive ASMR audio playback in Calm Corner
- Interactive coloring canvas in Calm Corner
- Backend modularization (server.py ~1450 lines)
