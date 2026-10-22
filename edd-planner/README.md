# EDD Planner – Prof. Dr. Sajida Guftaar

A personal, offline app for expected delivery dates (EDD). All patient data is stored only on the phone.

## Files
index.html, app.css, app.js, db.js, sw.js, manifest.webmanifest, icons/

## Put it online once (needed only so Android can install it)
The files must be served over HTTPS one time. Only the app code is hosted; patient data never leaves the phone.
- **GitHub Pages:** create a repository, upload these files, then Settings → Pages → Deploy from branch (main).
- **Netlify / Cloudflare Pages:** drag this folder into a new site.

## Install on the Android phone
1. Open the link in **Chrome**.
2. Menu (⋮) → **Add to Home screen / Install app**.
3. Open EDD Planner from the home screen → **More** → turn on **Daily reminder** and allow notifications.
4. Chrome settings → Site settings → the app's site → allow **Background sync**, and set Chrome's battery usage to **Unrestricted** so the reminder arrives on time.

## Daily use
- **Day**: opens on tomorrow's expected deliveries. Tap a name for the full details.
- **Week / Month**: colour-coded overview. Red = C-Section, Green = Normal, Amber = Not decided.
- **Patients**: upcoming, past-EDD and delivered lists, with search.
- **More → Save backup** every week or two. The backup file can be restored on a new phone.
