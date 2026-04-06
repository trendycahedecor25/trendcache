# HEARD - Product Requirements Document

## Original Problem Statement
Build "HEARD" - an AI-powered webapp for overwhelmed mothers who lack support systems (absent fathers, no family/friends willing to help). Features an empathetic AI companion named Willow who listens first, validates feelings, remembers past conversations, learns emotional patterns, and helps with practical daily tasks.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Radix UI + Framer Motion
- **Backend**: FastAPI (Python) 
- **Database**: MongoDB (Motor async driver)
- **AI**: GPT-5.2 via Emergent LLM Key (emergentintegrations library)
- **Auth**: Emergent Google OAuth

## User Personas
1. **Primary**: Single mothers raising kids without support — needs emotional validation + practical daily help
2. **Secondary**: Mothers with minimal support networks — needs organization + someone to listen

## Core Requirements (Static)
1. Willow AI — empathetic companion that listens first, never judges, remembers everything
2. Dashboard — mood tracking, quick actions, overview of journal/calendar/insights
3. Journal — safe space to write, AI-generated prompts, mood tagging
4. Calendar — event management, scheduling, reminders
5. Mood Tracking — emotional baseline learning, trend analysis, insights
6. Community (future) — connect with other moms

## What's Been Implemented (2026-04-06)
- Landing page with vibrant, warm design (coral/yellow/blue palette)
- Google OAuth authentication via Emergent Auth
- Dashboard with mood check-in, quick actions (meal ideas, homework help, self-care, activities), recent journal/events, mood insights
- Willow AI Chat with GPT-5.2 — conversation memory, multi-conversation support, user context awareness (mood history, past conversations, journal entries)
- Journal with CRUD, mood tagging, AI-generated prompts from Willow
- Calendar with monthly grid view, event types (general, appointment, reminder, activity, self-care, school), CRUD
- Mood tracking with 5-point scale, trend analysis, insights
- Responsive design with sidebar (desktop) and bottom nav (mobile)
- Willow's system prompt crafted for empathetic, mom-specific support
- **Stripe Subscription** ($4.99/month) with:
  - 7-day free trial for new users
  - Free tier: 3 Willow messages/day, basic journal, calendar
  - Premium: unlimited Willow, AI prompts, full mood insights
  - Stripe checkout via emergentintegrations library
  - Payment status polling on success redirect
  - Webhook handler for payment events
  - Pricing page with plan comparison and FAQ
  - Upgrade prompts in chat, journal, and dashboard
- **Referral Program** ("Share HEARD, Get a Free Month"):
  - Unique referral code per user (auto-generated on signup)
  - Shareable link captures ?ref= parameter
  - Both referrer and new user get 30 days free Premium
  - Referral tracking with history and stats
  - Native Web Share API support + clipboard copy
  - Dashboard referral widget with stats and share button
- **Admin Analytics Dashboard** (/admin):
  - Real-time user counts (total, trial, premium, free)
  - Growth metrics (new today/week/month)
  - Revenue tracking (total, transactions)
  - Referral stats (total, this month, top referrers)
  - Engagement metrics (conversations, journal entries, mood check-ins, events)
  - Recent signups list with subscription status
  - Top referrers leaderboard
  - Secret-based admin setup (POST /api/admin/set-admin)

## Testing Status
- Backend: 91-100% across 3 iterations (all core features pass)
- Frontend: 95% (minor clipboard permission in automated testing only)

## Prioritized Backlog

### P0 (Critical - Next)
- Community section for mom-to-mom connection
- Push notification reminders for calendar events
- Willow: ability to schedule events and write emails on behalf of user

### P1 (Important)
- Emotional median tracking — advanced mood pattern analysis with proactive check-ins
- Meditation/music video recommendations from Willow
- Homework help mode — step-by-step problem solving
- Meal planning with ingredient-based recipe suggestions
- Journaling streaks and achievements

### P2 (Nice-to-have)
- Activity suggestions based on kids' ages
- Parenting advice based on current expert guidance
- Daily scheduled reminders before activities
- Conversation search across all Willow chats
- Export journal entries
- Dark mode

## Competitive Differentiators (from market research)
1. Willow listens FIRST — not clinical like Wysa, not generic like Replika
2. Emotional Median — learns individual mood patterns over time
3. Practical + Emotional in one place — no competitor combines AI companionship with calendar/meal planning/task help
4. Mom-specific context — understands invisible load, overstimulation, mom rage
5. Always-on 24/7 — there at 2am, in the carpool line, whenever needed
6. Founder authenticity — built from lived experience
