/**
 * ScoutSNF access log
 * ---------------------------------------------------------
 * Writes every app open to the "Log" tab.
 * Blocks any email listed in the "Denied" tab.
 * Deploy as a Web App. Execute as: Me. Access: Anyone.
 *
 * Reference only -- this file is never bundled by the app's build. Copy its
 * contents into a standalone Apps Script project (script.google.com -> New
 * project), not one created via a spreadsheet's Extensions menu -- that
 * container-bound flow depends on a Sheets<->Apps Script redirect that can
 * break under some browser/extension setups. A standalone project sidesteps
 * that entirely by opening the tracking sheet directly by ID instead.
 */

var SPREADSHEET_ID = '1-0Kem3s90rTflNoBsJJm4pJ2lFZp0_7Et49pbE0tWso'; // from the sheet's URL, between /d/ and /edit
var LOG_SHEET = 'Log';
var DENY_SHEET = 'Denied';

function doGet(e) {
  return handle((e && e.parameter) || {});
}

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (e && e.postData && e.postData.contents) {
    try {
      p = JSON.parse(e.postData.contents);
    } catch (err) {
      // Keep the query parameters if the body is not JSON.
    }
  }
  return handle(p);
}

function handle(p) {
  var name = String(p.name || '').trim();
  var email = String(p.email || '').trim().toLowerCase();
  var device = String(p.device || '').trim();
  var event = String(p.event || 'open').trim();
  var ua = String(p.ua || '').slice(0, 200);

  if (!email) {
    return json({ ok: false, allowed: true, error: 'missing email' });
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var log = ss.getSheetByName(LOG_SHEET) || ss.insertSheet(LOG_SHEET);
  var deny = ss.getSheetByName(DENY_SHEET) || ss.insertSheet(DENY_SHEET);

  if (log.getLastRow() === 0) {
    log.appendRow(['Timestamp', 'Name', 'Email', 'Device ID', 'Event', 'Browser']);
    log.setFrozenRows(1);
  }
  if (deny.getLastRow() === 0) {
    deny.appendRow(['Email to block']);
    deny.setFrozenRows(1);
  }

  var denied = isDenied(deny, email);

  log.appendRow([
    new Date(),
    sheetSafe(name),
    sheetSafe(email),
    sheetSafe(device),
    sheetSafe(denied ? event + ' (blocked)' : event),
    sheetSafe(ua)
  ]);

  return json({ ok: true, allowed: !denied });
}

function isDenied(deny, email) {
  var lastRow = deny.getLastRow();
  if (lastRow < 2) return false;

  var rows = deny.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    var entry = String(rows[i][0] || '').trim().toLowerCase();
    if (!entry) continue;

    // A whole domain can be blocked. Example: @competitor.com
    if (entry.charAt(0) === '@') {
      if (email.slice(-entry.length) === entry) return true;
    } else if (entry === email) {
      return true;
    }
  }
  return false;
}

// Every logged value is attacker-controlled free text. A name/email/device/UA
// starting with =, +, -, or @ would otherwise be interpreted as a formula the
// moment this sheet is opened in the Sheets UI -- prefixing with a leading
// apostrophe forces Sheets to store and display it as plain text instead.
function sheetSafe(value) {
  var s = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
