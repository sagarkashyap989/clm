# CML — Client Delivery Test Guide

Use this document to exercise **every user-facing feature** before handing the Contract Management System (CML) to a client. Treat it as a manual UAT checklist, not automated unit tests.

**Pass rule:** a feature is done only if the expected result happens in the browser (or Mailhog / API) **and** nothing else breaks on related screens.

---

## 1. What you are testing

CML is a contract workspace with:

| Area | What it covers |
| --- | --- |
| Auth | Register, login, logout, session refresh, email verify, forgot/reset password |
| Organization & RBAC | Org name, invites, accept invite, roles (`admin`, `manager`, `member`), remove members |
| Profile | Display name, change password |
| Dashboard | Metrics, recent / pending / shared tabs, upload shortcut |
| Contract repository | Upload, search, filter, sort, status change, delete |
| Contract workspace | Metadata, status, editor, PDF view, drafts, versions, compare |
| Collaboration | Comments, chat, notifications |
| Sharing | Internal shares and external links (**see known gaps**) |

---

## 2. Choose the correct environment (do this first)

The web app can run against **two backends**. Mixing them up will produce false passes.

### Mode A — Live API (required for client delivery)

This is the real stack: Express + MongoDB + cookies + Mailhog.

1. In `apps/web/.env.local` set:

   ```
   VITE_USE_MOCK=false
   ```

2. Root `.env` must include at least:

   - `CLIENT_URL` — must match the **exact** web origin (scheme + host + port), e.g. `http://localhost:3000`
   - `MONGODB_URI`
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
   - `SMTP_HOST` / `SMTP_PORT` (Mailhog: `localhost` / `1025`)

3. Start infrastructure and apps:

   ```bash
   docker compose up -d
   npm run build --workspace=@cml/shared
   npm run dev --workspace=@cml/api
   npm run dev --workspace=@cml/web
   ```

4. Confirm:

   | Service | URL |
   | --- | --- |
   | Web | http://localhost:3000 |
   | API health | http://localhost:5000/health → `{ "status": "ok" }` |
   | Mailhog | http://localhost:8025 |

If login works but API calls fail with CORS, `CLIENT_URL` does not match the browser origin.

### Mode B — Vite in-memory mock (UI-only / demo)

If `VITE_USE_MOCK` is omitted or not `false`, Vite intercepts `/api/v1/*` and **does not** persist to MongoDB. Sharing, seed contracts, and notifications appear immediately. **Do not sign off client delivery on mock mode alone.**

---

## 3. Known gaps (record on the delivery report)

Test these so you can tell the client what is real vs demo:

| Item | Live API today | Notes |
| --- | --- | --- |
| Contract **Share** (internal + external link) | UI exists; **no** `/shares` or `/shared-with-me` routes on Express | Expect 404 / empty “Shared with me” against live API |
| Dashboard **Shared with me** count | Always `0` on live API | Placeholder until sharing is persisted |
| PDF viewer | Simulated pages; **download is the original file** | Viewer still does not render real PDF pages |
| File storage (MinIO / S3) | Live: files stored in MinIO (or local `uploads/` fallback) | Word/TXT imported into the editor; original download works |
| Audit logs | Written in MongoDB | **No** in-app audit UI |
| Automated tests | `npm run test --workspace=@cml/api` (auth/RBAC) | Web has no UI tests |

---

## 4. Test identities (create these on live API)

Use unique emails each run so leftover data does not confuse results.

| Alias | How to create | Org role | Password |
| --- | --- | --- | --- |
| **Admin A** | Register with a new organization name | `admin` (automatic) | ≥ 8 characters |
| **Manager B** | Admin A invites with role `manager`, then accept | `manager` | ≥ 8 characters |
| **Member C** | Admin A invites with role `member`, then accept | `member` | ≥ 8 characters |
| **Outsider D** | Register a **second** organization | `admin` of org 2 | ≥ 8 characters |

Keep two browsers (or one browser + one private window) so Admin A and Member C can be logged in at the same time for comments, chat, and notifications.

---

## 5. How to use the checklists

For each row: perform the **steps**, then mark **Pass / Fail / N/A**.

Record: date, tester, environment (live vs mock), browser (Chrome + one other), viewport (desktop ~1280px and mobile ~375px for shell/nav).

---

## 6. Smoke (must pass before deep testing)

- [ ] `GET http://localhost:5000/health` returns OK
- [ ] Web loads without a blank screen
- [ ] Landing **Get started** → `/register`, **Sign in** → `/login`
- [ ] Logged-out visit to `/dashboard` redirects to `/login`
- [ ] Logged-in visit to `/login` or `/register` redirects to `/dashboard`
- [ ] Unknown URL (e.g. `/nope`) redirects to landing `/`

