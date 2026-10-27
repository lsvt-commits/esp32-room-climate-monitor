const { JSDOM } = require(process.env.STANZA_JSDOM || 'jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('public/index.html', 'utf8');
const script = fs.readFileSync('public/i18n.js', 'utf8');
function page(savedLanguage) {
  const dom = new JSDOM(html, { url: 'http://localhost:8000/', runScripts: 'outside-only' });
  if (savedLanguage) dom.window.localStorage.setItem('roomClimate.language', savedLanguage);
  dom.window.eval(script);
  return dom;
}

const english = page();
try {
  const { document, ClimateI18n } = english.window;
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.title, 'ESP32 Room Climate Monitor');
  assert.match(document.getElementById('diary-title').textContent, /Measurement history/);
  assert(document.querySelectorAll('[data-i18n]').length > 50);
  assert.doesNotMatch(document.body.textContent, /STANZA|Costruito un campione|Il clima, qui dentro/);
  ClimateI18n.setLanguage('it');
  assert.equal(document.documentElement.lang, 'it');
  assert.equal(document.getElementById('history-live').textContent, 'Torna in diretta');
  assert.equal(document.getElementById('temperature-help').getAttribute('aria-label'), 'Consigli sulla temperatura');
  assert.equal(ClimateI18n.locale(), 'it-IT');
  ClimateI18n.setLanguage('en');
  assert.equal(document.getElementById('history-live').textContent, 'Live view');
  assert.equal(document.getElementById('temperature-help').getAttribute('aria-label'), 'Temperature guidance');
  assert.equal(ClimateI18n.t('Archivio sincronizzato'), 'History synchronized');
  ClimateI18n.setLanguage('unknown');
  assert.equal(ClimateI18n.language(), 'en');
} finally {
  english.window.close();
}

const italian = page('it');
try {
  assert.equal(italian.window.document.documentElement.lang, 'it');
  assert.equal(italian.window.document.getElementById('language-switch').value, 'it');
} finally {
  italian.window.close();
}
console.log('OK: English defaults, Italian translation, accessible labels, saved preference and legacy device messages.');
