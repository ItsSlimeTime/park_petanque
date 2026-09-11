'use strict';

/* ---------- Constants ---------- */
const WIN_SCORE = 13;
const MAX_END_POINTS = 4; // 2 players x 2 boules each

const CFG_KEY = 'petanque_config_v1';
const GAME_KEY = 'petanque_current_game_v1';

/* ---------- State ---------- */
let config = loadConfig();
let currentGame = loadCurrentGame();
let leaderboardCache = null;

/* ---------- Storage helpers ---------- */
function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || { sheetUrl: '' };
  } catch (e) { return { sheetUrl: '' }; }
}
function saveConfig() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(config)); } catch (e) {}
}
function loadCurrentGame() {
  try { return JSON.parse(localStorage.getItem(GAME_KEY)) || null; } catch (e) { return null; }
}
function saveCurrentGame() {
  try {
    if (currentGame) localStorage.setItem(GAME_KEY, JSON.stringify(currentGame));
    else localStorage.removeItem(GAME_KEY);
  } catch (e) {}
}

/* ---------- Networking (Google Apps Script web app) ---------- */
function apiGet(action, params) {
  if (!config.sheetUrl) return Promise.resolve({ ok: false, error: 'No Sheet URL configured' });
  const url = new URL(config.sheetUrl);
  url.searchParams.set('action', action);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetchWithTimeout(url.toString(), { method: 'GET' });
}
function apiPost(action, body) {
  if (!config.sheetUrl) return Promise.resolve({ ok: false, error: 'No Sheet URL configured' });
  return fetchWithTimeout(config.sheetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight to Apps Script
    body: JSON.stringify(Object.assign({ action }, body)),
  });
}
function fetchWithTimeout(url, opts, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  setSync('pending');
  return fetch(url, Object.assign({}, opts, { signal: controller.signal }))
    .then((res) => res.json())
    .then((data) => { setSync(data && data.ok ? 'ok' : 'error'); return data; })
    .catch((err) => { setSync('error'); return { ok: false, error: String(err && err.message || err) }; })
    .finally(() => clearTimeout(t));
}

function setSync(state) {
  const el = document.getElementById('syncStatus');
  el.className = 'syncStatus ' + (config.sheetUrl ? state : 'off');
  el.title = !config.sheetUrl ? 'No Google Sheet connected' :
    state === 'ok' ? 'Synced' : state === 'pending' ? 'Syncing…' : 'Sync failed — tap to retry';
}

/* ---------- Screen navigation ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function goHome() {
  const resumeBox = document.getElementById('resumeBox');
  if (currentGame && currentGame.status === 'in_progress') {
    resumeBox.hidden = false;
  } else {
    resumeBox.hidden = true;
  }
  showScreen('screen-home');
}

/* ---------- New game ---------- */
function handleNewGameSubmit(e) {
  e.preventDefault();
  const t1p1 = document.getElementById('team1Player1').value.trim();
  const t1p2 = document.getElementById('team1Player2').value.trim();
  const t2p1 = document.getElementById('team2Player1').value.trim();
  const t2p2 = document.getElementById('team2Player2').value.trim();
  const t1name = document.getElementById('team1Name').value.trim() || [t1p1, t1p2].filter(Boolean).join(' & ') || 'Team A';
  const t2name = document.getElementById('team2Name').value.trim() || [t2p1, t2p2].filter(Boolean).join(' & ') || 'Team B';

  currentGame = {
    gameId: null, // assigned once synced; local id used meanwhile
    localId: 'local-' + Date.now(),
    createdAt: new Date().toISOString(),
    team1Name: t1name,
    team1Players: [t1p1, t1p2],
    team2Name: t2name,
    team2Players: [t2p1, t2p2],
    team1Score: 0,
    team2Score: 0,
    status: 'in_progress',
    winner: '',
    ends: [],
  };
  saveCurrentGame();
  document.getElementById('newGameForm').reset();

  renderScoreScreen();
  showScreen('screen-score');

  apiPost('createGame', {
    team1Name: t1name, team1Players: currentGame.team1Players,
    team2Name: t2name, team2Players: currentGame.team2Players,
  }).then((res) => {
    if (res.ok && res.game && res.game.gameId) {
      currentGame.gameId = res.game.gameId;
      saveCurrentGame();
    }
  });
}

