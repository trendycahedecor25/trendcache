# HEARD - Product Requirements Document

## Problem Statement
Web application named "HEARD" designed to support single and unsupported mothers. Core feature is an advanced, empathetic AI companion named "Willow" that listens first and offers tailored solutions.

## Tech Stack
- Frontend: React.js, Tailwind CSS, Framer Motion, Web Audio API
- Backend: FastAPI (modularized), PyMongo (Motor async), Emergentintegrations
- Auth: Emergent-managed Google Auth (JWT via Cookies + sessionStorage fallback)
- Payments: Stripe (LIVE key — willowonthewind26@gmail.com account)
- AI: OpenAI GPT-5.2 (Emergent LLM Key)
- DB: MongoDB

## Backend Architecture
```
backend/
├── server.py          # Entry point (~56 lines)
├── database.py        # MongoDB client
├── models.py          # Pydantic models
├── helpers/
│   ├── auth.py        # get_current_user, require_admin
│   ├── subscription.py # subscription helpers
│   └── willow.py      # System prompt, context builder
├── routes/
│   ├── auth.py, chat.py, journal.py, calendar.py, mood.py
│   ├── subscription.py, referral.py, admin.py, profile.py
│   ├── calm_corner.py, _calm_data.py
```

## What's Been Implemented
- Full-stack app with Google Auth, Dashboard, Mood Tracking, Journal (AI prompts), Calendar
- Willow AI companion with persistent memory, profile extraction, Calm Corner toolkit
- Editable "What Willow Knows About Me" card (ChatGPT-style memory editing)
- Calm Corner: 13 micro-mindfulness activities
- Nature Sounds player: 5 real creek recordings from user's personal videos
- Coloring Canvas: 9 custom pages, 18 custom colors, full-screen on mobile, recoloring + eraser
- Stripe subscriptions (LIVE key) with checkout and webhooks
- Referral program, Admin analytics dashboard (aggregation pipelines)
- Legal pages, Security fixes (cryptographic admin secret, sessionStorage for tokens)
- Mobile fixes: scrollable bottom nav (accounts for Emergent badge), full-screen coloring canvas
- Two rounds of code review fixes applied (hooks, array keys, error handlers, complexity)

## Admin
- Email: tucksmom0527@gmail.com (is_admin: true on both preview and production)
- Production URL: https://willowhears.me

## Code Review Fixes Applied (Latest)
- Fixed React hook dependency ordering (sendMessage useCallback defined before useEffect that references it)
- Replaced all index-as-key with stable keys (WillowChat, WillowMemory, ReferralSection, PricingPage, AdminDashboard, CalmCorner)
- Added error logging to all empty catch blocks (AuthContext, ReferralSection)
- Added useCallback import to WillowChat
- Python `is None` checks confirmed correct per PEP 8 (singleton comparison)

## Backlog
### P1
- Community Section for mothers to connect and support each other

### P2
- "Quick Calm" floating button for instant crisis grounding
- Dedicated Meditation/Video Guides Module
