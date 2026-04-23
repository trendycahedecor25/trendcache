# HEARD - Product Requirements Document

## Problem Statement
Web application named "HEARD" designed to support single and unsupported mothers. Core feature is an advanced, empathetic AI companion named "Willow" that listens first and offers tailored solutions.

## Core Requirements
- Dashboard with mood tracking, journaling (with AI prompts), and calendar
- Proactive AI (Willow) that learns emotional baseline and remembers past context
- Calm Corner with micro-mindfulness activities + interactive ASMR player + coloring canvas
- Vibrant, warm, and uplifting UI/UX design
- Monetization via Stripe subscriptions ($4.99/mo with 7-day free trial)
- Referral system (Share HEARD, get a free month)
- Admin analytics dashboard
- Legal pages (Privacy Policy, Terms of Service)

## Tech Stack
- Frontend: React.js, Tailwind CSS, Framer Motion, Web Audio API
- Backend: FastAPI, PyMongo (Motor async), Emergentintegrations
- Auth: Emergent-managed Google Auth (JWT via Cookies + localStorage fallback)
- Payments: Stripe (LIVE key active)
- AI: OpenAI GPT-5.2 (Emergent LLM Key)
- DB: MongoDB

## What's Been Implemented
- Full-stack app with Google Auth, Dashboard, Mood Tracking, Journal (AI prompts), Calendar
- Willow AI companion with persistent memory, user profile extraction, and full Calm Corner toolkit knowledge
- Editable "What Willow Knows About Me" card (ChatGPT-style memory editing)
- Calm Corner: 13 micro-mindfulness activities across 5 categories
  - Box Breathing guided visual exercise
  - ASMR Player with 5 ambient sounds (Web Audio API, no external files)
  - Coloring Canvas with 2 SVG patterns (mandala, geometric) and 15-color palette
- Stripe subscriptions (LIVE key) with checkout and webhooks
- Referral program, Admin analytics dashboard
- Static legal pages, Security fixes, Performance optimizations

## Key Components
- `/app/frontend/src/components/CalmCorner.js` — Calm Corner page
- `/app/frontend/src/components/ASMRPlayer.js` — Interactive ASMR sound player
- `/app/frontend/src/components/ColoringCanvas.js` — Interactive SVG coloring canvas
- `/app/frontend/src/components/WillowMemory.js` — Editable memory card
- `/app/frontend/src/components/Dashboard.js` — Main dashboard
- `/app/frontend/src/components/WillowChat.js` — Chat with Willow
- `/app/backend/server.py` — All backend routes

## Backlog
### P1
- Community Section for mothers to connect and support each other

### P2
- "Quick Calm" floating button for instant crisis grounding
- Backend modularization (server.py ~1490 lines)
