# Microsoft Word Track Changes, Markup Balloons & Threaded Comments

A comprehensive review and redlining system for the Contract Lifecycle Management platform, providing authentic Word-style Track Changes (insertions, deletions, and formatting revisions), margin markup cards, text-anchored threaded comments, reviewer color attribution, jump navigation, and revision snapshots.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions were confirmed via user clarification and will govern the implementation:

- **Confirmed Margin Layout**: Right margin markup cards mimicking Microsoft Word balloons, visually connected to inline revision highlights and commented text ranges.
- **Confirmed Review Actions**: Interactive *Accept* and *Reject* buttons directly on each individual margin card, supplemented by batch *Accept All* / *Reject All* actions in the Word Ribbon toolbar.
- **Confirmed Author Attribution**: Reviewer identity resolved from the authenticated user profile, assigned distinctive author color badges and initials (e.g., Indigo, Emerald, Amber, Rose, Cyan) with relative and exact timestamps.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades the contract editor and Word Online view into a collaborative legal negotiation engine. Legal counsels can turn on Track Changes to capture text additions, removals, and formatting modifications (bold, italic, font, size). Selected clauses can be highlighted to attach threaded discussions. All changes and comments render as interactive margin cards with jump navigation and version comparisons.
- **Target Audience / Persona**: Legal counsel, procurement managers, contract negotiators, and counterparty reviewers who require granular transparency into contract alterations.
- **Key Value**: Delivers the exact workflow legal teams rely on in desktop Microsoft Word (redlines, markup balloons, and author accountability) directly inside the cloud workspace, eliminating version confusion and offline document drift.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Enabling Track Changes & Capturing Revisions**:
   - The user switches Track Changes to **ON** via the Review ribbon or floating toggle.
   - Text inserted by the reviewer appears with an author-specific underline and text color (e.g. Blue `#185ABD`).
   - Text deleted by the reviewer appears with a strike-through and quiet red tint.
   - A corresponding **Markup Balloon** appears in the right margin card column, stating the author, time, action (*"Inserted 'confidentiality obligations'"* or *"Deleted '30 days'"*), with checkmark (Accept) and cross (Reject) buttons.

2. **Formatting Change Tracking**:
   - When text styling (bold, italic, font family, font size, or alignment) is modified with Track Changes enabled, the system logs a format revision.
   - The margin card notes the exact formatting shift: *"Formatted: Bold, Calibri 12pt, Justified"* with an immediate undo/reject affordance.

3. **Anchored Text Comments & Threaded Discussions**:
   - The user selects any text string or clause on the document sheet and clicks the floating **New Comment** button (or ribbon action).
   - The selected text receives a warm yellow/amber discussion highlight.
   - A threaded comment card expands in the right margin showing the author's avatar, timestamp, quote excerpt, and a reply input field.
   - Collaborators can post replies, resolve the thread, or jump directly between open comment threads.

4. **Bi-Directional Change & Comment Navigation**:
   - The Review ribbon and margin header provide **Previous Change (⇦)** and **Next Change (⇨)** navigation buttons, as well as **Previous Comment** and **Next Comment** buttons.
   - Clicking Next scrolls smoothly to the target revision or comment balloon, highlighting it with an active pulse state.

5. **Revision History Integration**:
   - Users can snapshot versions (`v1.0`, `v2.0`, `v2.1`) after accepting or rejecting revisions.
   - The Version History drawer allows inspecting earlier drafts and running redline side-by-side comparisons.

### Visual Identity & Theme

- **Aesthetic Direction**: Authentic Microsoft Word Reviewing layout refined with the application's clean slate design language.
- **Color Palette & Accents**:
  - Review Bar: Microsoft Word Ribbon `#F3F4F6` with active indicator `#185ABD`.
  - Author Color Allocation: Distinctive avatar tags (Author 1: `#1D4ED8`, Author 2: `#059669`, Author 3: `#D97706`, Author 4: `#DC2626`, Author 5: `#7C3AED`).
  - Insertion Markup: Author tint background with solid underline.
  - Deletion Markup: Soft rose background `#FEE2E2` with line-through and text `#991B1B`.
  - Margin Balloon Surfaces: Crisp white cards with hairline borders (`#E5E7EB`), elevated with light shadows on focus.
