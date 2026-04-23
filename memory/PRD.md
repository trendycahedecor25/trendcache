# HEARD - Product Requirements Document

## Problem Statement
Web application named "HEARD" designed to support single and unsupported mothers. Core feature is an advanced, empathetic AI companion named "Willow" that listens first and offers tailored solutions.

## Tech Stack
- Frontend: React.js, Tailwind CSS, Framer Motion, Web Audio API
- Backend: FastAPI (modularized), PyMongo (Motor async), Emergentintegrations
- Auth: Emergent-managed Google Auth (JWT via Cookies + localStorage fallback)
- Payments: Stripe (LIVE key active)
- AI: OpenAI GPT-5.2 (Emergent LLM Key)
- DB: MongoDB

## Backend Architecture
```
backend/
├── server.py          # Entry point (56 lines) - app setup, middleware, router wiring
├── database.py        # MongoDB client + db instance
├── models.py          # All Pydantic models
├── helpers/
│   ├── auth.py        # get_current_user, require_admin
│   ├── subscription.py # subscription helpers, constants
│   └── willow.py      # System prompt, context builder, profile extraction
├── routes/
│   ├── auth.py        # Session exchange, /auth/me, logout
│   ├── chat.py        # Willow conversations + messages
│   ├── journal.py     # Journal CRUD + AI prompts
│   ├── calendar.py    # Calendar CRUD
│   ├── mood.py        # Mood tracking + insights
│   ├── subscription.py # Stripe checkout + webhooks
│   ├── referral.py    # Referral info
│   ├── admin.py       # Admin analytics + set-admin
│   ├── profile.py     # Willow memory editing
│   ├── calm_corner.py # Activities endpoint
│   └── _calm_data.py  # Activities data
```

## What's Been Implemented
- Full-stack app with Google Auth, Dashboard, Mood Tracking, Journal (AI prompts), Calendar
- Willow AI companion with persistent memory, user profile extraction, and full Calm Corner toolkit
- Editable "What Willow Knows About Me" card (ChatGPT-style memory editing)
- Calm Corner: 13 micro-mindfulness activities, interactive ASMR Player (Web Audio API), Coloring Canvas (SVG)
- Stripe subscriptions (LIVE key) with checkout and webhooks
- Referral program, Admin analytics dashboard (aggregation pipelines)
- Static legal pages, Security fixes
- Backend fully modularized from 1,492-line monolith to 16 focused files

## Admin Account
- Email: tucksmom0527@gmail.com (is_admin: true)

## Backlog
### P1
- Community Section for mothers to connect and support each other

### P2
- "Quick Calm" floating button for instant crisis grounding
