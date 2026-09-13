# Nimbus — Personal Cloud Storage (Final Year Project)

A simplified Google Drive clone: users register, log in, organize files into
folders, preview them, share them via public links, and upload/download/
rename/delete — all from any browser. Built with Node.js, Express, and
MongoDB Atlas — no third-party file storage service required.

**Features**
- Email/password accounts with JWT-based login (passwords hashed with bcrypt)
- Upload / download / rename / delete files
- **Folders** — create, navigate (with breadcrumbs), delete (cascades to
  everything inside)
- **Search** — find a file by name across every folder
- **Preview** — images and PDFs open in an in-browser preview modal instead
  of forcing a download
- **Sharing** — generate a public link for any file (with an optional
  expiry), so anyone with the link can view/download it without an account;
  revoke it any time
- **NFC tag sharing** — write a share link onto a physical NFC tag so
  anyone can tap their phone on it to open the file (Chrome on Android only
  — see section 7, "About NFC sharing," for why phone-to-phone beaming
  itself isn't possible on the web)
- Per-user storage quota with a live usage bar

---

## 1. How it works (for your project explanation)

```
Browser (public/ — plain HTML, CSS, JS)
        |  fetch() calls with a JWT in the Authorization header
        v
Express server (server.js + routes/)
        |
        |-- routes/auth.js   -> register / login / get current user
        |-- routes/files.js  -> upload / list / download / delete files
        |
        v
MongoDB Atlas (cloud database)
        |-- "users" collection        -> accounts, hashed passwords, storage used
        |-- "uploads.files" collection -> file metadata (name, size, owner)
        |-- "uploads.chunks" collection -> the actual file bytes, in 255KB chunks
```

**Key ideas to mention in your defense:**

- **Authentication**: passwords are hashed with `bcrypt` before saving — the
  raw password is never stored. On login, a **JWT (JSON Web Token)** is
  issued and the browser stores it in `localStorage`. Every protected
  request sends it back as `Authorization: Bearer <token>`, and
  `middleware/auth.js` verifies it before allowing access.
- **File storage = GridFS**: instead of paying for AWS S3/Cloudinary, files
  are stored *inside MongoDB Atlas itself* using MongoDB's built-in
  **GridFS** system, which automatically splits big files into small chunks
  and reassembles them on download. This is why the app needs only one
  external service (Atlas) and one connection string.
- **Ownership**: every file document has `metadata.owner` set to the
  uploader's user ID, so the file list/download/delete routes only ever
  return files that belong to the logged-in user.
- **Storage quota**: each user has a `storageUsed` counter on their account,
  compared against `MAX_STORAGE_MB` from `.env`, so the dashboard can show a
  usage bar like Google Drive's.
- **Folders**: a lightweight `Folder` collection stores `{ name, owner,
  parent }`. Every file's GridFS metadata stores which folder it belongs to
  (`metadata.folder`, `null` = root). Deleting a folder walks the tree
  (breadth-first) to find every nested folder and file before removing them.
- **Preview**: the dashboard requests `/api/files/:id/preview` with the JWT,
  turns the response into a `Blob`, and displays it via
  `URL.createObjectURL()` in an `<img>` or `<iframe>` — so protected files
  can still be shown inline without exposing a raw, unauthenticated URL.
- **Sharing**: generating a link creates a random token
  (`crypto.randomBytes`) stored on the file's GridFS metadata
  (`metadata.shareToken`, plus an optional `metadata.shareExpires`). The
  public `/api/share/:token...` routes require no login at all — they just
  look up the file by token and check it hasn't expired. Revoking a link
  simply clears the token.

---

## 2. Project structure

```
cloud-drive/
├── server.js              # app entry point
├── config/db.js           # connects to MongoDB Atlas
├── models/User.js         # user schema (name, email, hashed password, storageUsed)
├── middleware/auth.js     # verifies the JWT on protected routes
├── models/Folder.js        # folder schema (name, owner, parent)
├── routes/auth.js          # /api/auth/register, /login, /me
├── routes/files.js         # /api/files (upload, list, download, preview, rename, delete, share)
├── routes/folders.js       # /api/folders (create, list, breadcrumb path, rename, delete)
├── routes/share.js         # /api/share/:token — PUBLIC routes, no login required
├── public/                 # frontend (no framework — plain HTML/CSS/JS)
│   ├── login.html / register.html / dashboard.html / share.html
│   ├── css/style.css
│   └── js/ (auth.js, login.js, register.js, dashboard.js)
├── .env.example            # template — copy to .env and fill in
└── package.json
```

---

## 3. Setup — step by step

### Step 1 — Install dependencies
```bash
cd cloud-drive
npm install
```

### Step 2 — Create your MongoDB Atlas cluster
1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (free).
2. Click **"Build a Database"** → choose the **free M0** tier → pick any
   cloud provider/region close to you → **Create**.
3. **Create a database user**: sidebar → *Database Access* → *Add New
   Database User* → Password auth → set a username and password (write
   these down, you'll need them).
4. **Allow network access**: sidebar → *Network Access* → *Add IP Address*
   → click **"Allow Access from Anywhere"**. This adds the entry
   `0.0.0.0/0`, meaning any IP can attempt to connect (the database user's
   password is still required). This is fine for a student project running
   locally or on a free host; for a real production app you'd restrict it.
5. **Get your connection string**: sidebar → *Database* → click **Connect**
   on your cluster → **Drivers** → copy the string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` / `<password>` with the database user from step 3,
   and add a database name before the `?`, e.g.:
   ```
   mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/cloudDrive?retryWrites=true&w=majority
   ```

### Step 3 — Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `MONGODB_URI` — the connection string from Step 2.
- `JWT_SECRET` — generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `PORT` — leave as `5000` unless it's already in use.
- `MAX_STORAGE_MB` — per-user quota shown on the dashboard (default 1024 = 1GB).

### Step 4 — Run the app
```bash
npm start
```
You should see:
```
✅ MongoDB Atlas connected: cluster0-xxxxx.mongodb.net
🚀 Cloud Drive server running at http://localhost:5000
```
Open **http://localhost:5000** in your browser, register an account, and
start uploading files.

For auto-restart while developing:
```bash
npm run dev
```

### Step 5 — Try every feature
1. Register two accounts (e.g. in two browser tabs, one normal + one
   incognito) to prove each user only sees their own files.
2. Click **"+ New folder"**, name it, open it — the breadcrumb at the top
   updates and lets you navigate back up.
3. Drag a file onto the dropzone (or use **Upload file**) — try uploading
   it both at the root and while inside a folder.
4. Click **Preview** on an image or PDF to see it open inline in a modal
   instead of downloading.
5. Click **Share** on a file, pick an expiry (or "never"), click **Generate
   share link**, then open that link in an incognito window — it works with
   no login. Click **Revoke link** afterwards and confirm the old link now
   shows "invalid or has expired".
6. Type into the **search box** — it searches file names across every
   folder, not just the one you're in.
7. Use **Rename** and **Delete** on a file, and **Delete** on a folder (this
   removes everything inside it too — try creating a folder with a file in
   it, then deleting the folder).

---

## 4. Quick API reference

All routes are prefixed with `/api`. Protected routes need
`Authorization: Bearer <token>` (the frontend handles this automatically
once you're logged in).

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | – | Create an account |
| POST | `/auth/login` | – | Log in, get a JWT |
| GET | `/auth/me` | ✅ | Current user's profile |
| GET | `/files?folderId=&q=` | ✅ | List files in a folder, or search by name |
| POST | `/files/upload` | ✅ | Upload a file (multipart: `file`, optional `folderId`) |
| GET | `/files/:id/download` | ✅ | Download a file |
| GET | `/files/:id/preview` | ✅ | Stream a file inline (for the preview modal) |
| PATCH | `/files/:id` | ✅ | Rename a file (`{ name }`) |
| DELETE | `/files/:id` | ✅ | Delete a file |
| POST | `/files/:id/share` | ✅ | Create/refresh a public share link (`{ expiresInHours }`) |
| DELETE | `/files/:id/share` | ✅ | Revoke a share link |
| GET | `/folders?parent=` | ✅ | List subfolders of a folder (omit for root) |
| POST | `/folders` | ✅ | Create a folder (`{ name, parentId }`) |
| GET | `/folders/:id/path` | ✅ | Breadcrumb chain from root to this folder |
| PATCH | `/folders/:id` | ✅ | Rename a folder |
| DELETE | `/folders/:id` | ✅ | Delete a folder and everything inside it |
| GET | `/share/:token` | – (public) | Metadata for a shared file |
| GET | `/share/:token/download` | – (public) | Download a shared file |
| GET | `/share/:token/preview` | – (public) | Inline preview of a shared file |

---

## 5. Troubleshooting

- **"MongoDB connection error"** on startup → double-check `MONGODB_URI` in
  `.env` (username/password correct, database user has "Read and write to
  any database", and Network Access has an entry allowing your IP or
  `0.0.0.0/0`).
- **Login works but every request after says "Invalid or expired token"** →
  make sure `JWT_SECRET` in `.env` didn't change after you logged in (that
  invalidates old tokens) — just log in again.
- **Uploads fail instantly** → check the file isn't over the 50MB limit set
  in `routes/files.js` (`multer({ limits: { fileSize: ... } })`), and that
  you haven't exceeded `MAX_STORAGE_MB`.
- **Share link says "invalid or has expired"** → the link was revoked, or
  the expiry time you chose has passed — generate a new one from the Share
  modal.

---

## 6. Deploying to Vercel

The app is configured to run as a Vercel Serverless Function through a tiny
entry file at `api/index.js` (Vercel auto-detects anything under `/api` as
a function) which just re-exports the real Express app from `server.js`.
`vercel.json` then rewrites every request — both `/api/...` calls and the
frontend pages — to that one function.

Vercel deployments don't read your local `.env` file (it's gitignored on
purpose, so your secrets never get pushed to GitHub). You have to add the
same variables again in Vercel's dashboard:

1. Push this project to a GitHub repo, then import it in Vercel
   (**Add New → Project**).
2. Before or after the first deploy, go to your project in Vercel →
   **Settings → Environment Variables** and add:
   - `MONGODB_URI` — your full Atlas connection string (same one from
     Step 2/3 above)
   - `JWT_SECRET` — the same random string from your local `.env`
   - `MAX_STORAGE_MB` — e.g. `1024`
3. **Redeploy** after adding variables — Vercel only picks them up on a new
   deployment, not automatically for one already running (Project →
   **Deployments** → ⋯ menu → **Redeploy**).
4. In Atlas, double-check **Network Access** still has `0.0.0.0/0` allowed
   — Vercel's serverless functions run on rotating IPs, not one fixed
   address, so you can't whitelist a specific IP here.

If a route 404s, it means the request never reached the function at all —
double check `api/index.js` and `vercel.json` both actually got committed
and pushed (`git status` locally, and confirm they show up in the file list
on the Vercel deployment's "Source" tab). If a route 500s instead, that
means it *did* reach your code — check **Vercel → your project →
Deployments → (latest) → Functions/Logs** for the real error message (e.g.
"bad auth" for a mistyped credential, or "querySrv ENOTFOUND" for a
malformed URI).

---

## 7. About NFC sharing

**What you asked for** (tap two phones together and a file transfers
directly between them) **is not something any website can do.** Chrome's
own Web NFC documentation states this explicitly: peer-to-peer NFC
communication between two devices is out of scope for the browser API —
only native Android apps can do true phone-to-phone NFC "beaming," and even
that feature (Android Beam) was deprecated by Google in 2019.

**What a website *can* do, and what this project implements instead:** use
a cheap physical NFC tag (a coin-sized sticker, ~$0.30–$1 each — search
"NTAG213 NFC stickers") as the middleman:

1. Open a file's **Share** modal and generate a link, same as before.
2. If you're on **Chrome for Android**, a **"Write to NFC tag"** button
   appears. Tap it, then hold your phone against a blank NFC tag — the
   share link gets written onto the tag.
3. From then on, **any phone** (Android or iPhone, any browser, no app
   needed) that taps that tag will have its OS automatically open a browser
   straight to that shared file. This part is standard NFC behavior built
   into every modern phone — it isn't something this app has to implement.

This is real, working NFC functionality end-to-end; it's just tag-mediated
rather than phone-to-phone, because that's the actual limit of what a
browser is allowed to do with NFC hardware.

**Requirements to actually test the write step:**
- An Android phone running Chrome (Web NFC does not exist on iPhone/Safari
  at all — global browser support is roughly 6%, Android Chrome/Samsung
  Internet only).
- NFC turned on in the phone's settings.
- A real writable NFC tag nearby (Web NFC cannot write to another phone —
  only to a physical tag).
- **HTTPS.** Web NFC only runs in a "secure context." If you're testing by
  opening your laptop's local IP (e.g. `http://192.168.1.5:5000`) from your
  phone, that will **not** work — plain HTTP over the network isn't secure.
  Two easy ways around this for a demo:
  - Deploy the app somewhere with free HTTPS (Render, Railway, Vercel for
    the frontend + a Node host, etc.) and open that URL on your phone.
  - Or, plug your Android phone into your laptop via USB, enable USB
    debugging, and run `adb reverse tcp:5000 tcp:5000` — this makes
    `http://localhost:5000` on the phone tunnel straight to your laptop,
    and `localhost` always counts as a secure context even without HTTPS.
- The Nimbus tab has to stay open and in the foreground, and the phone
  screen unlocked, while you tap the tag — NFC is suspended for background
  tabs and locked screens.

If your examiner asks why it isn't literally phone-to-phone, this
limitation (and the Chrome documentation confirming it) is worth
mentioning directly — it shows you understood the platform rather than
just not implementing the feature.

---

## 8. Demoing it in your presentation

1. Show `Network Access` and `Database Access` in Atlas to explain security.
2. Register two different accounts in two browser tabs (or one normal + one
   incognito) to show that each user only ever sees their own files.
3. Open Atlas → **Browse Collections** → show the `users`, `uploads.files`,
   and `uploads.chunks` collections filling up live as you upload files —
   this is a great visual to show the examiner where the data actually
   lives.
4. Mention the quota bar and try uploading past `MAX_STORAGE_MB` to show
   the validation working.

---

## 9. Possible extensions (mention as "future work" if asked)

- Moving files between folders (drag-and-drop)
- Sort options (by name / size / date)
- File versioning
- Email verification on registration
- Sharing a whole folder, not just single files
#   N i m b u s - c l o u d  
 #   N i m b u s - c l o u d  
 #   N i m b u s - c l o u d  
 