- **Typography & Hierarchy**:
  - Review Headers: Clean sans (11px–12px, tabular numbers for counts and timestamps).
  - Margin Cards: 12px author title, 11px formatted diff snippets, 10px relative timestamps (`"2m ago"`, hover tooltip for ISO date).
  - Zero-Pill Discipline: Unboxed metadata using middle dots (`John Doe · Legal Counsel · 3m ago`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Responsive Margin Balloon Rail vs. Floating Popovers**
  - *Chosen Approach*: Dedicated right-hand margin track beside the 8.5" × 11" document sheet with connector guide lines.
  - *Why*: Word users expect balloons pinned in the margin parallel to the text lines, preserving document readability without obstructing contract terms. On narrower screens, the margin seamlessly converts into a slide-over review drawer.
  - *Alternatives Considered*: Hover tooltips (insufficient for reviewing multiple changes at once).

- **Decision 2: In-Memory Live Track Changes State with Persistent API Sync**
  - *Chosen Approach*: Track changes revisions and inline comment threads maintained in a reactive editor review state, synchronizing directly with the backend comments API (`/api/v1/contracts/:id/comments`) and debounced draft store.
  - *Why*: Guarantees instant sub-millisecond typing performance and responsive ribbon navigation without server lag during active typing sessions.

- **Decision 3: Granular Accept/Reject per Item + Bulk Acceptance**
  - *Chosen Approach*: Provide individual Accept/Reject triggers on every margin card, plus bulk *Accept All* / *Reject All* in the Review Ribbon.
  - *Why*: Accommodates both meticulous clause-by-clause legal redlining and rapid bulk approvals for minor drafts.

---

## 4. Technical Architecture & Data Strategy

### System Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Contract Detail Workspace                       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Office 365 Ribbon Toolbar: Home | Insert | Review | View       │   │
│   │ [Track Changes: ON] [Next Change] [Prev Change] [Accept All]   │   │
│   │ [New Comment] [Next Comment] [Prev Comment] [Markup: All]      │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                   │
│                        Two-Column Workspace View                       │
│                                    ▼                                   │
│   ┌─────────────────────────────────────┬──────────────────────────┐   │
│   │     8.5" × 11" Document Sheet       │   Word Markup Balloons   │   │
│   │                                     │     (Right Margin)       │   │
│   │  Section 1. Confidentiality         │                          │   │
│   │  Each party shall protect <ins>all  │ ┌──────────────────────┐ │   │
│   │  proprietary data</ins> <del>30     │ │ Insertion Balloon    │ │   │
│   │  days</del> for 3 years.            │ │ By John Doe · 2m ago │ │   │
│   │                                     │ │ [✓ Accept] [✕ Reject]│ │   │
│   │  Section 2. Governing Law           │ └──────────────────────┘ │   │
│   │  <mark class="comment-target">      │ ┌──────────────────────┐ │   │
│   │  Delaware jurisdiction</mark>       │ │ Threaded Comment     │ │   │
│   │                                     │ │ "Should we allow NY?"│ │   │
│   │                                     │ │ > Reply: "Agreed"    │ │   │
│   │                                     │ └──────────────────────┘ │   │
│   └─────────────────────────────────────┴──────────────────────────┘   │
│                                    │                                   │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               Review State Store & API Sync Pipeline           │   │
│   │   - Change Registry: insertions, deletions, formatting         │   │
│   │   - Threaded Comments Store & API mutations                    │   │
│   │   - Revision History & Side-by-Side Diff Engine                │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Mapping

- **Tracked Change Entity**:
  - `id`: Unique revision identifier (`chg-1`, `chg-2`)
  - `type`: `'insert' | 'delete' | 'format'`
  - `author`: `{ id, name, email, color }`
  - `timestamp`: ISO date string
  - `content`: Text snippet or formatting description
  - `status`: `'pending' | 'accepted' | 'rejected'`
- **Threaded Comment Entity**:
  - `id`: Unique comment identifier
  - `author`: `{ id, name, email, color }`
  - `timestamp`: ISO date string
  - `quoteSnippet`: Highlighted text range in contract
  - `content`: Root comment message
  - `replies`: Array of `{ id, author, content, timestamp }`
  - `isResolved`: Boolean resolution status
- **Interactive Component & State Mapping**:
  - `handleAcceptChange(changeId)`: Commits inserted text or deletes struck-through text; removes margin balloon with settling animation.
  - `handleRejectChange(changeId)`: Reverts inserted text or restores original deleted text; updates word metrics.
  - `handleJumpChange(direction)`: Finds next/previous change in document order, scrolls into view, and applies active focus ring.
  - `handleCreateComment(quoteText, content)`: Anchors highlight in DOM, inserts comment into store, opens reply thread in right margin.
  - `handleReplyComment(commentId, content)`: Appends reply to the thread with current logged-in author attribution.
  - `handleResolveComment(commentId)`: Toggles thread resolution and updates comment badges.
