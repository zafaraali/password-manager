/**
 * Lightweight TOTP Code Generator for 2FA & Google Auth / 2FAS Decoder
 */
export class TOTP {
  static base32toHex(base32) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let hex = '';

    for (let i = 0; i < base32.length; i++) {
      const val = base32chars.indexOf(base32.toUpperCase().charAt(i));
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

  static async generate(secret, window_time = 30) {
    try {
      if (!secret) return '------';
      const cleanSecret = secret.replace(/\s+/g, '').replace(/=+$/, '');
      const hexKey = this.base32toHex(cleanSecret);
      if (!hexKey) return 'Invalid 2FA';

      const epoch = Math.floor(Date.now() / 1000);
      const time = Math.floor(epoch / window_time);
      
      const timeHex = time.toString(16).padStart(16, '0');
      
      const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      const timeBytes = new Uint8Array(timeHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
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

      const otp = binary % 1000000;
      return otp.toString().padStart(6, '0');
    } catch (err) {
      return 'Error';
    }
  }

  static getTimeRemaining(window_time = 30) {
    const epoch = Math.floor(Date.now() / 1000);
    return window_time - (epoch % window_time);
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