---

## 7. Authentication

### 7.1 Register (new organization)

1. Open `/register`.
2. Submit empty form → field errors (name, email, password, organization).
3. Password shorter than 8 characters → validation error.
4. Invalid email → validation error.
5. Valid data → lands on `/dashboard`.
6. Sidebar shows org name, user name, role **admin**.
7. Register the same email again → error, no second account.

**Expected:** HttpOnly cookies are set (Application → Cookies). Page refresh keeps you logged in.

### 7.2 Login / logout / session

1. Log out from the sidebar.
2. Wrong password → error, stay on login.
3. Correct credentials → dashboard.
4. Optional: `/login?next=/contracts` after logout → after login, you go to `/contracts`.
5. Log out → cannot open `/contracts` without signing in again.
6. Wait for access-token expiry (default ~15 minutes) while staying on a protected page, then trigger an action (e.g. open Contracts). Session should **refresh** without forcing a full re-login (refresh cookie still valid).

### 7.3 Email verification

1. After register, open Mailhog.
2. Open the verification link (`/verify-email?token=...`).
3. Success message; **Continue** works.
4. Open `/verify-email` with no token → error.
5. Reuse the same token → should fail or no longer succeed (one-time token).

### 7.4 Forgot / reset password

1. `/forgot-password` with unknown email → generic success (no account enumeration).
2. Known email → Mailhog reset link (`/reset-password?token=...`).
3. New password &lt; 8 chars → validation error.
4. Valid reset → redirect to login; old password fails; new password works.
5. Missing token on reset page → submit disabled or error.

---

## 8. Organization, invites, RBAC

Organization roles in this product: **`admin`**, **`manager`**, **`member`**.

### 8.1 Organization settings (`/settings`)

| Actor | Rename organization | Invite | Change role | Remove member |
| --- | --- | --- | --- | --- |
| Admin | Yes | Yes | Yes | Yes (not self) |
| Manager | Message: only admins | No invite form | Read-only role | No |
| Member | Same as manager | Same | Same | Same |

**Steps**

1. As admin: change org name → save → name updates in sidebar and header.
2. As manager/member: confirm no rename form (or save is blocked).
3. Invite Manager B and Member C (**they must already have accounts**; both roles).
4. Pending invitations list shows waiting invites.
5. Invite an email with no account → error.
6. Invite an existing member email → error.
7. Invalid email → validation error.

### 8.2 Accept invitation

1. Sign in as the invited user (any of their orgs).
2. Open the bell → invitation notification for Org A.
3. Click **Accept invite** → dashboard switches to Org A with the invited role.
4. After accept, invite disappears from pending list; member appears in Members.
5. Inviting a user who is already a member still errors.

### 8.3 Role change and removal

1. Admin changes Member C to `manager` then back to `member`.
2. Admin removes Member C → confirm dialog → user gone from list.
3. Removed user login still works but **must not** see Org A contracts (no membership).
4. Admin cannot remove themselves (no Remove on own row).

### 8.4 Tenant isolation (critical)

1. Admin A creates a contract in Org A.
2. Outsider D logs in (Org B).
3. D must **not** see Org A contracts in repository or by guessing `/contracts/<org-a-id>`.
4. Direct API/browser access to another org’s contract id → not found / forbidden.

---

## 9. Profile (`/profile`)

1. Change display name → save → name updates in header/sidebar.
2. Empty name → validation error.
3. Change password with **wrong** current password → error, stay logged in.
4. Correct current + new password (≥ 8) → logged out, redirected to login.
5. Login with new password works.

---

## 10. Navigation and shell

Test **desktop** and **mobile** (narrow viewport).

- [ ] Links: Dashboard, Contracts, Organization, Profile
- [ ] Active nav highlight
- [ ] Org name, user, role visible
- [ ] Notification bell visible (header desktop + mobile)
- [ ] Log out
- [ ] Mobile: top bar + horizontal nav usable

---

## 11. Dashboard (`/dashboard`)

1. Greeting uses first name; org and role are correct.
2. **Upload Contract** opens the same upload modal as the repository.
3. **View Repository** goes to `/contracts`.
4. Metric cards:
   - Total contracts
   - Pending review
   - Recently updated
   - Shared with me
5. After creating/updating/deleting a contract, totals and lists refresh (or after reload).
6. Tabs:
   - **Recent** — latest contracts; click through to detail
   - **Pending Review** — `in_review` (and related pending items as implemented)
   - **Shared With Me** — empty on live API until sharing is backend-backed; on mock, sample shared rows
