# CipherVault

CipherVault is a local-first, zero-knowledge password manager and 2FA authenticator combining the best power features of **Bitwarden** and **2FAS**, built with React, Material-UI (MUI), and client-side cryptography. Vault data is encrypted and decrypted locally in the browser. Keep an encrypted backup and its original master password; there is no password reset or recovery code.

## Key Features

### 🛡️ Security & Cryptography
* **Zero-Knowledge Client-Side Encryption:** All vault records and attachments are encrypted using AES-256-GCM.
* **Key Derivation:** PBKDF2 with 600,000 iterations and a cryptographically secure random salt.
* **Quick PIN Session Unlock:** PIN-wrapped keys exist only in page memory. Refreshing, closing the page, or switching profiles requires the master password. Five failed PIN attempts disable quick unlock. Historical persistent PIN wrappers are removed during migration.
* **In-Memory Sessions:** Unlocked keys and plaintext records stay in page memory. Locking discards session state and cancels pending writes. Browser JavaScript cannot guarantee memory zeroization.
* **Profile Management:** Enforces single-vault-per-username constraints with safe local profile renaming and data migration.
* **Protected Deletion:** Vault deletion requires cryptographic verification via the master password.

### 📲 2FAS Authenticator Features
* **Radial Animated Timer Gauge:** Smooth circular countdown ring with dynamic color transitions (Green $\rightarrow$ Amber $\rightarrow$ Pulsing Red in the last 5 seconds).
* **Next Token Preview & Quick Copy:** Inspect the upcoming token ahead of time and copy codes with instant visual confirmation.
* **Live Webcam QR Scanner:** Point your laptop webcam or phone camera at any 2FA barcode to instantly detect and import `otpauth://` accounts.
* **Extended RFC 6238 / RFC 4226 Support:** Supports 6, 7, and 8 digits, SHA-1, SHA-256, and SHA-512 algorithms, custom period intervals (15s, 30s, 60s), and Steam Guard 5-character alphanumeric tokens.
* **In-App 2FA QR Code Generator:** Generate on-screen pairing QR codes to scan tokens directly into your mobile 2FAS app or Google Authenticator.
* **Custom Tags & Groups:** Organize accounts with 2FAS-style tags (`#Work`, `#Personal`, `#Finance`, `#Crypto`) and filter items instantly.
* **Universal 2FA Import & Export:** Two-way compatibility with official `.2fas` backup files, Google Authenticator migration links (`otpauth-migration://`), and raw `otpauth://` links.
* **Encrypted 2FA View:** Authenticate from the lock screen to open the 2FA view. Accounts share vault encryption and auto-lock behavior. Existing unencrypted standalone accounts can be migrated into a chosen unlocked profile; plaintext is removed only after the encrypted save succeeds.

### 🔐 Bitwarden Password Manager Features
* **HaveIBeenPwned (HIBP) Breach Checker:** Audits all vault passwords against billions of leaked credentials using privacy-preserving zero-knowledge k-Anonymity (SHA-1 prefix search).
* **Universal Migration (Import & Export):** Two-way compatibility to import and export standard **Bitwarden JSON exports**, **2FAS backups**, **CSV spreadsheets**, or native encrypted containers.
* **Bitwarden-Grade Security Auditor:**
  * **Breached Passwords Alert:** Flags credentials exposed in public data leaks.
  * **Reused Passwords Detection:** Flags identical passwords shared across multiple accounts.
  * **Missing 2FA Warning:** Discovers login accounts that lack an active 2FA authenticator secret.
  * **Weak Password Analysis:** Flags credentials with low character entropy or length under 12 characters.
  * **Password Age Tracking:** Monitors password modification dates and alerts on credentials older than 90 days.
* **Custom Fields & Backup Codes:** Store supplementary recovery codes, security questions, and API tokens with masked/unmasked secret toggles.
* **Diceware Passphrase Generator:** Generates memorable multi-word passphrases (e.g. `galaxy-falcon-matrix-orbit-42`) alongside classic high-entropy random character passwords.
* **Pinned Favorites:** Anchor your most frequently used credentials to the top of the vault.
* **1-Click Website Launchers:** Store login URLs and launch websites directly in a new browser tab with automatic favicon resolution.
* **Password History & Rollback:** Maintains version control of your previous passwords so you can recover earlier credentials at any time.
* **Global Power Shortcuts:** `Ctrl + K` or `/` to search, `Ctrl + L` to lock, `Esc` to close modals.
* **Clipboard Auto-Clear:** Automatic clipboard clearing after a configurable timeout (default 30s) to keep secrets safe from memory scrapers.

### 📱 Progressive Web App (PWA)
* **Installable Native App:** Install CipherVault on Windows, macOS, Android, and iOS as a standalone desktop or mobile application.
* **Offline Access:** Previously loaded app views and encrypted local vaults can work offline. Breach checks and clock synchronization require a network connection.

### 🎨 Customization
* **Accent Themes:** Switch between Indigo, Pure Blue, Emerald Green, Sunset Amber, Ruby Red, and Cyber Purple with live real-time previewing.
* **System Theme Sync:** Toggle between Dark, Light, and System Auto-Sync modes.

## Tech Stack

* **Frontend:** React, Vite
* **UI Framework:** Material-UI (MUI) & Emotion
* **Cryptography:** Web Crypto API (`crypto.subtle` AES-GCM and PBKDF2)
* **Storage:** Browser LocalStorage with atomic profile records, Web Locks transactions, revision checks, and one retained previous encrypted version (no server persistence)

## Data safety and backups

Use HTTPS or localhost in a browser with Web Locks support. Existing vaults are migrated before old storage keys are removed. Storage write failures preserve the committed vault. Concurrent tabs reject stale edits and lock when another tab changes their vault.

Replacing a vault requires explicit confirmation. Backup imports must decrypt with the original master password and pass schema validation before replacement. Export the retained previous encrypted version from the Export dialog if needed, then import it using that version's original master password. The previous version is replaced on each successful vault write and is deleted with its profile; it is not a substitute for an external backup. Deleted items can remain in that previous encrypted version until the next write.

Old recovery codes were never connected to a recovery mechanism and cannot recover a vault. They are no longer generated or included in exports. Keep the original master password; a separate export password provides an additional encryption layer and does not replace it.

## Installation and Setup

1. Open a terminal in the project directory:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.