/* ---------- Score screen ---------- */
function renderScoreScreen() {
  if (!currentGame) return;
  document.getElementById('scoreTeam1Name').textContent = currentGame.team1Name;
  document.getElementById('scoreTeam2Name').textContent = currentGame.team2Name;
  document.getElementById('scoreTeam1Players').textContent = currentGame.team1Players.join(' & ');
  document.getElementById('scoreTeam2Players').textContent = currentGame.team2Players.join(' & ');
  document.getElementById('scoreTeam1Score').textContent = currentGame.team1Score;
  document.getElementById('scoreTeam2Score').textContent = currentGame.team2Score;
  document.getElementById('ecTeam1Label').textContent = currentGame.team1Name;
  document.getElementById('ecTeam2Label').textContent = currentGame.team2Name;
  document.getElementById('undoBtn').disabled = currentGame.ends.length === 0;

  const hist = document.getElementById('endHistory');
  hist.innerHTML = '';
  currentGame.ends.slice().reverse().forEach((end, i) => {
    const row = document.createElement('div');
    row.className = 'end-row';
    const endNum = currentGame.ends.length - i;
    const teamName = end.team === 'team1' ? currentGame.team1Name : currentGame.team2Name;
    row.innerHTML = `<span>End ${endNum}</span><span>${escapeHtml(teamName)} +${end.points}</span>`;
    hist.appendChild(row);
  });
}

function recordEnd(team, points) {
  if (!currentGame) return;
  const scoreKey = team === 'team1' ? 'team1Score' : 'team2Score';
  currentGame.ends.push({ team, points });
  currentGame[scoreKey] = Math.min(WIN_SCORE, currentGame[scoreKey] + points);

  const winner = currentGame.team1Score >= WIN_SCORE ? 'team1'
    : currentGame.team2Score >= WIN_SCORE ? 'team2' : null;

  if (winner) {
    currentGame.status = 'finished';
    currentGame.winner = winner;
  }
  saveCurrentGame();
  syncCurrentGame();

  if (winner) {
    renderGameOverScreen();
    showScreen('screen-gameover');
  } else {
    renderScoreScreen();
  }
}

function undoLastEnd() {
  if (!currentGame || currentGame.ends.length === 0) return;
  const last = currentGame.ends.pop();
  const scoreKey = last.team === 'team1' ? 'team1Score' : 'team2Score';
  currentGame[scoreKey] = Math.max(0, currentGame[scoreKey] - last.points);
  currentGame.status = 'in_progress';
  currentGame.winner = '';
  saveCurrentGame();
  syncCurrentGame();
  renderScoreScreen();
  showScreen('screen-score');
}

function syncCurrentGame() {
  if (!currentGame) return;
  if (!currentGame.gameId) {
    // game hasn't finished being created remotely yet; try again shortly
    setTimeout(() => { if (currentGame && currentGame.gameId) syncCurrentGame(); }, 1500);
    return;
  }
  apiPost('saveGame', {
    gameId: currentGame.gameId,
    team1Score: currentGame.team1Score,
    team2Score: currentGame.team2Score,
    status: currentGame.status,
    winner: currentGame.winner,
  });
}

function cancelGame() {
  if (!currentGame) return goHome();
  if (!confirm('Cancel this game? This cannot be undone.')) return;
  if (currentGame.gameId) apiPost('deleteGame', { gameId: currentGame.gameId });
  currentGame = null;
  saveCurrentGame();
  goHome();
}

/* ---------- Game over ---------- */
function renderGameOverScreen() {
  const winnerName = currentGame.winner === 'team1' ? currentGame.team1Name : currentGame.team2Name;
  document.getElementById('winnerBanner').textContent = `🏆 ${winnerName} wins!`;
  document.getElementById('finalScore').textContent = `${currentGame.team1Score} – ${currentGame.team2Score}`;
  const note = document.getElementById('gameOverSyncNote');
  note.textContent = config.sheetUrl ? 'Result saved to the Google Sheet.' : 'No Google Sheet connected — result kept on this phone only.';
}

function finishAndReset() {
  currentGame = null;
  saveCurrentGame();
}

/* ---------- Leaderboard ---------- */
function loadLeaderboard() {
  document.getElementById('lbLoading').hidden = false;
  document.getElementById('lbError').hidden = true;
  document.getElementById('lbTable').hidden = true;
  document.getElementById('gameHistoryList').innerHTML = '';

  if (!config.sheetUrl) {
    document.getElementById('lbLoading').hidden = true;
    document.getElementById('lbError').hidden = false;
    document.getElementById('lbError').textContent = 'Connect a Google Sheet in Settings to see the leaderboard.';
    return;
  }

  apiGet('listGames').then((res) => {
    document.getElementById('lbLoading').hidden = true;
    if (!res.ok) {
      document.getElementById('lbError').hidden = false;
      document.getElementById('lbError').textContent = 'Could not load games: ' + (res.error || 'unknown error');
      return;
    }
    leaderboardCache = res.games || [];
    renderLeaderboard(leaderboardCache);
  });
}

