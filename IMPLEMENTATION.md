# Contract Management System (CML) - Implementation & Architecture Guide

This document provides a comprehensive breakdown of the features built, the architectural design decisions, and how each component and API was implemented within the existing codebase.

---

## 1. Executive Summary & Solution Architecture

The **Contract Management System (CML)** is an enterprise-grade contract lifecycle management platform. The codebase is organized as a high-performance monorepo:

```
├── apps/
│   ├── web/                     # React 18, Vite, Tailwind CSS, TanStack Query, Zustand
│   │   ├── src/
│   │   │   ├── components/      # Global AppShell, navigation, modals, notifications
│   │   │   ├── features/
│   │   │   │   ├── auth/        # Login, registration, org onboarding
│   │   │   │   ├── contracts/   # Repository, search, filtering, detail views
│   │   │   │   ├── editor/      # Legal clause editor, PDF viewer, diff engine, version history
│   │   │   │   ├── collaboration/# Sharing modal, clause comments, real-time chat
│   │   │   │   ├── dashboard/   # Multi-tab dashboard (Recent, Pending, Shared)
│   │   │   │   ├── settings/    # Organization team management, invitations, RBAC
│   │   │   │   └── profile/     # User profile and credentials
│   │   │   └── stores/          # Zustand authentication & workspace store
│   │   └── vite.config.ts       # Full-fidelity dev server & in-memory API mock engine
│   └── api/                     # Express & Node.js backend with Mongoose models
└── packages/
    └── shared/                  # Shared Zod validation schemas, TypeScript interfaces & enums
```

---

## 2. Implemented Features & Technical Workflows

### Phase 1: Authentication, Organizations & RBAC
- **Multi-Tenant Scoping**: All contract actions, shares, and comments are scoped by organization ID.
- **Role-Based Access Control**:
  - Roles: `admin`, `manager`, `editor`, `viewer`, `approver`.
  - Permissions restrict critical operations such as contract status advancement, member deletion, and version overwrites.
- **State Management**: Built with `zustand` (`apps/web/src/stores/auth.ts`) persisting session tokens, active organizations, and current member profiles.

---

### Phase 2: Contract Repository & Lifecycle Management
- **Central Repository (`/contracts`)**:
  - Multi-parameter live search supporting searches across contract title, counterparty, description, and tags.
  - Granular filtering by **Status** (`draft`, `in_review`, `pending_signature`, `active`, `expired`, `terminated`) and **Contract Type** (`nda`, `msa`, `sla`, `employment`, `licensing`, `vendor`, `lease`, `other`).
  - Column sorting by name, value, creation date, and expiration date.
- **Contract Ingestion Modal (`ContractUploadModal.tsx`)**:
  - Drag-and-drop and file-picker upload support for `.pdf` and `.docx` files.
  - Input validation via Zod schemas for financial value, currency selection, counterparty identification, tags, and lifecycle dates.
- **Contract Details Overview (`ContractDetailPage.tsx`)**:
  - Contract header displaying lifecycle status badges, financial overview, and counterparty metadata.
  - Interactive status transition control (e.g., advancing from *Draft* → *In Review* → *Pending Signature* → *Active*).
  - Complete audit trail documenting timestamps and user attribution for all state changes.

---

### Phase 3: Document Viewer, In-Browser Editor & Version Control
- **Legal Clause Document Canvas (`LegalClauseEditor.tsx`)**:
  - Proportionally styled 8.5" × 11" document sheet designed specifically for contractual agreements.
  - Full WYSIWYG formatting toolbar:
    - Headings (H1, H2, H3), bold, italics, underline, strike-through.
    - Bullet lists, numbered lists, blockquotes, and horizontal dividers.
    - Text alignment (left, center, right, justify) and undo/redo history.
  - Live document telemetry: Real-time word and character count calculations.
  - View scaling: Interactive document zoom (75%, 90%, 100%, 110%, 125%, 150%).
  - Integrated Find & Replace: Floating utility with occurrence navigation and case sensitivity toggles.
- **Autosave & Draft Preservation**:
  - Background debounced synchronization via `/api/v1/contracts/:id/draft`.
  - Non-intrusive status indicator displaying *Draft autosaved*, *Autosaving...*, or *Unsaved changes*.
  - Keyboard shortcut support (`Cmd/Ctrl+S` to commit a new version, `Cmd/Ctrl+F` to open find/replace).
- **PDF Document Viewer (`PdfDocumentViewer.tsx`)**:
  - Multi-page simulated document rendering with page navigation controls.
  - Zoom adjustment, 90° page rotation, search keyword highlighting, and direct download/export.
  - Seamless mode toggle between visual PDF mode and editable legal canvas mode.
- **Audit-Grade Version History (`VersionHistoryDrawer.tsx` & `SaveVersionModal.tsx`)**:
  - Chronological snapshot timeline tracking version numbers (e.g., `v1.0`, `v2.0`), commit messages, author metadata, and creation timestamps.
  - One-click restore action that updates the active contract document to any previous historical snapshot.
- **Redline Comparison Diff Engine (`VersionCompareModal.tsx`)**:
  - Algorithmic diff computation comparing text between any two arbitrary versions.
  - Visual color-coded diff output:
    - Additions highlighted in emerald with subtle background tints.
    - Deletions highlighted in rose with strike-through styling.
  - Supports both **Unified Redline** and **Side-by-Side Split** comparison layouts.

