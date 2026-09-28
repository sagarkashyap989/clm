# Implementation Plan: Real-Time Multi-User Collaborative Document Editing

Add true real-time, multi-user collaborative editing to the Contract Management System (CML). Multiple authorized users can simultaneously edit the same legal contract, view live cursor positions and text selections, see collaborator presence, and receive automatic real-time updates without refreshing.

---

## 1. User Review Required / Key Architectural Decisions

- **Transport & Collaboration Protocol**: We will use **Socket.IO** (with native WebSocket fallback) on the backend and frontend. Socket.IO provides built-in room multiplexing (`contract:contractId`), heartbeat reconnection handling, and binary/JSON event support.
- **Delta & Conflict-Free Document Synchronization**: Rather than sending the entire document string on every keystroke (which would overwrite peer edits), we implement an incremental operational/diff-patch synchronization model (`delta:patch`) with Lamport timestamps and client-side revision buffering. Concurrent edits in different paragraphs or positions are merged cleanly.
- **Single Connection Architecture**: A single WebSocket connection is maintained per open contract editor tab. Connection state transitions cleanly through `connecting` -> `connected (live)` -> `reconnecting` -> `disconnected (offline)`.
- **RBAC & Organization Isolation**: Connection authentication validates the JWT token, resolves user organization ID, verifies contract access, and assigns capabilities:
  - **Editor / Admin**: Can send document edits, cursor updates, and selection changes.
  - **Viewer**: Read-only access; can view live updates and presence, but server ignores and drops any incoming edit events.
- **Non-Destructive Integration**: Draft autosave (to `/api/v1/contracts/:id/draft`), immutable version creation (`v1.0`, `v2.0`), redline diff comparison, threaded comments with quote anchoring, and contract chat remain fully operational.

---

## 2. Proposed Changes & Component Architecture

### A. Shared Protocol Types (`packages/shared/src/index.ts`)
- Define collaborative message payloads:
  - `CollaborationUser`: `id`, `name`, `email`, `role`, `color`.
  - `CursorPosition`: `path`, `offset`, `lineIndex`, `characterIndex`.
  - `SelectionRange`: `anchor`, `focus`, `textPreview`.
  - `PresenceState`: `user`, `cursor`, `selection`, `lastActiveAt`, `isEditing`.
  - `DocumentDelta`: `revision`, `patches`, `authorId`, `timestamp`.
  - `RoomState`: `contractId`, `versionNumber`, `activeUsers`, `content`.
  - Client-to-server and server-to-client event definitions:
    - `doc:join`, `doc:joined`, `doc:leave`
    - `doc:sync_init` (initial catch-up on connect)
    - `doc:edit` / `doc:patch` (real-time incremental operations)
    - `doc:version_restored` (broadcast when an authorized user restores a version)
    - `awareness:cursor` (ephemeral cursor movement)
    - `awareness:selection` (ephemeral text selection)
    - `awareness:presence` (active users in room)

---

### B. Backend Collaboration Server (`apps/api/src/collaboration/`)
Create a dedicated collaboration module:
1. `collaboration.types.ts`: Internal socket session interfaces.
2. `collaboration.auth.ts`: Socket authentication middleware:
   - Validates access token from handshake auth or cookies.
   - Verifies organization membership and contract role (Viewer vs Editor).
3. `collaboration.rooms.ts`:
   - Room manager: tracks connected sockets per `contract:<contractId>`, document content in memory, Lamport revision counter, and client acknowledgment buffers.
   - Enforces strict organization isolation: sockets from Org A can never join rooms of Org B.
4. `collaboration.presence.ts`:
   - Tracks active editors, cursors, and selections per room.
   - Dispatches `user:joined`, `user:left`, and debounced awareness pulses.
5. `collaboration.server.ts`:
   - Exports `initCollaborationServer(httpServer)`: binds Socket.IO to the Node HTTP server.
   - Handles `doc:patch` broadcasting to all peers except the sender, buffering latest state for newly joined users.
   - Handles `doc:version_restored`: when version restore is triggered, pushes the restored HTML to all connected room members immediately.

---

### C. Dev Server & Vite Integration (`apps/web/vite.config.ts`)
- Attach the collaboration server directly to Vite's `server.httpServer` in `configureServer(server)` using `socket.io`.
- This ensures that running `npm run dev` in AI Studio provides real WebSockets on port 3000, allowing two or more browser windows to open simultaneously and collaborate in real-time.

