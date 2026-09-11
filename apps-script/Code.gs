/**
 * Park Pétanque — Google Sheets backend.
 *
 * Deploy this as a Web App (Deploy > New deployment > Web app,
 * Execute as: Me, Who has access: Anyone with the link) and paste the
 * resulting /exec URL into the site's Settings screen.
 *
 * See SETUP.md in the repo root for step-by-step instructions.
 */

const SHEET_NAME = 'Games';
const HEADERS = [
  'gameId', 'createdAt', 'updatedAt',
  'team1Name', 'team1Players', 'team2Name', 'team2Players',
  'team1Score', 'team2Score', 'status', 'winner',
];

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'listGames') {
    return jsonResponse({ ok: true, games: getAllGames() });
  }
  return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' });
  }
  try {
    switch (body.action) {
      case 'createGame':
        return jsonResponse({ ok: true, game: createGame(body) });
      case 'saveGame':
        return jsonResponse({ ok: true, game: saveGame(body) });
      case 'deleteGame':
        return jsonResponse({ ok: true, deleted: deleteGame(body.gameId) });
      default:
        return jsonResponse({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/* ---------- Sheet helpers ---------- */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rowToGame(row) {
  return {
    gameId: row[0],
    createdAt: row[1],
    updatedAt: row[2],
    team1Name: row[3],
    team1Players: String(row[4] || '').split('|').filter(String),
    team2Name: row[5],
    team2Players: String(row[6] || '').split('|').filter(String),
    team1Score: Number(row[7]) || 0,
    team2Score: Number(row[8]) || 0,
    status: row[9],
    winner: row[10] || '',
  };
}

function getAllGames() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values.filter((r) => r[0]).map(rowToGame);
}

function findRowIndexByGameId(sheet, gameId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === gameId) return i + 2; // 1-indexed, +1 for header
  }
  return -1;
}

/* ---------- Actions ---------- */

function createGame(body) {
  const sheet = getSheet();
  const gameId = Utilities.getUuid();
  const now = new Date().toISOString();
  const timestamp = body.playedAt || now; // lets a past game be logged with its real date
  const row = [
    gameId, timestamp, timestamp,
    body.team1Name || 'Team A', (body.team1Players || []).join('|'),
    body.team2Name || 'Team B', (body.team2Players || []).join('|'),
    0, 0, 'in_progress', '',
  ];
  sheet.appendRow(row);
  return rowToGame(row);
}

function saveGame(body) {
  const sheet = getSheet();
  const idx = findRowIndexByGameId(sheet, body.gameId);
  if (idx === -1) throw new Error('Game not found: ' + body.gameId);
  const updatedAt = body.updatedAt || new Date().toISOString(); // allows a past game's real date to stick
  sheet.getRange(idx, 3).setValue(updatedAt);
  sheet.getRange(idx, 8).setValue(Number(body.team1Score) || 0);
  sheet.getRange(idx, 9).setValue(Number(body.team2Score) || 0);
  sheet.getRange(idx, 10).setValue(body.status || 'in_progress');
  sheet.getRange(idx, 11).setValue(body.winner || '');
  const row = sheet.getRange(idx, 1, 1, HEADERS.length).getValues()[0];
  return rowToGame(row);
}

function deleteGame(gameId) {
  const sheet = getSheet();
  const idx = findRowIndexByGameId(sheet, gameId);
  if (idx === -1) return false;
  sheet.deleteRow(idx);
  return true;
}

/* ---------- Output ---------- */

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
