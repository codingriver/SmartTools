# SmartTools - Editable Online Bookmark & Sharing System

> 🌏 [中文版 README](./README_CN.md)

SmartTools is a self-hosted bookmark dashboard for personal links, tools, notes, and lightweight team sharing.

It can run as a pure static site, or as a Cloudflare Pages + Functions app with online editing, multi-user accounts, public share links, inbox-based card sharing, version backups, and browser tab importing.

---

## ✨ Highlights

### 📚 Bookmark Dashboard

- **Multiple card styles**: full-card link (`simple`), clickable description (`desc-clickable`), and expandable groups (`expandable`) with nested sub-cards.
- **Flexible icons**: Emoji, text, image URL, or inline SVG.
- **Visual admin panel**: add, edit, delete, drag-sort, move cards across categories, and manage category visibility directly in the browser.
- **Custom categories**: create, rename, reorder, hide, and configure mobile expand/collapse behavior.
- **Five built-in themes**: Nebula, Notion, Stripe, Dark, and Mint, served through `index1.html` - `index5.html`.
- **Site settings**: configure title, header, footer, default theme, backup behavior, backup retention, and delete-confirmation behavior from the admin UI.

### 🔐 Privacy & Notes

- **Encrypted categories**: any custom category can be encrypted locally with AES-GCM. The server and repository only store ciphertext; unlocking happens in browser memory.
- **Hidden encrypted titles**: locked encrypted categories hide the real title and only show a small unlock entry.
- **Session-only unlock state**: unlock state is stored in `sessionStorage` and disappears when the tab closes; a floating lock button can clear it immediately.
- **Markdown card notes**: any top-level card or sub-card can store a Markdown note/comment. Notes support common Markdown syntax, toolbar editing, and keyboard shortcuts.
- **Encrypted notes**: notes inside encrypted categories are encrypted together with their cards.

### 👥 Multi-User & Sharing

- **Admin + regular users**: administrators can create users, reset passwords, disable/delete accounts, and manage user data boundaries.
- **Per-user data namespaces**: admin data and each user's data, source setting, and backups are stored separately in KV.
- **Public share links**: each user can expose a public slug such as `/u/alice` or `?u=alice`; private/encrypted sections are stripped from public responses.
- **Slug safety**: reserved words, uniqueness checks, old-slug redirects, and IP-based failed-slug lockout help reduce accidental conflicts and enumeration.
- **Inbox sharing**: users can send cards to another user's inbox, include a short Markdown message, and track sent history.
- **Admin push**: admins can push cards to selected users either as inbox items for review or as a forced direct insertion with a visible push badge.
- **Encrypted acceptance flow**: cards sent from encrypted sections can only be accepted into encrypted categories, preserving the privacy boundary.

### 🧰 Data Management

- **Dual deployment modes**:
  - ☁️ **Online mode**: Cloudflare Pages Functions + KV, editable from any device after login.
  - 💻 **Local mode**: directly edit local `data.js` from Chrome/Edge through the File System Access API.
- **Data source switching**: online mode can switch between KV live data and static repository `data.js`.
- **Automatic fallback**: if KV data is unavailable, admin/public pages can fall back to static `data.js` or an empty first-use stub.
- **Backups and restore**: save history is stored per namespace; backups can be listed, previewed, restored, downloaded, or pruned by retention settings.
- **Permanent archives**: forced user deletion archives data, source settings, and backups before cleanup; admins can list, download, and delete archives.
- **Large data split storage**: the backend can store section-level snapshots in KV while still reconstructing a normal `data.js` export.
- **Migration tool**: `/api/migrate-v2` migrates legacy KV keys into the newer `admin:*` namespace safely and idempotently.

### 🧩 Browser Extension

The `extensions/open-tabs-importer` Chrome/Edge extension imports open browser tabs into SmartTools:

- Import the current window or all windows.
- Skip non-HTTP(S) tabs and the SmartTools admin page itself.
- Review selected tabs in the admin UI before inserting.
- Create one expandable parent card with the imported tabs as sub-cards.
- Preserve tab title, URL, and non-base64 favicon URL when available.

---

## 🚀 Getting Started

### Option 1: Cloudflare Pages (Recommended)

1. Fork or import this repository.
2. In Cloudflare Dashboard, go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Use the default build settings:

| Setting | Value |
|---|---|
| Build command | leave empty |
| Build output directory | `/` |

After the first deployment, configure environment variables and KV before using the site.

### Required Environment Variables

Add these variables in **Project → Settings → Environment variables → Production**. Mark them as encrypted secrets.

| Variable | Required | Description |
|---|---|---|
| `ADMIN_USER` | ✅ | Initial administrator username |
| `ADMIN_PASS` | ✅ | Initial administrator password |
| `AUTH_SECRET` | ✅ | Secret used to HMAC-sign session cookies |

