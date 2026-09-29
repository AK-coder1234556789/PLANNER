# JEE Planner

Day-wise tasks (Lectures, HW, Doubts), notes, labels, targets with deadlines, and a customizable countdown card. Firebase Google login with real-time sync.

## Setup
1. Create a Firebase project. Add a web app and copy its config.
2. Authentication > Sign-in method > enable Google.
3. Firestore Database > create, then paste `firestore.rules` into the Rules tab and publish.
4. `cp .env.example .env` and fill in the values.
5. `npm install` then `npm run dev`.
6. After deploying (Vercel or Netlify), add your live domain under Authentication > Settings > Authorized domains, and add the same env vars in the host's settings.

## Using it
- Calendar: month grid with done/total per day; click a day to open it.
- Analysis: daily, weekly and till-date completion, plus Main Tasks (create them, attach existing tasks, see progress).
- Targets: add a name and deadline, and pin one to show it on the countdown card.
- Settings: layout (columns or stacked with side panel), icon-only sidebar, accent color, today's completion, and countdown card style.

## Not built yet
Drag-to-reorder, rename and delete labels.
