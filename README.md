# CipherVault

CipherVault is a local-first, zero-knowledge password manager and 2FA authenticator built with React and Material UI.

## Features
- Client-side AES-256-GCM encryption with 600k PBKDF2 iterations.
- Strict one-vault-per-username enforcement with password-protected vault deletion and safe profile renaming.
- Dynamic accent color themes (Indigo, Pure Blue, Emerald Green, Sunset Amber, Ruby Red, Cyber Purple) with live real-time previews.
- Gradient background toggle in settings for solid vs gradient aesthetic.
- System OS theme auto-sync, dark/light mode toggle.
- Pin-to-top favorites, password age tracking, and security auditor.
- 2FA QR code generator and TOTP live verification widget.
- Comprehensive item templates, password history, and local backup import/export.

## Getting Started
1. Run `npm install` to install dependencies.
2. Run `npm run dev` to start the local development server.
3. Open `http://localhost:5173` in your browser.
