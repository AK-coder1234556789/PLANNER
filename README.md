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
- Analysis: daily, weekly and till-date completion, a 14-day trend, progress by section and label, and pending tasks grouped by age, section or label (with move-to-today and delete).
- Adding tasks: type and press Enter. Shift+Enter adds it as a note instead.
- Events: add a test date, revision day or deadline from the Calendar (click + on a day, or the Event button). Events show as colored chips on the calendar and on that day.
- Targets: add a name and deadline, and pin one to show it on the countdown card.
- Settings: layout (columns or stacked with side panel), icon-only sidebar, accent color, today's completion, and countdown card style.

## Not built yet
Drag-to-reorder, rename and delete labels.

## If login fails
- "Connect Firebase" screen: your .env is missing or empty. Fill it in and restart `npm run dev`.
- "This domain is not authorized": add the domain (localhost is allowed by default, your live site is not) under Authentication > Settings > Authorized domains.
- "Google sign-in is not enabled": turn on Google under Authentication > Sign-in method.
- Popup blocked (common on phones): the app automatically switches to a full-page Google sign-in.
- Sync: the sidebar shows Synced, Syncing or Offline. Offline changes are kept on the device and upload when you reconnect.
