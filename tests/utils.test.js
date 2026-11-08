import test from 'node:test';
import assert from 'node:assert/strict';
import { TOTP } from '../src/utils/totp.js';
import { QRCodeEncoder } from '../src/utils/qrcode.js';

test('TOTP parses otpauth URLs without exposing the secret in the label', () => {
  const parsed = TOTP.parseOtpAuthUrl('otpauth://totp/GitHub%3Aalice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub');
  assert.equal(parsed.issuer, 'GitHub');
  assert.equal(parsed.account, 'alice');
  assert.equal(parsed.secret, 'JBSWY3DPEHPK3PXP');
});

test('TOTP imports Google Authenticator migration payloads', () => {
  const account = Uint8Array.from([
    10, 3, 1, 2, 3,
    18, 5, 97, 108, 105, 99, 101,
    26, 6, 71, 111, 111, 103, 108, 101
  ]);
  const payload = Uint8Array.from([10, account.length, ...account]);
  const encoded = Buffer.from(payload).toString('base64').replace(/=+$/, '');
  const accounts = TOTP.parseGoogleMigrationUrl(`otpauth-migration://offline?data=${encoded}`);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].name, 'Google (alice)');
  assert.equal(accounts[0].username, 'alice');
  assert.equal(accounts[0].secret, 'AEBAG');
});

test('QR encoder creates a non-empty matrix and SVG', () => {
  const matrix = QRCodeEncoder.encode('ciphervault://recovery?code=test');
  assert.ok(matrix.length > 20);
  assert.match(QRCodeEncoder.renderSvg('test'), /<svg/);
});
