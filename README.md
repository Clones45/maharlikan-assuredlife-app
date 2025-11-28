# Maharlikan AssuredLife (Expo + Supabase)

## Setup
- Node.js 18+, Expo CLI (`npm i -g expo`).
- Keys are embedded in `app.json -> expo.extra`.

## Run
```bash
npm i
npx expo start
```

## Routing
- `/login` → role-based redirect:
  - `/(admin)`, `/(agent)`, `/(member)`

Logo appears as faint watermark on all post-login screens.
Commission (placeholder): unlock at ≥20 new active members this month; amount = 5% of collected payments.

Now using Tabs per role (Home, section tabs, Profile).