7. Empty org: zeros and empty-state copy, no crash.

---

## 12. Contract repository (`/contracts`)

### 12.1 Empty state

New org with no contracts: empty state + **Upload Contract**.

### 12.2 Upload modal

Open from dashboard or repository.

**Validation**

- [ ] Name required
- [ ] File types allowed: `.pdf`, `.docx`, `.txt`
- [ ] Other extension (e.g. `.exe`) → error
- [ ] File &gt; 25 MB → error
- [ ] Drag-and-drop and file picker both work
- [ ] Choosing a file pre-fills name if name is empty

**Fields to fill at least once**

- Type: each of NDA, Employment, Vendor, Service, Licensing, Lease, Partnership, Purchase, Other
- Counterparty, description, start/end dates, comma-separated tags
- Optional: create **without** a file (name + type only)

**After save**

- Modal closes; contract appears in the table
- Dashboard total increases
- Opening the contract shows metadata and file name if uploaded

### 12.3 Search, filter, sort

Create at least 3 contracts with different names, counterparties, tags, types, and statuses.

| Check | How |
| --- | --- |
| Search by name | Partial match |
| Search by counterparty | Partial match |
| Search by description | Partial match |
| Search by tag | Tag text |
| Clear search (✕) | Full list returns |
| Type filter | Only that type |
| Status pills | `draft`, `in_review`, `changes_requested`, `approved`, `pending_signature`, `completed`, `archived` |
| Combined search + type + status | Intersection, not union |
| No matches | Empty state + **Clear Filters** |
| Sort | Recently updated, recently created, name A–Z / Z–A, expiration date |
| Retry | If you force an error, **Retry** reloads |

### 12.4 Table actions

- [ ] Row title opens `/contracts/:id`
- [ ] Status control on the row (if present) updates badge and dashboard pending counts
- [ ] Delete (if present) asks confirm; item leaves list; dashboard total drops

---

## 13. Contract detail (`/contracts/:id`)

### 13.1 Header and errors

- [ ] Breadcrumb back to Contracts
- [ ] Name, status badge, version pill, counterparty, owner, updated date, attachment label
- [ ] Fake id → “Contract Not Found” + return to repository

### 13.2 Status

Change through:

`draft` → `in_review` → `changes_requested` → `approved` → `pending_signature` → `completed` → `archived`

- [ ] Badge color/label updates
- [ ] Repository list matches
- [ ] Other org members get a **status** notification (live API notifies other active members)

### 13.3 Metadata

- [ ] Edit Metadata: name, type, description, counterparty, dates
- [ ] Save; cancel without save
- [ ] Delete: confirm → repository; cancel → stay on page

### 13.4 Tabs

Switch among **Workspace**, **Comments**, **Chat**, **Versions**, **Details**.

- [ ] Comment/chat counts on tabs update after new activity
- [ ] Details tab shows full metadata consistently with the header

---

## 14. Document editor (Workspace)

Prefer a **non-PDF** (or switch to editor mode) so the canvas is editable.

### 14.1 Formatting toolbar

- [ ] Normal / H1 / H2 / H3 / quote
- [ ] Bold, italic, underline, strikethrough
- [ ] Lists (bullets, numbered)
- [ ] Alignment (left, center, right, justify) if shown
- [ ] Horizontal rule if shown
- [ ] Undo / redo

### 14.2 Find & replace

- [ ] `Ctrl+F` / `Cmd+F` opens find
- [ ] Search, match count, next/previous
- [ ] Replace / replace all
- [ ] Case sensitivity if the control exists

### 14.3 Zoom and metrics

- [ ] Zoom levels (e.g. 75%–150%)
- [ ] Word and character counts change as you type

### 14.4 Autosave draft

1. Edit text; status goes **Unsaved** → **Saving** → **Draft autosaved** (about 2.5s after typing stops).
2. Refresh the page → draft text is still there (not only the last committed version).
3. `Ctrl+S` / `Cmd+S` opens **Save New Version** (does not only autosave).

### 14.5 Save version

1. Open Save New Version from the button or `Ctrl+S`.
2. Empty change description → error.
3. Valid description → version number increments (v1 → v2, etc.).
4. Versions tab / history lists author, time, description.

### 14.6 Version history

- [ ] Timeline of versions
- [ ] Restore an older version → new version created from that snapshot; workspace shows restored text
- [ ] Compare disabled with fewer than 2 versions; enabled with 2+

### 14.7 Compare / redline

1. Create two versions with clearly different wording.
2. Open Compare Versions.
3. Pick two versions.
4. **Unified** vs **side-by-side**.
5. Additions (green) and deletions (red / strike) are visible.
6. Close modal without breaking the editor.