Generate a strong `AUTH_SECRET`:

```bash
openssl rand -base64 48
```

Or with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### KV Binding

Create a KV namespace and bind it to the Pages project:

| Variable name | KV namespace |
|---|---|
| `FAV_KV` | Your SmartTools KV namespace |

The binding name must be exactly `FAV_KV`.

### First Login

1. Redeploy the Pages project after setting variables and KV.
2. Open `https://<your-project>.pages.dev/config.html`.
3. Log in with `ADMIN_USER` / `ADMIN_PASS`.
4. Save once from the admin panel to initialize KV data.

### Option 2: Local Mode

1. Clone or download this repository.
2. Serve the folder locally, for example:

```bash
python -m http.server
```

3. Open `http://localhost:8000/config.html` in Chrome or Edge.
4. Choose local mode, create local credentials, connect the project folder, and edit `data.js` directly.

### Option 3: Static Read-Only

Edit `data.js` manually and deploy the repository to any static host. You do not need to expose `config.html`.

---

## 🌐 Public Links

Users can enable a public slug in the admin UI.

Examples:

```text
/u/alice
/u/alice?theme=stripe
/index2.html?u=alice
```

Public responses remove private/encrypted sections before returning data. When a slug is renamed, old-slug redirects can keep previous links working for a limited period.

---

## 🧩 Extension Usage

The unpacked extension lives at `extensions/open-tabs-importer`.

1. Open Chrome/Edge extension management.
2. Enable developer mode.
3. Load `extensions/open-tabs-importer` as an unpacked extension.
4. Open and log in to SmartTools `config.html`.
5. Click the extension and import current-window or all-window tabs.
6. Confirm the generated expandable card in the SmartTools admin UI, then save.

The packaged zip is also included as `extensions/open-tabs-importer.zip`.

---

## 📁 Project Structure

```text
/
├── index.html              # Default entry page
├── index1.html             # Nebula theme
├── index2.html             # Notion theme
├── index3.html             # Stripe theme
├── index4.html             # Dark theme
├── index5.html             # Mint theme
├── config.html             # Admin panel and local-mode editor
├── data.js                 # Static fallback / read-only data
├── shared/                 # Frontend shared modules
│   ├── data-loader.js
│   ├── enc-unlock.js
│   ├── enc-rerender.js
│   ├── fav-page.js
│   ├── note-modal.js
│   ├── zip-adapter.js
│   └── xlsx-adapter.js
├── functions/              # Cloudflare Pages Functions
│   ├── _shared/            # Auth, slug, data split, metadata helpers
│   ├── api/                # JSON APIs
│   └── u/[[slug]].js       # /u/<slug> public share route
├── extensions/
│   └── open-tabs-importer/ # Chrome/Edge open-tabs importer
├── scripts/
│   └── update-timestamp.js
├── screenshot/
└── README.md
```

---

## 🎨 Card Types

| Type | Purpose |
|---|---|
| `simple` | Entire card opens one URL |
| `desc-clickable` | Title/card opens `url`; description opens `descUrl` |
| `expandable` | Parent card expands to show `subCards` |

Sub-cards support two-line cards (`icon`, `title`, `desc`, `url`) and compact cards (`icon`, `content`, `url`).

---

## 🧩 API Reference

### Session & Account

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/login` | No | Login with admin or KV user credentials |
| `POST` | `/api/logout` | No | Clear login cookie |
| `GET` | `/api/check` | No | Session status, role, KV/admin availability, migration hint |
| `POST` | `/api/change-password` | Yes | Logged-in user changes own password |
| `GET/POST/DELETE` | `/api/users` | Admin | List, create/reset, archive/delete users |

### Data & Configuration

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/data` | No | Read active `data.js`; supports `format=json`, `source=kv/static`, `u=<slug>` |
| `GET` | `/api/data-meta` | No | Lightweight version/hash/ETag metadata |
| `POST` | `/api/save` | Yes | Save full data or section-level deltas |
| `POST` | `/api/comment` | Yes | Patch a single card note/comment or remove push badge metadata |
| `GET/POST` | `/api/source` | GET public, POST auth | Read or switch data source |
| `GET/POST` | `/api/site-config` | GET public, POST auth | Read or save site title/theme/backup settings |

