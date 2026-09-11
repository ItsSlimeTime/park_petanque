# Setup (do this once, from your phone)

Two parts: (1) create the Google Sheet backend, (2) turn on GitHub Pages. Both can be done entirely from a phone browser.

## 1. Create the Google Sheet + connect it to the site

1. On your phone, open **sheets.google.com** (or the Google Sheets app) and create a **new blank spreadsheet**. Name it something like "Park Pétanque Scores".
2. Open the menu **Extensions → Apps Script**. (In the mobile app, request the "desktop site" in your browser if you don't see Extensions — Apps Script editing needs a browser, not the Sheets app itself.)
3. Delete any placeholder code in the editor, then copy-paste the entire contents of [`apps-script/Code.gs`](apps-script/Code.gs) from this repo into the editor.
4. Tap the **save** icon (disk), name the project "Park Pétanque Backend".
5. Tap **Deploy → New deployment**.
   - Click the gear icon next to "Select type" → choose **Web app**.
   - Description: anything, e.g. "v1".
   - **Execute as: Me**.
   - **Who has access: Anyone**.
   - Tap **Deploy**.
6. It will ask you to **authorize access** — tap through (Google will warn "Google hasn't verified this app" since it's your own script; tap **Advanced → Go to Park Pétanque Backend (unsafe)** → **Allow**). This is safe — it's your own script talking to your own sheet.
7. Copy the **Web app URL** it gives you (ends in `/exec`).
8. Open the site (the GitHub Pages link below), tap **⚙ Settings**, paste the URL into **Google Sheet Web App URL**, tap **Save**. It'll show "Connected!" if it worked.

That's it — every game you record on the site will now appear as a row in the Google Sheet, and the site's Leaderboard reads straight from it. You can open the Sheet any time to see raw data, sort it, chart it, etc.

If you ever change or redeploy the Apps Script, choose **Deploy → Manage deployments → edit (pencil) → New version → Deploy** so the same URL keeps working — a brand-new deployment gets a brand-new URL.

## 2. Turn on GitHub Pages

1. In this repo on GitHub (mobile browser is fine): **Settings → Pages**.
2. Under "Build and deployment" → **Source**, choose **Deploy from a branch**.
3. Branch: pick the branch this site lives on (`main`, or ask whoever set this up which branch to use) and folder **`/ (root)`**. Tap **Save**.
4. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/` within a minute or two — refresh the Pages settings page to get the exact link.

Share that link with whoever's scorekeeping. No app install needed — just open it in a phone browser. Consider adding it to your home screen (browser menu → "Add to Home Screen") so it opens like an app.

## Notes

- Only one phone needs to be the "scorekeeper" entering end results — anyone else with the site link can open **Leaderboard** to see live standings and game history (make sure they've also entered the same Sheet Web App URL in Settings — it's just a read).
- If you lose signal mid-game, keep scoring — the app keeps the game on your phone and retries syncing. Tap the dot in the top-right to force a retry once you're back online.
- To reset everything, just clear the rows in the Google Sheet (keep the header row) — the leaderboard rebuilds from whatever's there.