---

### D. Frontend Collaboration Engine (`apps/web/src/features/editor/collaboration/`)
1. **`CollaborationProvider.tsx` & `useCollaboration.ts`**:
   - Manages connection lifecycle (`contract:<contractId>`).
   - Handles auto-reconnect with exponential backoff.
   - Buffers local modifications if network is temporarily interrupted, resyncing upon reconnection.
2. **`useCollaborativeDocument.ts`**:
   - Manages local document revision vs incoming remote patches.
   - Emits patch deltas on user keystrokes (debounced at 50ms) rather than full document strings.
   - Applies remote diffs smoothly to the canvas without resetting the user's active cursor or selection.
3. **`usePresence.ts`**:
   - Tracks active collaborators, assigning deterministic distinct colors (Emerald, Indigo, Violet, Amber, Rose, Cyan).
   - Tracks remote cursors and shared selections.
4. **`CollaborationStatus.tsx`**:
   - Header connection pill:
     - `✓ Live` (emerald)
     - `◌ Connecting...` (amber)
     - `⚠ Offline` (rose)
     - `↻ Reconnecting...` (amber pulse)
5. **`PresenceAvatars.tsx`**:
   - Header presence display:
     - Group of collaborator avatars with colored online rings and initials.
     - Text counter: `"1 person editing"` / `"3 people editing"`.
     - Tooltip showing collaborator name, email, and role.
6. **`CollaboratorCursors.tsx`**:
   - Overlay on the document canvas rendering:
     - Remote colored carets with the collaborator's name pill floating above.
     - Remote highlighted text selections in the collaborator's color with low opacity.

---

### E. Editor Canvas & Detail Page Integration
1. **`DocumentEditorCanvas.tsx`**:
   - Connect collaborative content engine to the contentEditable paper canvas.
   - Add cursor & selection listeners (`selectionchange`, `pointerup`, `keyup`) that broadcast cursor positions to peers.
   - Render peer carets and selections without interfering with the local user's typing.
2. **`ContractDetailPage.tsx`**:
   - Place `PresenceAvatars` and `CollaborationStatus` into the top action header.
   - Broadcast `doc:version_restored` when a user restores a historical version so all peers update instantaneously without browser refresh.
   - Preserve existing draft autosave (2.5s debounced PATCH) as secondary server-side persistence.
   - Retain inline comment passage highlights and scroll-to-quote.
3. **Multi-User Test Switcher**:
   - In the collaboration bar, provide a fast **Persona Switcher** (`Admin (You)` / `Sarah Connor` / `John Doe`) so the user can easily test collaborative features within the same environment or across two browser tabs.

---

## 3. Verification & Acceptance Testing Plan

### Automated & Unit Tests
- Test socket room authentication and organization separation: users without contract access get `UNAUTHORIZED`.
- Test delta synchronization: concurrent edits at different offsets both merge into document state.
- Test viewer permission enforcement: viewer cannot broadcast edits.

### Manual Multi-Window Acceptance Steps
1. **Two-Browser Session Test**:
   - Open Browser Window A (logged in as Admin) and Browser Window B (logged in as Sarah Connor) on Contract #1.
   - Observe both avatars appearing in the "Editing now" presence header on both screens ("2 people editing").
2. **Real-Time Keystroke Propagation**:
   - In Window A, edit a clause (e.g. change `"12 months"` to `"24 months"`).
   - Verify Window B updates immediately without page refresh.
3. **Simultaneous Non-Conflicting Edits**:
   - Window A edits Section 1 while Window B simultaneously edits Section 3.
   - Verify both changes are preserved in both windows.
4. **Live Cursors & Shared Selection**:
   - Move cursor or select text in Window A.
   - Verify a colored indicator and name tag ("Admin") appears at that position in Window B.
5. **Offline & Reconnection Handling**:
   - Simulate disconnect (or toggle offline state in devtools).
   - Status changes to `⚠ Offline` / `↻ Reconnecting...`.
   - Make local edit while offline; reconnect network; verify changes sync cleanly.
6. **Version Restore Broadcast**:
   - In Window A, restore Version 1.0.
   - Verify Window B automatically updates to the restored version with a system toast notification.