function renderLeaderboard(games) {
  const finished = games.filter((g) => g.status === 'finished');
  const stats = {}; // key: lowercase name -> { name, wins, games }

  finished.forEach((g) => {
    const winnerPlayers = g.winner === 'team1' ? g.team1Players : g.team2Players;
    const loserPlayers = g.winner === 'team1' ? g.team2Players : g.team1Players;
    (winnerPlayers || []).forEach((n) => bump(n, true));
    (loserPlayers || []).forEach((n) => bump(n, false));
  });
  function bump(name, won) {
    const key = (name || '').trim().toLowerCase();
    if (!key) return;
    if (!stats[key]) stats[key] = { name: name.trim(), wins: 0, games: 0 };
    stats[key].games += 1;
    if (won) stats[key].wins += 1;
  }

  const rows = Object.values(stats).sort((a, b) => b.wins - a.wins || (b.wins / b.games) - (a.wins / a.games));
  const tbody = document.getElementById('lbTableBody');
  tbody.innerHTML = '';
  if (rows.length === 0) {
    document.getElementById('lbTable').hidden = true;
    document.getElementById('lbError').hidden = false;
    document.getElementById('lbError').textContent = 'No finished games yet — play one!';
  } else {
    document.getElementById('lbError').hidden = true;
    document.getElementById('lbTable').hidden = false;
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      const pct = Math.round((r.wins / r.games) * 100);
      tr.innerHTML = `<td>${escapeHtml(r.name)}</td><td>${r.wins}</td><td>${r.games}</td><td>${pct}%</td>`;
      tbody.appendChild(tr);
    });
  }

  const list = document.getElementById('gameHistoryList');
  list.innerHTML = '';
  games
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 25)
    .forEach((g) => {
      const card = document.createElement('div');
      card.className = 'game-card' + (g.status !== 'finished' ? ' in-progress' : '');
      const badge = g.status !== 'finished' ? '<span class="gc-badge">live</span>' : '';
      const date = new Date(g.updatedAt || g.createdAt);
      card.innerHTML = `
        <div class="gc-top"><span>${escapeHtml(g.team1Name)} ${g.team1Score} – ${g.team2Score} ${escapeHtml(g.team2Name)}${badge}</span></div>
        <div class="gc-teams">${escapeHtml((g.team1Players || []).join(' & '))} vs ${escapeHtml((g.team2Players || []).join(' & '))}</div>
        <div class="gc-date">${date.toLocaleString()}</div>
      `;
      list.appendChild(card);
    });
}

/* ---------- Log past game ---------- */
function handlePastGameSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById('pastGameMsg');
  const t1p1 = document.getElementById('pgTeam1Player1').value.trim();
  const t1p2 = document.getElementById('pgTeam1Player2').value.trim();
  const t2p1 = document.getElementById('pgTeam2Player1').value.trim();
  const t2p2 = document.getElementById('pgTeam2Player2').value.trim();
  const t1name = document.getElementById('pgTeam1Name').value.trim() || [t1p1, t1p2].filter(Boolean).join(' & ') || 'Team A';
  const t2name = document.getElementById('pgTeam2Name').value.trim() || [t2p1, t2p2].filter(Boolean).join(' & ') || 'Team B';
  const t1score = parseInt(document.getElementById('pgTeam1Score').value, 10);
  const t2score = parseInt(document.getElementById('pgTeam2Score').value, 10);
  const playedDate = document.getElementById('pgDate').value; // yyyy-mm-dd or ''

  if (Number.isNaN(t1score) || Number.isNaN(t2score) || t1score < 0 || t2score < 0 || t1score > WIN_SCORE || t2score > WIN_SCORE) {
    msg.hidden = false; msg.className = 'msg msg-error';
    msg.textContent = `Scores must be between 0 and ${WIN_SCORE}.`;
    return;
  }
  if (t1score === t2score) {
    msg.hidden = false; msg.className = 'msg msg-error';
    msg.textContent = 'Scores can\'t be tied — pétanque has no draws.';
    return;
  }
  if (!config.sheetUrl) {
    msg.hidden = false; msg.className = 'msg msg-error';
    msg.textContent = 'Connect a Google Sheet in Settings first — past games are saved there, not on this phone.';
    return;
  }

  const winner = t1score > t2score ? 'team1' : 'team2';
  msg.hidden = false; msg.className = 'msg';
  msg.textContent = 'Saving…';

  apiPost('createGame', {
    team1Name: t1name, team1Players: [t1p1, t1p2],
    team2Name: t2name, team2Players: [t2p1, t2p2],
    playedAt: playedDate ? new Date(playedDate).toISOString() : undefined,
  }).then((res) => {
    if (!res.ok || !res.game || !res.game.gameId) {
      msg.className = 'msg msg-error';
      msg.textContent = 'Could not save: ' + (res.error || 'unknown error');
      return;
    }
    return apiPost('saveGame', {
      gameId: res.game.gameId,
      team1Score: t1score, team2Score: t2score,
      status: 'finished', winner,
      updatedAt: playedDate ? new Date(playedDate).toISOString() : undefined,
    }).then((res2) => {
      if (!res2.ok) {
        msg.className = 'msg msg-error';
        msg.textContent = 'Could not save score: ' + (res2.error || 'unknown error');
        return;
      }
      msg.className = 'msg msg-ok';
      msg.textContent = 'Saved!';
      document.getElementById('pastGameForm').reset();
      setTimeout(() => { msg.hidden = true; showScreen('screen-leaderboard'); loadLeaderboard(); }, 600);
    });
  });
}

