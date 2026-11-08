export function matchesSite(item, value) {
  try {
    const current = new URL(value);
    if (current.protocol !== 'https:' || current.username || current.password) return false;
    const uris = [item.website, ...(item.uris || []).map(uri => uri.uri)].filter(Boolean);
    return uris.some(value => {
      try {
        const saved = new URL(value.includes('://') ? value : 'https://' + value);
        return saved.protocol === 'https:' && !saved.username && !saved.password && saved.origin === current.origin;
      } catch { return false; }
    });
  } catch { return false; }
}

// This self-contained function runs only in the selected page's top frame after
// an explicit popup click. Recheck the origin to prevent navigation races.
export function fillPage(expectedOrigin, values, mode) {
  if (location.origin !== expectedOrigin || location.protocol !== 'https:' || window.top !== window.self) throw new Error('Page changed. Open the extension again.');
  const visible = input => !input.disabled && !input.readOnly && input.getClientRects().length > 0 && getComputedStyle(input).visibility !== 'hidden';
  const inputs = [...document.querySelectorAll('input')].filter(visible);
  const set = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  if (mode === 'totp') {
    const fields = inputs.filter(input => input.autocomplete === 'one-time-code');
    if (fields.length !== 1) throw new Error('No unique one-time-code field found. Copy the code instead.');
    set(fields[0], values.code);
    return '2FA code filled.';
  }
  const passwords = inputs.filter(input => input.type === 'password' && input.autocomplete !== 'new-password');
  if (passwords.length !== 1) throw new Error('No unique login password field found. Fill manually on this page.');
  const password = passwords[0];
  if (password.form?.action && new URL(password.form.action, location.href).origin !== expectedOrigin) throw new Error('Form submits to another origin. Autofill blocked.');
  const candidates = inputs.filter(input => input.form === password.form && (input.autocomplete === 'username' || input.type === 'email' || input.type === 'text'));
  const username = candidates.find(input => input.autocomplete === 'username') || (candidates.length === 1 ? candidates[0] : null);
  if (username) set(username, values.username || '');
  set(password, values.password || '');
  return 'Login filled. Review the page and submit when ready.';
}
