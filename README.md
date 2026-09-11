# Park Pétanque

A phone-friendly scorer for 2v2 pétanque (each player throws 2 boules, first team to 13 wins). Static site hosted on GitHub Pages, with game results synced live to a Google Sheet so anyone can check the leaderboard.

- **Score a game:** enter the four player names, then after each end tap which team won and how many points (1–4). The app tracks the running total, caps it at 13, and declares the winner.
- **Undo** the last end if you mis-tap.
- **Leaderboard & History:** wins/games/win% per player, plus a log of every game, pulled straight from the Google Sheet.
- Works on one phone with zero setup (scores stay in that phone's browser) — connecting a Google Sheet (Settings) makes scores visible live from any phone and keeps a permanent record.

## First-time setup

See [`SETUP.md`](SETUP.md) — everything can be done from a phone, no computer required:
1. Create the Google Sheet backend (paste in `apps-script/Code.gs`, deploy as a Web App).
2. Turn on GitHub Pages for this repo.

## Files

- `index.html`, `style.css`, `app.js` — the site (no build step, no dependencies).
- `apps-script/Code.gs` — Google Apps Script backend that reads/writes the Google Sheet.
- `SETUP.md` — step-by-step setup instructions.