---

### Phase 4: Collaboration & Team Communication
- **Contract Sharing & Permission Management (`ShareContractModal.tsx`)**:
  - **Internal Team Sharing**: Assign granular access permissions (**Viewer**, **Reviewer**, **Editor**, **Approver**) to organization members.
  - **External Review Links**: Generate secure, time-limited review URLs with configurable expiration options (7 days, 14 days, 30 days, or permanent) and one-click clipboard copying.
  - **Access Revocation**: Instantly revoke existing shares or invalid tokens.
  - **"Shared With Me" Views**: Populates dedicated filtered views on both the main dashboard and the contract repository.
- **Clause Comments & Inline Annotations (`ContractCommentsPanel.tsx`)**:
  - Create feedback threads attached to specific quoted contract clauses or clauses within a specific version.
  - Multi-user threaded replies allowing discussions directly on legal clauses.
  - Resolution lifecycle: Filter comments by **Active**, **Resolved**, or **All**, with one-click resolve/reopen buttons.
- **Real-Time Contract Chat (`ContractChatPanel.tsx`)**:
  - Embedded negotiation channel located beside the contract workspace.
  - Real-time message stream with sender avatars, relative timestamps, and auto-scrolling to the latest message.
  - In-line system event indicators for version updates and status transitions.
- **Universal Notification Center (`NotificationDropdown.tsx`)**:
  - Header bell icon displaying dynamic unread count badges.
  - Actionable alerts for contract shares, clause comments, new versions, and status approvals.
  - Direct navigation linking notifications directly to the corresponding contract.
  - "Mark all as read" capability.

---

## 3. Data Flow & State Architecture

```
                               ┌─────────────────────────────┐
                               │       Zustand Store         │
                               │  (User, Auth, Organization) │
                               └──────────────┬──────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │     TanStack Query      │                     │     TanStack Query      │
         │   (Contract Metadata)   │                     │  (Comments, Chat, Diff) │
         └────────────┬────────────┘                     └────────────┬────────────┘
                      │                                               │
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │   In-Browser Editor     │ ◄──[Autosave Draft]──│  Version History Engine │
         │  (Legal Text & Toolbar) │ ───[Commit Version]─►│  (Snapshots & Redlines) │
         └─────────────────────────┘                     └─────────────────────────┘
```

1. **Client Persistence & Query Cache**: All contract metadata, versions, comments, shares, and notifications are managed via TanStack Query (`@tanstack/react-query`) with automatic cache invalidation on mutations.
2. **Mock API Plugin Architecture (`apps/web/vite.config.ts`)**:
   - In-memory mock server routes intercept `/api/v1/*` requests directly inside Vite's local dev server.
   - Provides instant responses, persistence across client navigation, validation against shared Zod schemas, and realistic network delays.
3. **Type Safety Across Layers**:
   - Every input payload (`ShareContractInput`, `CreateCommentInput`, `SaveVersionInput`, `ContractUploadInput`) is validated via `@cml/shared` schemas using Zod.

---

## 4. Key Files Created and Modified

| File Path | Description |
| :--- | :--- |
| `packages/shared/src/index.ts` | Added Phase 4 schemas: `shareContractSchema`, `createCommentSchema`, `replyCommentSchema`, `createChatMessageSchema`, and notification types. |
| `apps/web/vite.config.ts` | Added mock API routes for shares, comments, threaded replies, resolution, chat discussions, notifications, and "Shared With Me" queries. |
| `apps/web/src/components/AppShell.tsx` | Integrated `NotificationDropdown` in the desktop and mobile navigation headers. |
| `apps/web/src/features/dashboard/DashboardPage.tsx` | Added interactive tabs for **Recent Contracts**, **Pending Review**, and **Shared With Me**. |
| `apps/web/src/features/contracts/ContractDetailPage.tsx` | Added Share Contract button, Comments tab, Discussion Chat tab, and collaboration counters. |
| `apps/web/src/features/collaboration/ShareContractModal.tsx` | Modal handling internal permissioned invites, external link generation, and share revocation. |
| `apps/web/src/features/collaboration/ContractCommentsPanel.tsx` | Clause commenting engine with quote highlights, threaded replies, and resolve workflows. |
| `apps/web/src/features/collaboration/ContractChatPanel.tsx` | Real-time negotiation discussion panel with system event markers and message polling. |
| `apps/web/src/features/collaboration/NotificationDropdown.tsx` | Notification bell dropdown with unread badge counters, event categories, and quick links. |
| `apps/web/src/features/editor/LegalClauseEditor.tsx` | In-browser rich legal clause editor with formatting toolbar, find/replace, and draft autosave. |
| `apps/web/src/features/editor/PdfDocumentViewer.tsx` | High-fidelity PDF viewer with page navigation, zoom, rotation, and export. |
| `apps/web/src/features/editor/VersionHistoryDrawer.tsx` | Interactive timeline showing chronological versions, metadata, and restore controls. |
| `apps/web/src/features/editor/VersionCompareModal.tsx` | Redline diff viewer computing visual additions and deletions between versions. |

---

## 5. Verification and Quality Checks

- **TypeScript Compilation**: Executed `tsc --noEmit` across all workspace packages with zero type errors.
- **Production Build**: Verified with `npm run build` producing optimized production bundles in `apps/web/dist`.