/* ---------- Settings ---------- */
function renderSettings() {
  document.getElementById('sheetUrlInput').value = config.sheetUrl || '';
  document.getElementById('settingsMsg').hidden = true;
}
function saveSettings() {
  config.sheetUrl = document.getElementById('sheetUrlInput').value.trim();
  saveConfig();
  setSync(config.sheetUrl ? 'pending' : 'off');
  const msg = document.getElementById('settingsMsg');
  msg.hidden = false;
  msg.className = 'msg msg-ok';
  msg.textContent = 'Saved.';
  if (config.sheetUrl) testConnection();
}
function testConnection() {
  const msg = document.getElementById('settingsMsg');
  msg.hidden = false;
  msg.className = 'msg';
  msg.textContent = 'Testing…';
  apiGet('listGames').then((res) => {
    msg.hidden = false;
    if (res.ok) {
      msg.className = 'msg msg-ok';
      msg.textContent = `Connected! Found ${(res.games || []).length} game(s) in the sheet.`;
    } else {
      msg.className = 'msg msg-error';
      msg.textContent = 'Could not connect: ' + (res.error || 'unknown error');
    }
  });
}

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Wire up events ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('homeLink').addEventListener('click', goHome);
  document.getElementById('newGameBtn').addEventListener('click', () => showScreen('screen-newgame'));
  document.getElementById('newGameBackBtn').addEventListener('click', goHome);
  document.getElementById('leaderboardBtn').addEventListener('click', () => { showScreen('screen-leaderboard'); loadLeaderboard(); });
  document.getElementById('settingsBtn').addEventListener('click', () => { renderSettings(); showScreen('screen-settings'); });
  document.getElementById('settingsBackBtn').addEventListener('click', goHome);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('testConnectionBtn').addEventListener('click', testConnection);

  document.getElementById('newGameForm').addEventListener('submit', handleNewGameSubmit);

  document.getElementById('resumeGameBtn').addEventListener('click', () => { renderScoreScreen(); showScreen('screen-score'); });
  document.getElementById('undoBtn').addEventListener('click', undoLastEnd);
  document.getElementById('cancelGameBtn').addEventListener('click', cancelGame);

  document.querySelectorAll('#screen-score .btn-point').forEach((btn) => {
    btn.addEventListener('click', () => recordEnd(btn.dataset.team, parseInt(btn.dataset.pts, 10)));
  });

  document.getElementById('logPastGameBtn').addEventListener('click', () => {
    document.getElementById('pastGameMsg').hidden = true;
    showScreen('screen-pastgame');
  });
  document.getElementById('pastGameBackBtn').addEventListener('click', goHome);
  document.getElementById('pastGameForm').addEventListener('submit', handlePastGameSubmit);

  document.getElementById('afterGameNewBtn').addEventListener('click', () => { finishAndReset(); showScreen('screen-newgame'); });
  document.getElementById('afterGameLeaderboardBtn').addEventListener('click', () => { finishAndReset(); showScreen('screen-leaderboard'); loadLeaderboard(); });
  document.getElementById('afterGameHomeBtn').addEventListener('click', () => { finishAndReset(); goHome(); });

  document.getElementById('refreshLbBtn').addEventListener('click', loadLeaderboard);
  document.getElementById('lbBackBtn').addEventListener('click', goHome);

  document.getElementById('syncStatus').addEventListener('click', () => { if (currentGame) syncCurrentGame(); });

  setSync(config.sheetUrl ? 'pending' : 'off');
  if (currentGame && currentGame.status === 'finished') {
    // app was closed right after a win before the player moved on
    renderGameOverScreen();
    showScreen('screen-gameover');
  } else {
    goHome();
  }
});