---

## 15. PDF workspace

Upload or open a contract whose file name ends with `.pdf` (viewer opens by default).

- [ ] Page previous/next (UI is a **simulated** 2-page viewer)
- [ ] Zoom in/out
- [ ] Rotate 90°
- [ ] In-viewer search
- [ ] Switch to editor and back
- [ ] Download returns the original uploaded PDF bytes

---

## 16. Comments

On a contract, **Comments** tab.

1. Empty comment cannot submit.
2. Comment with optional quoted clause.
3. Filter **Active** / **Resolved** / **All**.
4. Reply in a thread.
5. Resolve → disappears from Active; Reopen.
6. Delete own comment (if offered).
7. **Two users:** C posts; A sees it without a full redeploy (refresh or tab revisit).
8. A receives a **comment** notification; click opens the same contract.
9. Comment over 2000 characters → rejected.

---

## 17. Contract chat

**Chat** tab.

1. Empty send is ignored.
2. Message appears with sender name and time.
3. List auto-scrolls to the latest.
4. Second user: message appears within ~5 seconds (polling) or on refresh.
5. Message over 2000 characters → rejected.
6. System-style messages (if any) after version/status changes.

---

## 18. Notifications (bell)

1. Badge shows unread count.
2. Types you can trigger on live API: **comment**, **status**, **version** (when another member comments, changes status, or saves a version).
3. Click a row → marked read + navigate to contract when `contractId` exists.
4. **Mark all as read** clears the badge.
5. Empty state copy when there are none.
6. Click outside closes the dropdown.
7. Polling: new events appear without full page reload (~10s).

**Share-type notifications** need working share APIs (mock or future live routes).

---

## 19. Sharing (UI)

**Share Contract** on the detail header.

### Live API

- [ ] Opening the modal / listing shares: record actual error or empty state
- [ ] Do **not** mark sharing as client-ready until `/api/v1/contracts/:id/shares` and `/shared-with-me` exist and persist

### Mock mode (optional UI pass)

- [ ] Internal share: member + permission Viewer / Reviewer / Editor / Approver
- [ ] External link: expiry 7 / 14 / 30 / none; copy URL
- [ ] Revoke share
- [ ] Shared contract appears under Dashboard **Shared With Me**

---

## 20. Cross-page consistency (regression)

After each major write, check **all** of these still agree:

| Action | Dashboard | Repository | Detail |
| --- | --- | --- | --- |
| Create contract | Total +1, recent list | New row | Opens |
| Rename | Title in lists | Title | Header |
| Status change | Pending counts | Badge / filter | Selector |
| Delete | Total −1 | Gone | 404 if URL reused |
| New version | Recently updated | Updated time | Version pill |
| New comment/chat | — | — | Tab counts |

Also: logout from any page; login; data still there (live API).

---

## 21. Validation and errors (quick sweep)

- [ ] Network down: actions show an error, app does not white-screen
- [ ] Contracts load failure: **Retry**
- [ ] Zod/API errors render as readable messages (not raw JSON)
- [ ] Auth limiter: many failed logins in 15 minutes may 429 (optional)

---

## 22. Automated checks (complement, not a substitute)

From repo root:

```bash
npm run test --workspace=@cml/api
npm run lint --workspace=@cml/web
npm run build --workspace=@cml/web
```

- [ ] API Vitest auth/RBAC tests pass
- [ ] Web typecheck passes
- [ ] Production build succeeds

---

## 23. Suggested test order (half-day UAT)

1. Live stack + health + smoke  
2. Admin register, verify email, profile, logout/login  
3. Invite manager + member; RBAC on settings  
4. Isolation with a second organization  
5. Upload 3+ contracts; search/filter/sort  
6. Full status lifecycle  
7. Editor, autosave, two versions, restore, compare  
8. PDF viewer smoke  
9. Two-user comments, chat, notifications  
10. Sharing: document live vs mock  
11. Password reset via Mailhog  
12. Desktop + mobile shell  
13. API tests + web build  

---

## 24. Sign-off

| | |
| --- | --- |
| Tester | |
| Date | |
| Environment | Live API / Mock |
| Browsers | |
| Blockers | |
| Gaps disclosed to client | Sharing backend, PDF simulation, Shared-with-me metric, no audit UI |
| Ready for client demo? | Yes / Yes with caveats / No |

**Client-ready** means Mode A (live API) passed for auth, org/RBAC, contracts, editor/versions, comments, chat, and notifications — and sharing is either implemented or explicitly listed as not in this delivery.
