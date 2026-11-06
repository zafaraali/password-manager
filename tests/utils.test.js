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

test('QR encoder creates a non-empty matrix and SVG', () => {
  const matrix = QRCodeEncoder.encode('ciphervault://recovery?code=test');
  assert.ok(matrix.length > 20);
  assert.match(QRCodeEncoder.renderSvg('test'), /<svg/);
});
