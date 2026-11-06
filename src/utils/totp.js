/**
 * Lightweight & Feature-Complete TOTP / 2FA Engine
 * RFC 6238 & RFC 4226 Compliant with 2FAS & Bitwarden Interoperability
 * Includes Clock Drift Synchronization Compensation (2FAS Feature)
 */
export class TOTP {
  static STEAM_ALPHABET = '23456789BCDFGHJKMNPQRTVWXY';

  static base32toHex(base32) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let hex = '';

    const clean = (base32 || '').toUpperCase().replace(/[\s=-]/g, '');

    for (let i = 0; i < clean.length; i++) {
      const val = base32chars.indexOf(clean.charAt(i));
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }

    for (let i = 0; i + 4 <= bits.length; i += 4) {
      const chunk = bits.substr(i, 4);
      hex += parseInt(chunk, 2).toString(16);
    }
    return hex;
  }

  static hexToBase32(hex) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (let i = 0; i < hex.length; i++) {
      bits += parseInt(hex[i], 16).toString(2).padStart(4, '0');
    }
    let base32 = '';
    for (let i = 0; i + 5 <= bits.length; i += 5) {
      const chunk = bits.substr(i, 5);
      base32 += base32chars[parseInt(chunk, 2)];
    }
    return base32;
  }

  static getClockOffset() {
    try {
      return parseInt(localStorage.getItem('ciphervault_clock_drift') || '0', 10);
    } catch (e) {
      return 0;
    }
  }

  static async syncClockDrift() {
    try {
      const start = Date.now();
      const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', { cache: 'no-store' });
      if (!res.ok) throw new Error('Time API unreachable');
      const data = await res.json();
      const end = Date.now();
      const roundTrip = (end - start) / 1000;
      const serverEpoch = Math.floor(new Date(data.utc_datetime).getTime() / 1000) + Math.floor(roundTrip / 2);
      const localEpoch = Math.floor(Date.now() / 1000);
      const driftSeconds = serverEpoch - localEpoch;
      localStorage.setItem('ciphervault_clock_drift', driftSeconds.toString());
      return driftSeconds;
    } catch (err) {
      return null;
    }
  }

  static resetClockOffset() {
    try {
      localStorage.removeItem('ciphervault_clock_drift');
    } catch (e) {}
  }

  /**
   * Generates a TOTP code supporting 6/8 digits, SHA-1/256/512, custom period, or Steam Guard.
   */
  static async generate(secret, config = {}) {
    try {
      if (!secret) return '------';

      let cleanSecret = secret;
      let window_time = typeof config === 'number' ? config : (config.period || config.window_time || 30);
      let digits = config.digits || 6;
      let algorithm = (config.algorithm || 'SHA-1').toUpperCase();
      let isSteam = config.isSteam || false;
      let epochOffset = config.epochOffset || 0;

      if (typeof secret === 'string' && secret.startsWith('otpauth://')) {
        const parsed = this.parseOtpAuthUrl(secret);
        if (parsed.secret) cleanSecret = parsed.secret;
        if (parsed.period) window_time = parsed.period;
        if (parsed.digits) digits = parsed.digits;
        if (parsed.algorithm) algorithm = parsed.algorithm;
        if (parsed.isSteam) isSteam = true;
      }

      if (typeof secret === 'string' && secret.toLowerCase().includes('steam')) {
        isSteam = true;
      }

      cleanSecret = cleanSecret.replace(/\s+/g, '').replace(/=+$/, '');
      const hexKey = this.base32toHex(cleanSecret);
      if (!hexKey) return 'Invalid 2FA';

      const clockDrift = this.getClockOffset();
      const epoch = Math.floor(Date.now() / 1000) + clockDrift + epochOffset;
      const time = Math.floor(epoch / window_time);
      const timeHex = time.toString(16).padStart(16, '0');
      
      const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      const timeBytes = new Uint8Array(timeHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

      let hashName = 'SHA-1';
      if (algorithm.includes('256')) hashName = 'SHA-256';
      else if (algorithm.includes('512')) hashName = 'SHA-512';

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: hashName } },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBytes);
      const hmacResult = new Uint8Array(signature);

      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const binary = 
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

      if (isSteam) {
        let fullCode = binary;
        let steamCode = '';
        for (let i = 0; i < 5; i++) {
          steamCode += this.STEAM_ALPHABET[fullCode % this.STEAM_ALPHABET.length];
          fullCode = Math.floor(fullCode / this.STEAM_ALPHABET.length);
        }
        return steamCode;
      }

      const modulus = Math.pow(10, digits);
      const otp = binary % modulus;
      return otp.toString().padStart(digits, '0');
    } catch (err) {
      return 'Error';
    }
  }

  static getTimeRemaining(window_time = 30) {
    const clockDrift = this.getClockOffset();
    const epoch = Math.floor(Date.now() / 1000) + clockDrift;
    return window_time - (epoch % window_time);
  }

  static parseOtpAuthUrl(urlStr) {
    try {
      const url = new URL(urlStr);
      if (url.protocol !== 'otpauth:') return { secret: urlStr };

      const type = url.host; // 'totp' or 'hotp'
      const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
      let issuer = url.searchParams.get('issuer') || '';
      let account = label;

      if (label.includes(':')) {
        const parts = label.split(':');
        if (!issuer) issuer = parts[0];
        account = parts.slice(1).join(':').trim();
      }

      return {
        type,
        secret: url.searchParams.get('secret') || '',
        issuer: issuer.trim(),
        account: account.trim(),
        algorithm: url.searchParams.get('algorithm') || 'SHA-1',
        digits: parseInt(url.searchParams.get('digits') || '6', 10),
        period: parseInt(url.searchParams.get('period') || '30', 10),
        isSteam: (issuer || label).toLowerCase().includes('steam')
      };
    } catch (e) {
      return { secret: urlStr };
    }
  }

  static buildOtpAuthUrl({ issuer = '', name = '', secret = '', period = 30, digits = 6, algorithm = 'SHA1' }) {
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const label = issuer ? `${encodeURIComponent(issuer)}:${encodeURIComponent(name || issuer)}` : encodeURIComponent(name || 'CipherVault');
    let url = `otpauth://totp/${label}?secret=${cleanSecret}`;
    if (issuer) url += `&issuer=${encodeURIComponent(issuer)}`;
    if (period && period !== 30) url += `&period=${period}`;
    if (digits && digits !== 6) url += `&digits=${digits}`;
    if (algorithm && algorithm !== 'SHA1') url += `&algorithm=${algorithm}`;
    return url;
  }

  static parseGoogleMigrationUrl(urlStr) {
    try {
      let dataParam = '';
      if (urlStr.includes('data=')) {
        const parts = urlStr.split('data=');
        if (parts[1]) {
          dataParam = decodeURIComponent(parts[1].split('&')[0]);
        }
      } else {
        const url = new URL(urlStr);
        dataParam = url.searchParams.get('data');
      }

      if (!dataParam) throw new Error('Missing data parameter in migration URL');
      return this.parseProtobufMigrationBase64(dataParam);
    } catch (err) {
      throw new Error('Failed to parse Google Authenticator migration payload: ' + err.message);
    }
  }

  static parseProtobufMigrationBase64(b64Str) {
    const binStr = atob(b64Str.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
    
    let accounts = [];
    let i = 0;

    while (i < bytes.length) {
      const tag = bytes[i++];
      const wireType = tag & 0x07;
      const fieldNum = tag >> 3;

      if (wireType === 2) {
        let length = 0;
        let shift = 0;
        while (i < bytes.length) {
          const b = bytes[i++];
          length |= (b & 0x7f) << shift;
          if (!(b & 0x7f)) break;
          shift += 7;
          if (shift >= 28) break;
        }

        const fieldData = bytes.slice(i, i + length);
        i += length;

        if (fieldNum === 1) {
          const acc = this.parseOtpParameters(fieldData);
          if (acc) accounts.push(acc);
        }
      } else if (wireType === 0) {
        while (i < bytes.length && (bytes[i++] & 0x80));
      } else {
        break;
      }
    }

    return accounts;
  }

  static parseOtpParameters(bytes) {
    let i = 0;
    let secretBytes = null;
    let name = 'Google Auth Account';
    let issuer = '';

    while (i < bytes.length) {
      const tag = bytes[i++];
      const wireType = tag & 0x07;
      const fieldNum = tag >> 3;

      if (wireType === 2) {
        let length = 0;
        let shift = 0;
        while (i < bytes.length) {
          const b = bytes[i++];
          length |= (b & 0x7f) << shift;
          if (!(b & 0x7f)) break;
          shift += 7;
        }
        const valBytes = bytes.slice(i, i + length);
        i += length;

        if (fieldNum === 1) {
          secretBytes = valBytes;
        } else if (fieldNum === 2) {
          name = new TextDecoder().decode(valBytes);
        } else if (fieldNum === 3) {
          issuer = new TextDecoder().decode(valBytes);
        }
      } else if (wireType === 0) {
        while (i < bytes.length && (bytes[i++] & 0x80));
      } else {
        break;
      }
    }

    if (!secretBytes) return null;

    let hex = '';
    for (let b of secretBytes) {
      hex += b.toString(16).padStart(2, '0');
    }
    const base32Secret = this.hexToBase32(hex);

    return {
      name: issuer ? `${issuer} (${name})` : name,
      username: name,
      secret: base32Secret
    };
  }

  static parse2FasJson(jsonObj) {
    const accounts = [];
    const services = jsonObj.services || jsonObj.items || (Array.isArray(jsonObj) ? jsonObj : []);
    
    services.forEach(svc => {
      const name = svc.name || svc.issuer || '2FAS Service';
      const secret = svc.secret || (svc.otp && svc.otp.secret) || '';
      const email = svc.email || svc.account || '';
      if (secret) {
        accounts.push({
          name: name,
          username: email,
          secret: secret
        });
      }
    });

    return accounts;
  }
}
