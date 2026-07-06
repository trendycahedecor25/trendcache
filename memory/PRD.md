# HEARD - Product Requirements Document

## Problem Statement
Web application named "HEARD" designed to support single and unsupported mothers. Core feature is an advanced, empathetic AI companion named "Willow" that listens first and offers tailored solutions.

## Tech Stack
- Frontend: React.js, Tailwind CSS, Framer Motion
- Backend: FastAPI (modularized), PyMongo (Motor async), Emergentintegrations
- Auth: Emergent-managed Google Auth (JWT via Cookies + sessionStorage fallback)
- Payments: Stripe (LIVE key — willowonthewind26@gmail.com account)
- AI: OpenAI GPT-5.2 (Emergent LLM Key)
- DB: MongoDB

## Architecture
```
backend/
├── server.py, database.py, models.py
├── helpers/ (auth.py, subscription.py, willow.py)
├── routes/ (auth, chat, journal, calendar, mood, subscription, referral, admin, profile, calm_corner, _calm_data)
frontend/src/
├── components/
│   ├── ActivityDetail.js      # Extracted from CalmCorner
│   ├── BoxBreathingGuide.js   # Extracted from CalmCorner
│   ├── CalmCorner.js          # Now imports above two
│   ├── ColoringCanvas.js      # Uses utils/floodFill.js
│   ├── ASMRPlayer.js          # Nature sounds (real creek audio)
│   └── ... (Dashboard, WillowChat, WillowMemory, etc.)
├── utils/
│   └── floodFill.js           # Extracted from ColoringCanvas
├── contexts/AuthContext.js
└── config/api.js
```

## What's Been Implemented
- Full-stack app with Google Auth, Dashboard, Mood Tracking, Journal (AI prompts), Calendar
- Willow AI companion with persistent memory, profile extraction
- Editable "What Willow Knows About Me" card
- Calm Corner: 13 activities, Nature Sounds (5 real creek recordings), Coloring Canvas (9 pages, 18 colors, full-screen, eraser)
- Stripe subscriptions (LIVE), Referral program, Admin dashboard
- Two rounds of code review fixes applied

## Code Review Fixes (Round 2 - Latest)
- **Security**: Replaced `random.choices` with `secrets.choice` in referral code generation
- **Complexity**: Extracted `BoxBreathingGuide` and `ActivityDetail` from CalmCorner (329→160 lines), extracted `floodFill` into `utils/floodFill.js`
- **Hook deps**: Wrapped CalendarView `loadEvents` in `useCallback`, removed eslint-disable comment
- **Nested ternaries**: Extracted `EditSection` helper in WillowMemory, `getTrendStyle` in Dashboard
- **Lint fix**: Renamed `children` prop to `kidsList` in ChildrenEditor (React reserved prop)
- **Python `is None`**: Confirmed correct per PEP 8 (singleton identity check)
- **SessionStorage**: Designed architecture (cookies primary, sessionStorage fallback) — no change needed
- **Test hardcoded secret**: Token is generated dynamically via `secrets.token_urlsafe()` at runtime — not a real hardcoded secret

## Admin
- Email: tucksmom0527@gmail.com (is_admin: true)
- Production URL: https://willowhears.me

## Backlog
### P1
- Community Section for mothers to connect and support each other

### P2
- "Quick Calm" floating button for instant crisis grounding
- Dedicated Meditation/Video Guides Module