### Sharing & Publishing

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/POST/DELETE` | `/api/public-slug` | Yes | Manage public slugs |
| `GET/POST` | `/api/inbox` | Yes | Receive, accept, reject, delete, send, and configure inbox messages |
| `POST` | `/api/push` | Admin | Push cards to selected users as inbox or forced insertion |
| `GET` | `/u/<slug>` | No | Public themed page route |

### Backup, Archive, Migration

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/POST/DELETE` | `/api/backups` | Yes | List, create, preview, restore, delete backups |
| `GET/DELETE` | `/api/archives` | Admin | List, download, and delete permanent user archives |
| `POST` | `/api/migrate-v2` | Admin | Migrate legacy KV keys to `admin:*` namespace |

---

## 🔑 Authentication

- Sessions use an `auth` cookie.
- Tokens are HMAC-SHA256 signed with `AUTH_SECRET`.
- Cookie attributes: `HttpOnly; Secure; SameSite=Strict; Max-Age=604800`.
- KV users are stored with PBKDF2-SHA256 password hashes and per-user salts.
- Legacy SHA-256 user hashes are still readable and are upgraded on successful login or password change.
- Login failures are rate-limited by client IP.

---

## 🔄 Data Model Notes

Current data uses:

```js
var sections = [
  { key: 'usbDriveData', kind: 'card', label: '...', cards: [] }
];
```

Older top-level arrays such as `var usbDriveData = []` are still supported by migration and merge paths.

Important KV namespaces:

| Key pattern | Meaning |
|---|---|
| `admin:data_js` | Admin bookmark data |
| `admin:data_source` | Admin data source setting |
| `admin:backup:<timestamp>` | Admin backups |
| `user:<uid>:data_js` | User bookmark data |
| `user:<uid>:data_source` | User data source setting |
| `user:<uid>:backup:<timestamp>` | User backups |
| `users` | User table and public slug settings |
| `inbox:<uid>:<msgId>` | Inbox message |
| `archive:<uid>:<timestamp>:*` | Permanent deletion archive |

---

## 🖼 Screenshots

### Bookmark Homepage

![Homepage - Notion theme](./screenshot/screenshot1.png)
![Homepage - alternate theme](./screenshot/screenshot2.png)

### Admin Panel

![Admin panel](./screenshot/screenshot3.png)
![Card editor](./screenshot/screenshot4.png)
![Card editor details](./screenshot/screenshot5.png)
![Admin panel details](./screenshot/screenshot6.png)

---

## 📱 Compatibility

- **Bookmark pages**: modern Chrome, Edge, Firefox, Safari, and mobile browsers.
- **Online admin panel**: modern browsers.
- **Local mode**: Chrome 86+ or Edge 86+, served through `http://` or `https://`; `file://` is not supported.
- **Browser extension**: Chromium-based Chrome/Edge with Manifest V3 support.

---

## 🛡️ Security Recommendations

1. Set a strong `AUTH_SECRET`; never use a predictable value.
2. Use strong admin and user passwords.
3. Mark `ADMIN_USER`, `ADMIN_PASS`, and `AUTH_SECRET` as encrypted Cloudflare secrets.
4. Keep Cloudflare Pages HTTPS enabled.
5. Use Cloudflare Access / Zero Trust if the admin panel is shared in a sensitive environment.
6. Use a dedicated password for encrypted categories and store it in a password manager. Lost encrypted-category passwords cannot be recovered.
7. Do not store secrets in plain card notes. Put sensitive notes only inside encrypted categories.
8. Review public slug pages after enabling them to confirm private categories are not intended for public display.

---

## 🔒 Privacy

- Online data stays in your own Cloudflare KV namespace.
- Local mode keeps data and credentials on your local device.
- Public pages filter private/encrypted sections before returning data.
- The browser extension only reads open tab metadata and sends it to your own logged-in SmartTools admin page.

---

## ❓ FAQ

**Q1: I saved data but the frontend did not change.**
Check that `FAV_KV` is bound correctly and that the active source is `kv`.

**Q2: Login says environment variables are missing.**
Confirm `ADMIN_USER`, `ADMIN_PASS`, and `AUTH_SECRET` are configured in the Production environment, then redeploy.

**Q3: I am asked to log in again after refresh.**
`AUTH_SECRET` may have changed or not been applied consistently. Keep it stable and redeploy.

**Q4: How do I develop locally with Cloudflare Functions?**

```bash
npm i -g wrangler
wrangler pages dev . --kv FAV_KV
```

Use `.dev.vars` for local environment variables.

**Q5: How do I back up my data?**
Use the admin panel backup/export tools, or request `/api/data?format=json` and save the returned `content` as `data.js`.

---

## 📝 License

MIT License

---

## 🙏 Acknowledgements

- Hosted with [Cloudflare Pages](https://pages.cloudflare.com/) and [Workers KV](https://developers.cloudflare.com/kv/).
- Some icons come from Emoji sets and official site logos.

---

> If you find this project helpful, please give it a Star ⭐️
