import './popup.css';
import { vaultStorage, validateVault, DATABASE_KEY } from '../utils/storage.js';
import { CryptoEngine } from '../utils/crypto.js';
import { normalizeAccounts, resolveAccounts, isAuthenticator } from '../utils/accounts.js';
import { TOTP } from '../utils/totp.js';
import { fillPage, matchesSite } from './autofill.js';

const $ = id => document.getElementById(id);
let accounts = [];
let passkeys = [];
let tab;
let timer;
let revision;
const status = message => { $('status').textContent = message; };
const copy = async (value, label) => { try { await navigator.clipboard.writeText(value || ''); status(`${label} copied. Clipboard is not auto-cleared by the extension.`); } catch (error) { status(`Could not copy ${label.toLowerCase()}: ${error.message}`); } };
function lock() { clearTimeout(timer); accounts = []; passkeys = []; $('accounts').replaceChildren(); $('unlock').hidden = false; $('password').value = ''; $('search').value = ''; $('search').hidden = true; $('lock').hidden = true; }
async function fill(item, mode) {
  try {
    if (vaultStorage.get($('profile').value)?.revision !== revision) { lock(); throw new Error('Vault changed. Unlock again.'); }
    const current = await chrome.tabs.get(tab.id);
    if (!matchesSite(item, current.url)) throw new Error('The website changed. Autofill blocked.');
    const values = mode === 'totp' ? { code: await TOTP.generate(item.totpSecret) } : { username: item.username, password: item.password };
    const result = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: fillPage, args: [new URL(current.url).origin, values, mode] });
    status(result[0]?.result || 'Filled.');
  } catch (error) { status(error.message); }
}
function button(label, action, kind = 'secondary') { const element = document.createElement('button'); element.textContent = label; element.className = kind; element.addEventListener('click', action); return element; }
function renderMatches() {
  const query = $('search').value.trim().toLowerCase();
  const filteredAccounts = accounts.filter(item => `${item.name} ${item.username || ''} ${item.website || ''}`.toLowerCase().includes(query));
  const filteredPasskeys = passkeys.filter(item => `${item.name} ${item.username || ''}`.toLowerCase().includes(query));
  $('accounts').replaceChildren();
  for (const item of filteredAccounts) {
    const article = document.createElement('article');
    const label = document.createElement('p'); label.textContent = `${item.name} - ${item.username || 'No username'}`; article.append(label);
    const actions = document.createElement('div'); actions.className = 'actions';
    actions.append(button('Fill login', () => fill(item, 'login'), 'primary'), button('Copy user', () => copy(item.username, 'Username')), button('Copy password', () => copy(item.password, 'Password')));
    if (item.totpSecret) actions.append(button('Fill 2FA', () => fill(item, 'totp'), 'primary'), button('Copy 2FA', async () => copy(await TOTP.generate(item.totpSecret), '2FA code')));
    article.append(actions); $('accounts').append(article);
  }
  for (const item of filteredPasskeys) {
    const article = document.createElement('article');
    const label = document.createElement('p'); label.textContent = `${item.name} - passkey`; article.append(label);
    const note = document.createElement('small'); note.textContent = 'Start the website sign-in flow; the browser will prompt for the registered passkey.'; article.append(note);
    article.append(button('Website sign-in', () => status('Start the sign-in flow on the website. Passkey ceremonies require the site server challenge.'))); $('accounts').append(article);
  }
  if (!filteredAccounts.length && !filteredPasskeys.length) { const empty = document.createElement('p'); empty.textContent = query ? 'No matching accounts.' : 'No exact HTTPS origin matches.'; empty.className = 'empty'; $('accounts').append(empty); }
}
try {
  await vaultStorage.initialize();
  for (const name of vaultStorage.names()) { const option = document.createElement('option'); option.value = name; option.textContent = name; $('profile').append(option); }
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  $('site').textContent = tab?.url ? new URL(tab.url).hostname : 'Open a website to autofill.';
} catch (error) { status(error.message); }
$('unlock').addEventListener('submit', async event => {
  event.preventDefault(); const submit = event.submitter; submit.disabled = true;
  try {
    const record = vaultStorage.get($('profile').value);
    if (!record?.vault) throw new Error('Open the vault to create a profile or import an encrypted backup.');
    const key = await CryptoEngine.deriveMasterKey($('password').value, record.salt);
    const payload = normalizeAccounts(validateVault(JSON.parse(await CryptoEngine.decryptPayload(key, record.vault))));
    $('password').value = ''; revision = record.revision;
    const resolvedItems = resolveAccounts(payload.items);
    accounts = resolvedItems.filter(item => !isAuthenticator(item) && item.category === 'Logins' && matchesSite(item, tab?.url));
    passkeys = resolvedItems.filter(item => item.category === 'Passkeys' && matchesSite(item, tab?.url));
    $('unlock').hidden = true; $('lock').hidden = false; $('search').hidden = false; renderMatches();
    status(`${accounts.length} login${accounts.length === 1 ? '' : 's'} and ${passkeys.length} passkey${passkeys.length === 1 ? '' : 's'} available. Autofill never submits forms.`);
    timer = setTimeout(lock, 60000);
  } catch (error) { status('Unlock failed: ' + error.message); } finally { submit.disabled = false; }
});
$('search').addEventListener('input', renderMatches);
$('lock').addEventListener('click', lock);
$('profile').addEventListener('change', lock);
$('manage').addEventListener('click', () => chrome.runtime.openOptionsPage());
window.addEventListener('pagehide', lock);
window.addEventListener('storage', event => { if (event.key === DATABASE_KEY || event.key === null) lock(); });
