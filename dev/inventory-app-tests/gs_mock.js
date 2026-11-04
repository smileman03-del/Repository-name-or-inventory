// 구글 시트/Apps Script 모의 환경 (Code.gs 시험용 공용 모듈)
// 실제 구글의 까다로운 동작을 일부러 흉내 낸다:
//  - 새 스프레드시트에는 비어 있는 기본 시트("시트1")가 있다
//  - ARRAYFORMULA 가 있으면 getLastRow() 가 시트 맨 아래 행을 돌려줄 수 있다(최악의 경우)
//  - 날짜 서식은 지정한 시간대를 따른다
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');

function fmt(date, tz, f) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(date).map(x => [x.type, x.value]));
  if (f === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
  if (f === 'yyMMddHHmmss') return `${p.year.slice(2)}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
  throw new Error('모의 환경이 모르는 날짜 서식: ' + f);
}

module.exports = function createEnv(codePath, opts = {}) {
  const maxRows = opts.maxRows || 1000;
  const calls = { getRange: 0, setValue: 0, setValues: 0, setFormula: 0, setFormulas: 0 };
  const seen = { tz: [] };

  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); calls.getRange++; }
    _each(fn) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) fn(i, j); }
    setValues(v) { calls.setValues++; for (let i = 0; i < v.length; i++) for (let j = 0; j < v[0].length; j++) { (this.sh.d[this.r - 1 + i] = this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j] = v[i][j]; } return this; }
    setValue(v) { calls.setValue++; (this.sh.d[this.r - 1] = this.sh.d[this.r - 1] || [])[this.c - 1] = v; return this; }
    setFormula(f) { calls.setFormula++; (this.sh.d[this.r - 1] = this.sh.d[this.r - 1] || [])[this.c - 1] = f; return this; }
    setFormulas(v) { calls.setFormulas++; for (let i = 0; i < v.length; i++) for (let j = 0; j < v[0].length; j++) { (this.sh.d[this.r - 1 + i] = this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j] = v[i][j]; } return this; }
    setFontWeight() { return this; }
    clearContent() { this._each((i, j) => { const row = this.sh.d[this.r - 1 + i]; if (row) row[this.c - 1 + j] = ''; }); return this; }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(((this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]) ?? ''); o.push(row); } return o; }
    getFormulas() { return this.getValues().map(r => r.map(x => (typeof x === 'string' && x.startsWith('=')) ? x : '')); }
  }
  class Sheet {
    constructor(name) { this.name = name; this.d = []; }
    getName() { return this.name; }
    getMaxRows() { return maxRows; }
    _hasArray() { return opts.arraySpill !== false && this.d.some(r => (r || []).some(x => typeof x === 'string' && x.startsWith('=ARRAYFORMULA'))); }
    getLastRow() {
      if (this._hasArray()) return maxRows;            // 최악의 경우: 자동 수식 때문에 맨 아래로 보고
      for (let i = this.d.length; i > 0; i--) if ((this.d[i - 1] || []).some(x => x !== '' && x !== undefined)) return i;
      return 0;
    }
    getLastColumn() { let m = 0; this.d.forEach(r => (r || []).forEach((x, j) => { if (x !== '' && x !== undefined) m = Math.max(m, j + 1); })); return m; }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
    appendRow(a) { this.d[this.getLastRow()] = a; }
    deleteRow(r) { this.d.splice(r - 1, 1); }
    setFrozenRows() {}
  }
  const sheets = [];
  const ss = {
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; },
    getSheets: () => sheets.slice(),
    deleteSheet: s => { sheets.splice(sheets.indexOf(s), 1); },
    getSpreadsheetTimeZone: () => opts.sheetTz || 'Asia/Seoul',
  };
  if (opts.defaultSheet !== false) ss.insertSheet('시트1');   // 새 스프레드시트의 빈 기본 시트

  const alerts = [], prompts = [];
  const ui = {
    Button: { OK: 'OK', YES: 'YES', NO: 'NO' }, ButtonSet: { OK_CANCEL: 0, YES_NO: 1 },
    answer: 'YES', promptText: '', menu: { title: '', items: 0 },
    alert(m, body, set) { alerts.push([m, body].filter(Boolean).join(' | ')); return set === 1 ? ui.answer : 'OK'; },
    prompt() { return { getSelectedButton: () => 'OK', getResponseText: () => ui.promptText }; },
    createMenu(t) { ui.menu = { title: t, items: 0 }; return ui; }, addItem() { ui.menu.items++; return ui; }, addSeparator() { return ui; }, addToUi() {},
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ui },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: () => crypto.randomUUID(), formatDate: (d, tz, f) => { seen.tz.push(tz); return fmt(d, tz, f); } },
    Session: { getScriptTimeZone: () => 'America/Los_Angeles' },   // 일부러 스프레드시트와 다르게
    ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    JSON, Date, Math, String, parseInt, isNaN, Object, Array,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx);
  const run = s => vm.runInContext(s, ctx);
  const J = x => JSON.parse(JSON.stringify(x));
  const get = a => JSON.parse(run(`doGet({parameter:{action:'${a}'}})`).s);
  const post = p => JSON.parse(run(`doPost({postData:{contents:${JSON.stringify(JSON.stringify(p))}}})`).s);
  const sheet = n => ss.getSheetByName(n);
  // 구매자가 시트에 직접 붙여넣거나 입력하는 동작 (A열부터)
  const paste = (name, startRow, rows) => { const sh = sheet(name); rows.forEach((r, i) => { (sh.d[startRow - 1 + i] = sh.d[startRow - 1 + i] || []); r.forEach((v, j) => { sh.d[startRow - 1 + i][j] = v; }); }); };
  return { ss, sheets, sheet, ui, alerts, calls, seen, run, J, get, post, paste, ctx };
};
