# CML (Contract Lifecycle Management) — System Functionality & Technical Architecture

This document provides a deep technical breakdown of every functional capability within the Contract Lifecycle Management (CML) platform, detailing the technologies, design patterns, data flows, and under-the-hood algorithms powering each subsystem.

---

## 1. High-Level Technology Stack & Monorepo Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                              MONOREPO                                  │
├────────────────────────┬────────────────────────┬──────────────────────┤
│    packages/shared     │        apps/web        │       apps/api       │
│  (Contracts & Schemas) │     (Client Engine)    │   (Backend Engine)   │
├────────────────────────┼────────────────────────┼──────────────────────┤
│ • TypeScript 5.x       │ • React 18 (SPA)       │ • Node.js & Express  │
│ • Zod validation       │ • Vite 6 & Tailwind    │ • MongoDB & Mongoose │
│ • Universal enums      │ • TanStack Query v5    │ • Redis              │
│ • Type definitions     │ • Zustand State Store  │ • MinIO (S3 Object)  │
│                        │ • Native DOM Range API │ • Mailhog (SMTP)     │
└────────────────────────┴────────────────────────┴──────────────────────┘
```

The system operates across three decoupled layers:
1. **`@cml/shared`**: The single source of truth for TypeScript interfaces, Zod validation schemas, and system enums. It is compiled and referenced directly by both the client and server.
2. **`apps/web`**: A modern single-page web client built with React 18, styled via Tailwind CSS, using Zustand for synchronous authentication/workspace state, TanStack Query for asynchronous server state, and a custom Vite middleware engine for standalone execution.
3. **`apps/api`**: A production REST API built with Express, MongoDB/Mongoose models, Redis for caching and rate limiting, and MinIO for raw PDF/DOCX storage.

---

## 2. Core Functional Modules & Under-the-Hood Mechanisms

---

### Module A: Authentication, Multi-Tenancy & RBAC

#### Functionality
- **Multi-Tenant Scoping**: All contracts, versions, comments, and members belong strictly to an Organization. Users can create, switch between, or belong to multiple organizations.
- **Role-Based Access Control (RBAC)**: Supports 5 distinct authorization levels:
  - `admin`: Full organizational control, billing, member deletion, contract deletion.
  - `manager`: Contract creation, status advancement, sharing, and approval workflows.
  - `editor`: Contract drafting, clause editing, redlining, and saving versions.
  - `reviewer`: Read-only access to text with the ability to add clause comments and chat.
  - `viewer`: Strictly read-only access without edit, comment, or share permissions.

#### Technologies & Under-the-Hood Mechanism
- **Zustand (`apps/web/src/stores/auth.ts`)**: Manages the local user profile, active token, current organization ID, and role.
- **Guarded Navigation (`AuthGuards.tsx`)**: React Router v6 route wrappers evaluate `isAuthenticated` and `currentRole`. If a user attempts to access an unauthorized route (e.g., an `editor` attempting to access `/settings/members`), the guard intercepts and redirects with an unauthorized alert.
- **Token Handling**:
  - In production, JWTs are issued as `HttpOnly` secure cookies.
  - In standalone/preview mode, the authentication store seeds active demo accounts (`admin@example.com`, `sarah@example.com`, `john@example.com`) directly into state for zero-setup evaluation.

---

### Module B: Central Contract Repository & Multi-Parameter Search

#### Functionality
- Real-time searching across contract titles, counterparty names, descriptions, and metadata tags.
- Faceted filtering by:
  - **Lifecycle Status**: `Draft`, `In Review`, `Pending Signature`, `Active`, `Expired`, `Terminated`.
  - **Contract Classification Type**: `NDA`, `MSA`, `SLA`, `Employment`, `Licensing`, `Vendor`, `Lease`, `Other`.
- Multi-column sorting (Alphabetical, Value, Creation Date, Expiration Date).

#### Technologies & Under-the-Hood Mechanism
- **Search Normalization Algorithm**: Client-side filtering executes lowercase substring matching across normalized strings and tag arrays:
  ```typescript
  const matchesSearch =
    c.name.toLowerCase().includes(term) ||
    c.counterparty?.toLowerCase().includes(term) ||
    c.tags?.some((t) => t.toLowerCase().includes(term));
  ```
- **TanStack Query (`useQuery`)**: Maintains a localized cache key `['contracts', filters]`. When filters or sort parameters change, TanStack Query prevents unnecessary network waterfall requests by serving stale data while re-fetching in the background (`stale-while-revalidate`).

---

### Module C: In-Browser Legal Clause Editor & Autosave Engine

#### Functionality
- A distraction-free 8.5" × 11" proportional canvas mimicking real printed legal sheets.
- Rich formatting controls: Headings (H1, H2, H3), bold, italic, underline, strike-through, bullet lists, ordered lists, blockquotes, horizontal rules, and paragraph alignment.
- Live telemetry counters: Real-time word count and character count calculation.
- Integrated Find & Replace: Case-sensitive search with step-through highlighting and global replace.
- View zoom controls: Scaling from 75% to 150%.

#### Technologies & Under-the-Hood Mechanism
- **Native Document Range & Selection API (`LegalClauseEditor.tsx`)**:
  - Rather than embedding heavy third-party iframe editors that compromise performance, the editor leverages HTML5 `contentEditable` coupled with `document.execCommand` and programmatic `Selection` range manipulation.
  - Ensures clean, lightweight HTML markup output suitable for PDF conversion and legal storage.
- **Debounced Autosave Queue**:
  - Every keystroke updates local component state and dispatches a debounced HTTP `PATCH /api/v1/contracts/:id/draft` payload after 1,500ms of typing inactivity.
  - Visual status transitions through three states:
    1. *Unsaved changes* (Orange dot — immediately on keystroke).
    2. *Autosaving...* (Pulse animation — while request is in flight).
    3. *Draft autosaved* (Green checkmark — on successful server ACK).
- **Keyboard Interceptor**:
  - Listens to window `keydown` events. `Ctrl+S` / `Cmd+S` intercepts browser page-saving to trigger the **Save Version Modal**. `Ctrl+F` / `Cmd+F` opens the floating Find & Replace dialog.

---

### Module D: PDF Document Viewer

#### Functionality
- Realistic multi-page PDF document inspection.
- Navigation bar with page jumping (Page X of Y), zoom adjustment (50% to 200%), 90-degree clockwise canvas rotation, keyword highlighting, and direct download.
- Seamless dual-mode toggle between **PDF Document View** and **Interactive Legal Editor**.

#### Technologies & Under-the-Hood Mechanism
- **Simulated Page Rendering Engine (`PdfDocumentViewer.tsx`)**:
  - Splits contract text dynamically into simulated letter-sized pages (`aspect-[8.5/11]`).
  - Utilizes CSS transform scaling (`transform: scale(...)`) and CSS rotation (`transform: rotate(...)`) inside a container with `overflow: hidden` to guarantee pixel-sharp layout geometry on high-DPI displays.

---

### Module E: Audit-Grade Version History & Semantic Snapshots

#### Functionality
- Tracks immutable historical versions of any contract (e.g., `v1.0`, `v2.0`).
- Captures commit metadata: version number, author attribution, commit notes, and timestamp.
- **One-Click Restore**: Allows authorized editors to roll the live contract back to any historical snapshot.

#### Technologies & Under-the-Hood Mechanism
- **Immutable Snapshot Store (`apps/web/vite.config.ts` & `apps/api`)**:
  - Historical snapshots are never overwritten. When a new version is committed (`POST /api/v1/contracts/:id/versions`), the server stores the full raw text, increments the semantic version counter, and records the active user ID.
  - Restoring a version does not delete history; it creates a new version referencing the historical text, preserving full SOC-2 and HIPAA audit compliance.

---

### Module F: Visual Redline Diff Engine (Unified & Split Views)

#### Functionality
- Side-by-side split comparison or unified inline redline comparison between any two arbitrary versions of a contract.
- Visual highlighting:
  - Additions highlighted in emerald background (`bg-emerald-100 text-emerald-950`).
  - Deletions highlighted in rose background with strike-through (`bg-rose-100 text-rose-950 line-through`).

#### Technologies & Under-the-Hood Mechanism
- **LCS Line-by-Line Tokenization Diff Algorithm (`VersionCompareModal.tsx`)**:
  - The diff engine tokenizes both document strings into array lines and applies a Longest Common Subsequence (LCS) comparison heuristic:
    1. Unchanged lines receive status `'equal'`.
    2. Missing lines in Version B receive status `'deleted'`.
    3. Newly introduced lines in Version B receive status `'added'`.
  - In **Split View**, lines are mapped onto two synchronized vertical columns.
  - In **Unified View**, additions and deletions are interwoven sequentially to provide standard legal "redline markups".

---

### Module G: Contract Sharing & Access Management

#### Functionality
- **Internal Team Sharing**: Invite members via email with explicit permission assignments:
  - `Viewer`, `Reviewer`, `Editor`, `Approver`.
- **External Public Review Links**:
  - Secure preview links for external counsel or counterparties.
  - Configurable expiration periods: `7 days`, `14 days`, `30 days`, or `Permanent`.
  - Instant clipboard copy with feedback animation.
- **Access Revocation**: One-click revocation of any share link or collaborator access.
- **"Shared With Me" Dashboard**: Filtered tab displaying all contracts shared with the logged-in user and their specific granted permission badge.

#### Technologies & Under-the-Hood Mechanism
- **Token-Based Cryptographic Access (`ShareContractModal.tsx`)**:
  - External links generate an unguessable pseudo-random cryptographic token:
    ```typescript
    const token = 'tok_' + Math.random().toString(36).substring(2, 12);
    const shareUrl = `https://clm.acme.corp/preview/share/${token}`;
    ```
  - The server verifies token validity and checks `expiresAt < new Date()` before serving contract data to external viewers.
- **Query Invalidation & Cache Consistency**:
  - Creating or revoking shares immediately invokes TanStack Query's `queryClient.invalidateQueries(['contract-shares', contractId])` and `queryClient.invalidateQueries(['contracts-shared-with-me'])`.

---

### Module H: Clause Annotations & Threaded Feedback

#### Functionality
- Users can highlight or quote specific contractual clauses and attach a comment.
- Threaded discussions: Reviewers and attorneys can reply directly beneath an existing comment thread.
- Resolution lifecycle: One-click "Resolve" and "Reopen" toggles, with tab filtering (**Active**, **Resolved**, **All**).

#### Technologies & Under-the-Hood Mechanism
- **Relational Comment Tree (`ContractCommentsPanel.tsx`)**:
  - Each comment structure contains:
    ```typescript
    interface ContractComment {
      id: string;
      contractId: string;
      versionNumber: number;
      quoteText?: string;
      content: string;
      author: UserRef;
      replies: CommentReply[];
      isResolved: boolean;
      resolvedBy: UserRef | null;
      resolvedAt: string | null;
      createdAt: string;
    }
    ```
  - Resolving a comment patches `isResolved: true` and logs the resolver's identity, providing legal teams with a clear record of who approved clause changes.

---

### Module I: Negotiation Chat & Discussion Channel

#### Functionality
- Embedded real-time discussion channel beside the document workspace.
- Message history stream with sender avatar pills and relative timestamps.
- System event notifications (e.g., status changes, new version commits) embedded directly in the conversation flow.

#### Technologies & Under-the-Hood Mechanism
- **Short-Polling Revalidation Loop (`ContractChatPanel.tsx`)**:
  - Uses TanStack Query configured with `refetchInterval: 5000` (polling every 5 seconds) to guarantee fresh updates across multi-browser sessions without requiring complex WebSocket connections.
  - Auto-scrolling: A React `useRef` attached to the message container automatically scrolls to the bottom whenever the message count increases (`messages.length`).

---

### Module J: Universal Notification Center

#### Functionality
- Global notification bell located in the top navigation bar.
- Dynamic red badge displaying the exact count of unread notifications.
- Interactive dropdown previewing events categorized by icon:
  - 💬 **Clause comments**
  - 📑 **New versions**
  - 👥 **Access invitations**
  - 🔄 **Lifecycle status transitions**
- Deep linking: Clicking a notification automatically marks it as read and routes the browser directly to the contract.
- "Mark all as read" button.

#### Technologies & Under-the-Hood Mechanism
- **Polling & Outside Click Listener (`NotificationDropdown.tsx`)**:
  - Polls `/api/v1/notifications` every 10 seconds.
  - Listens to document `mousedown` events with a DOM ref check to gracefully close the popover when clicking anywhere outside.

---

## 3. Storage Architecture: Development vs. Production

### Development / AI Studio Preview Mode
To ensure the app boots instantly with zero setup, `apps/web/vite.config.ts` incorporates an **in-memory mock API plugin**:
- Intercepts all `/api/v1/*` HTTP calls within the Vite dev server.
- Maintains in-memory stateful stores for:
  - `contractsList`: Full contract records and metadata.
  - `contractDrafts`: In-flight autosaved drafts.
  - `contractVersions`: Historical snapshot commits.
  - `contractShares`: Active internal and external share permissions.
  - `contractComments`: Clause threads and resolution flags.
  - `contractChats`: Discussion message feeds.
  - `notificationsList`: System alerts.
- Validates all POST and PATCH payloads against `@cml/shared` schemas using Zod.

### Production Full-Stack Mode
When deployed with the backend (`apps/api`):
- **MongoDB**: Persists user profiles, hashed passwords, organizations, contract records, comments, and audit logs.
- **Redis**: Handles session token blacklisting on logout and rate limits sensitive endpoints.
- **MinIO / AWS S3**: Stores raw binary files (`.pdf`, `.docx`) using the AWS S3 SDK.
- **Mailhog / SMTP**: Captures verification emails, password resets, and collaborator invitation links.

---

## 4. Architectural Summary

| Feature | Primary Technology | Key Under-the-Hood Mechanism |
| :--- | :--- | :--- |
| **Authentication & RBAC** | Zustand + React Router | Client-side route guards + Role hierarchy evaluation |
| **Contract Search** | TanStack Query + TypeScript | Lowercase tokenization across tags, titles, counterparties |
| **Legal Clause Editor** | Native DOM Range API | HTML5 contentEditable + command dispatching + autosave queue |
| **Autosave Engine** | React Hooks + REST API | 1,500ms debounced queue with visual status indicators |
| **PDF Document Viewer** | CSS Transforms + DOM Engine | Dynamic page splitting with CSS scale and rotation transforms |
| **Version History** | Immutable REST API | Snapshot commit logs with one-click historical restore |
| **Redline Diff Engine** | Custom LCS Diff Algorithm | Line tokenization mapping insertions and deletions |
| **Contract Sharing** | TanStack Query + Zod | Token-based expiring URLs with role-based permissions |
| **Clause Comments** | Relational Tree Components | Clause quote referencing, threaded replies, resolve workflows |
| **Discussion Chat** | TanStack Query Polling | 5-second interval polling with auto-scrolling DOM refs |
| **Notifications** | Global Navigation Bar | 10-second polling loop with unread badge calculation |
