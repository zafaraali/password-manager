# CipherVault

CipherVault is a local-first, zero-knowledge password manager and 2FA authenticator built with React, Material-UI (MUI), and client-side cryptography. All sensitive data is encrypted and decrypted locally in the browser to ensure absolute privacy and security.

## Key Features

### Security and Cryptography
* **Client-Side Encryption:** All vault records are protected using AES-256-GCM.
* **Key Derivation:** Utilizes PBKDF2 with 600,000 iterations and a cryptographically secure salt.
* **Profile Management:** Enforces single-vault-per-username constraints with safe local profile renaming and data migration.
* **Protected Deletion:** Vault deletion requires cryptographic verification via the master password.

### Advanced Power Features
* **Pinned Favorites:** Pin critical items to anchor them to the top of the dashboard.
* **Password Age Tracking:** The security auditor flags credentials older than 90 to 180 days to encourage rotation.
* **2FA QR Generator:** Generate and display `otpauth://` QR codes for stored authenticator accounts.
* **Clipboard Auto-Clear:** Interactive countdown visualizer showing remaining time before copied items are wiped from system memory.
* **Quick Lock:** Lock the vault instantly from the main navigation header.
* **Category Filtering:** Filter items instantly using category pill chips.
* **Custom Icons:** Assign custom emoji badges and favicons to vault items.

### Customization
* **Accent Themes:** Switch between Indigo, Pure Blue, Emerald Green, Sunset Amber, Ruby Red, and Cyber Purple with live real-time previewing.
* **System Theme Sync:** Toggle between Dark, Light, and System Auto-Sync modes.

## Tech Stack

* **Frontend:** React, Vite
* **UI Framework:** Material-UI (MUI)
* **Cryptography:** Web Crypto API (SubtleCrypto AES-GCM and PBKDF2)
* **Storage:** Browser LocalStorage (Zero server persistence)

## Installation and Setup

1. Extract the project archive.
2. Open a terminal in the project directory and install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.
