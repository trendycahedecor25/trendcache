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
│   └── willow.py      # System prompt, context builder (refactored into small helpers)
├── routes/
│   ├── auth.py        # Auth (refactored: _create_new_user, _process_referral, _create_session)
│   ├── chat.py        # Willow conversations
│   ├── journal.py     # Journal CRUD + AI prompts
│   ├── calendar.py    # Calendar CRUD
│   ├── mood.py        # Mood tracking + insights
│   ├── subscription.py # Stripe checkout + webhooks
│   ├── referral.py    # Referral info
│   ├── admin.py       # Admin analytics (refactored into helper functions)
│   ├── profile.py     # Willow memory editing
│   ├── calm_corner.py # Activities endpoint
│   └── _calm_data.py  # Activities data
```

## What's Been Implemented
- Full-stack app with Google Auth, Dashboard, Mood Tracking, Journal (AI prompts), Calendar
- Willow AI companion with persistent memory, profile extraction, Calm Corner toolkit
- Editable "What Willow Knows About Me" card (ChatGPT-style memory editing)
- Calm Corner: 13 micro-mindfulness activities, ASMR Player (Web Audio API), Coloring Canvas (9 custom pages, 18 custom colors)
- Stripe subscriptions (LIVE key) with checkout and webhooks
- Referral program, Admin analytics dashboard (aggregation pipelines)
- Legal pages, Security fixes (cryptographic admin secret, sessionStorage for tokens)
- Code review fixes applied: hook deps, complexity refactoring, array keys, useMemo context

## Admin
- Email: tucksmom0527@gmail.com (is_admin: true on both preview and production)
- Production URL: https://willowhears.me

## Backlog
### P1
- Community Section for mothers to connect and support each other

### P2
- "Quick Calm" floating button for instant crisis grounding
