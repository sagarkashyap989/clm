import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  useCallback,
  useMemo,
} from 'react';
import { DocumentEditorToolbar } from './DocumentEditorToolbar';
import { getUserColor } from '@/lib/userColor';
import { rangeForQuote, type QuotedPassage } from './quoteHighlight';
import { CollaboratorCursors } from './collaboration/CollaboratorCursors';
import { DocumentReviewMargin } from './DocumentReviewMargin';
import type {
  CollaboratorPresence,
  CursorPosition,
  SelectionRange,
  ContractComment,
  TrackedChange,
  TrackedChangeType,
} from '@cml/shared';

type DocumentEditorCanvasProps = {
  initialContent: string;
  onContentChange: (content: string) => void;
  onTriggerSaveVersion?: () => void;
  autosaveStatus?: 'saved' | 'saving' | 'unsaved';
  lastSavedAt?: string | null;
  readOnly?: boolean;
  comments?: ContractComment[];
  quotedPassages?: QuotedPassage[];
  activeQuoteId?: string | null;
  onSelectQuoteId?: (id: string | null) => void;
  onCreateSelectionComment?: (payload: {
    quoteText: string;
    content: string;
  }) => Promise<void>;
  onReplyComment?: (commentId: string, content: string) => Promise<void>;
  onResolveComment?: (commentId: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  activeUsers?: CollaboratorPresence[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserColor?: string;
  onBroadcastCursor?: (cursor: CursorPosition | null) => void;
  onBroadcastSelection?: (selection: SelectionRange | null) => void;
  notifications?: Array<{ id: string; message: string; timestamp: number }>;
  onDismissNotification?: (id: string) => void;
  onOpenVersionHistory?: () => void;
};

// Feat 1: Parse all tracked changes and format items with distinct user colors
function parseTrackedChangesFromDom(root: HTMLElement): TrackedChange[] {
  const elements = root.querySelectorAll<HTMLElement>('.cml-change-item');
  const changes: TrackedChange[] = [];

  elements.forEach((el) => {
    const id = el.dataset.changeId;
    if (!id) return;

    let type: TrackedChangeType = 'insert';
    if (el.classList.contains('cml-change-delete')) {
      type = 'delete';
    } else if (el.classList.contains('cml-change-format')) {
      type = 'format';
    }

    const authorId =
      el.dataset.authorId ||
      (el.dataset.authorName
        ? `usr_${el.dataset.authorName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
        : 'usr_collab');

    const authorName = el.dataset.authorName || 'Collaborator';
    const authorColor = el.dataset.authorColor || getUserColor(authorId || authorName);

    // Apply inline style so each user's edits visually appear in their unique color
    if (!el.style.color || el.style.color === '') {
      el.style.color = authorColor;
    }
    el.style.textDecorationColor = authorColor;

    changes.push({
      id,
      type,
      text: el.innerText || el.textContent || '',
      formatDetail: el.dataset.formatDetail || (type === 'format' ? 'Font: Bold' : undefined),
      author: {
        id: authorId,
        name: authorName,
        color: authorColor,
      },
      timestamp: el.dataset.timestamp || new Date().toISOString(),
      status: 'pending',
    });
  });

  return changes;
}

export function DocumentEditorCanvas({
  initialContent,
  onContentChange,
  onTriggerSaveVersion,
  autosaveStatus = 'saved',
  lastSavedAt,
  readOnly = false,
  comments = [],
  activeQuoteId = null,
  onSelectQuoteId,
  onCreateSelectionComment,
  onReplyComment,
  onResolveComment,
  onDeleteComment,
  activeUsers = [],
  currentUserId = 'usr_demo',
  currentUserName = 'Administrator',
  currentUserColor: propUserColor,
  onBroadcastCursor,
  onBroadcastSelection,
  notifications = [],
  onDismissNotification,
  onOpenVersionHistory,
}: DocumentEditorCanvasProps) {
  const currentUserColor = propUserColor || getUserColor(currentUserId);

  const editorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const badgeContainerRef = useRef<HTMLDivElement>(null);

  // Theme: Dark mode matching screenshot by default
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Mode: editing, suggesting (track changes), viewing
  const [trackChangesMode, setTrackChangesMode] = useState<'editing' | 'suggesting' | 'viewing'>(
    'suggesting',
  );

  // Find & Replace
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);

  // Zoom & Metrics
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);

  // Tracked Changes state
  const [trackedChanges, setTrackedChanges] = useState<TrackedChange[]>([]);
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);

  // Issue 1: Positions for aligning Markup badges next to the formatted text
  const [changePositions, setChangePositions] = useState<Record<string, number>>({});
  // Feat 2: Positions for comment icons in the right margin of the document
  const [commentPositions, setCommentPositions] = useState<Record<string, number>>({});

  // Pending comment from selection
  const [pendingQuoteText, setPendingQuoteText] = useState<string | null>(null);

  const calculateMetricsAndChanges = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    setWordCount(words);
    setCharCount(chars);

    // Parse tracked changes currently in the DOM
    const parsedChanges = parseTrackedChangesFromDom(editorRef.current);
    setTrackedChanges(parsedChanges);
  }, []);

  // Issue 1: Compute vertical coordinates so detail badges sit directly next to formatted text
  const recalculatePositions = useCallback(() => {
    if (!editorRef.current) return;
    const editorRect = editorRef.current.getBoundingClientRect();
    const scale = zoomLevel / 100;

    // 1. Changes positions for Markup & Formatting
    const changeElements = editorRef.current.querySelectorAll<HTMLElement>('.cml-change-item');
    const newChangePos: Record<string, number> = {};

    const badgeContainer = badgeContainerRef.current;
    if (badgeContainer) {
      const badgeContainerRect = badgeContainer.getBoundingClientRect();
      const currentBadgeScroll = badgeContainer.scrollTop;
      changeElements.forEach((el) => {
        const id = el.dataset.changeId;
        if (id) {
          const elRect = el.getBoundingClientRect();
          // elRect.top - badgeContainerRect.top + currentBadgeScroll matches the exact horizontal row
          const top = elRect.top - badgeContainerRect.top + currentBadgeScroll;
          newChangePos[id] = Math.max(8, top);
        }
      });
    } else {
      // Fallback relative to editor top
      changeElements.forEach((el) => {
        const id = el.dataset.changeId;
        if (id) {
          const elRect = el.getBoundingClientRect();
          const top = (elRect.top - editorRect.top) / scale + 105;
          newChangePos[id] = Math.max(8, top);
        }
      });
    }
    setChangePositions(newChangePos);

    // 2. Feat 2: Comment icon positions (sitting in the right margin next to commented text)
    const newCommentPos: Record<string, number> = {};
    comments.forEach((c) => {
      if (!c.quoteText) return;
      const range = rangeForQuote(editorRef.current!, c.quoteText);
      if (range) {
        const rects = range.getClientRects();
        const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
        if (rect && rect.top > 0) {
          const top = (rect.top - editorRect.top) / scale;
          newCommentPos[c.id] = Math.max(0, top);
        }
      }
    });
    setCommentPositions(newCommentPos);
  }, [comments, zoomLevel]);

  // Recalculate positions after DOM updates or window resizes
  useEffect(() => {
    const timer = setTimeout(() => {
      recalculatePositions();
    }, 100);
    return () => clearTimeout(timer);
  }, [initialContent, trackedChanges.length, comments, recalculatePositions]);

  useEffect(() => {
    window.addEventListener('resize', recalculatePositions);
    return () => window.removeEventListener('resize', recalculatePositions);
  }, [recalculatePositions]);

  // Synchronize scrolling between Document Canvas and Markup & Formatting column
  const handleCanvasScroll = useCallback(() => {
    if (badgeContainerRef.current && canvasContainerRef.current) {
      badgeContainerRef.current.scrollTop = canvasContainerRef.current.scrollTop;
    }
  }, []);

  const handleBadgeScroll = useCallback(() => {
    if (badgeContainerRef.current && canvasContainerRef.current) {
      canvasContainerRef.current.scrollTop = badgeContainerRef.current.scrollTop;
    }
  }, []);

  // Feat 2: Stagger comment icons so multiple comments on the same/adjacent lines do not overlap
  const resolvedCommentPositions = useMemo(() => {
    const sorted = [...comments].sort(
      (a, b) => (commentPositions[a.id] ?? 0) - (commentPositions[b.id] ?? 0),
    );
    let lastY = 0;
    const posMap: Record<string, number> = {};
    sorted.forEach((c) => {
      const rawY = commentPositions[c.id];
      if (typeof rawY !== 'number') return;
      const finalY = Math.max(rawY, lastY);
      posMap[c.id] = finalY;
      lastY = finalY + 28; // clearance for 24px icon
    });
    return posMap;
  }, [comments, commentPositions]);

  // Initialize or update editor content from remote/initial
  useEffect(() => {
    if (!editorRef.current) return;

    if (editorRef.current.innerHTML !== initialContent) {
      const isFocused =
        document.activeElement === editorRef.current ||
        Boolean(editorRef.current.contains(document.activeElement));

      if (!isFocused) {
        editorRef.current.innerHTML =
          initialContent || '<p>Start typing your contract clauses here...</p>';
        calculateMetricsAndChanges();
      } else {
        const sel = window.getSelection();
        let savedRange: Range | null = null;
        if (sel && sel.rangeCount > 0) {
          try {
            savedRange = sel.getRangeAt(0).cloneRange();
          } catch {
            savedRange = null;
          }
        }
        editorRef.current.innerHTML =
          initialContent || '<p>Start typing your contract clauses here...</p>';
        calculateMetricsAndChanges();
        if (savedRange && sel) {
          try {
            sel.removeAllRanges();
            sel.addRange(savedRange);
          } catch {
            // Ignore DOM restructuring
          }
        }
      }
    }
  }, [initialContent, calculateMetricsAndChanges]);

  // Accurate local cursor & selection broadcaster
  const broadcastLocalCursor = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) {
      onBroadcastCursor?.(null);
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !editorRef.current.contains(anchorNode)) {
      onBroadcastCursor?.(null);
      return;
    }

    const range = selection.getRangeAt(0);

    // 1. Calculate precise character offset
    let characterOffset = 0;
    const treeWalker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
      if (currentNode === range.startContainer) {
        characterOffset += range.startOffset;
        break;
      }
      characterOffset += (currentNode.textContent || '').length;
      currentNode = treeWalker.nextNode();
    }

    // 2. Measure client rect accurately
    let clientRect: DOMRect | null = null;
    const clientRects = range.getClientRects();
    if (clientRects.length > 0) {
      clientRect = clientRects[0];
    } else {
      const parentEl =
        range.startContainer instanceof HTMLElement
          ? range.startContainer
          : range.startContainer.parentElement;
      if (parentEl) {
        clientRect = parentEl.getBoundingClientRect();
      }
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    const scale = zoomLevel / 100;
    const unscaledX = clientRect ? (clientRect.left - editorRect.left) / scale : 0;
    const unscaledY = clientRect ? (clientRect.top - editorRect.top) / scale : 0;
    const caretHeight = clientRect ? Math.max(16, clientRect.height / scale) : 20;

    // Paragraph index
    const paragraphs = Array.from(editorRef.current.children);
    const curP = range.startContainer.parentElement?.closest(
      '#contract-editable-content > *',
    );
    const paragraphIndex = curP ? paragraphs.indexOf(curP) : 0;

    onBroadcastCursor?.({
      characterOffset,
      paragraphIndex,
      unscaledX,
      unscaledY,
      caretHeight,
      xRatio:
        editorRect.width > 0
          ? clientRect
            ? (clientRect.left - editorRect.left) / editorRect.width
            : 0
          : 0,
      yRatio:
        editorRect.height > 0
          ? clientRect
            ? (clientRect.top - editorRect.top) / editorRect.height
            : 0
          : 0,
    });

    if (!selection.isCollapsed) {
      const quote = selection.toString().replace(/\s+/g, ' ').trim();
      onBroadcastSelection?.({ quoteText: quote.slice(0, 500) });
    } else {
      onBroadcastSelection?.(null);
    }
  }, [onBroadcastCursor, onBroadcastSelection, zoomLevel]);

  // Trigger input change
  function handleInput() {
    if (!editorRef.current) return;
    calculateMetricsAndChanges();
    onContentChange(editorRef.current.innerHTML);
    broadcastLocalCursor();
    recalculatePositions();
  }

  // Feat 1: Different user editing text gets that user's distinct color
  function handleBeforeInput(e: any) {
    if (readOnly || trackChangesMode === 'viewing') return;

    if (e.inputType === 'insertText' && e.data) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const node = sel.anchorNode;
      const parent = node instanceof HTMLElement ? node : node?.parentElement;
      const existingAuthorSpan = parent?.closest<HTMLElement>('.cml-change-item');

      // If the cursor is already inside the current user's editing span (and not a deleted span):
      // allow native browser insertion so consecutive typing flows naturally with zero keystroke fragmentation!
      if (
        existingAuthorSpan &&
        existingAuthorSpan.dataset.authorId === currentUserId &&
        !existingAuthorSpan.classList.contains('cml-change-delete')
      ) {
        return; // native insert inside author's colored span
      }

      // Otherwise, create a clean author span for the current user and insert the character
      e.preventDefault();
      const changeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const span = document.createElement('span');
      span.className = 'cml-change-item cml-change-insert';
      span.dataset.changeId = changeId;
      span.dataset.authorId = currentUserId;
      span.dataset.authorName = currentUserName;
      span.dataset.authorColor = currentUserColor;
      span.dataset.timestamp = new Date().toISOString();
      span.style.color = currentUserColor;
      span.style.textDecoration = trackChangesMode === 'suggesting' ? 'underline' : 'none';
      span.style.textDecorationColor = currentUserColor;

      const textNode = document.createTextNode(e.data);
      span.appendChild(textNode);

      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(span);

      // Place caret right after the inserted character inside the span
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      handleInput();
    }
  }

  // Feat 1: Paste handler with distinct user color
  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    if (readOnly || trackChangesMode === 'viewing') return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    e.preventDefault();
    const changeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const span = document.createElement('span');
    span.className = 'cml-change-item cml-change-insert';
    span.dataset.changeId = changeId;
    span.dataset.authorId = currentUserId;
    span.dataset.authorName = currentUserName;
    span.dataset.authorColor = currentUserColor;
    span.dataset.timestamp = new Date().toISOString();
    span.style.color = currentUserColor;
    span.style.textDecoration = trackChangesMode === 'suggesting' ? 'underline' : 'none';
    span.style.textDecorationColor = currentUserColor;
    span.textContent = text;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(span);
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    handleInput();
  }

  // Feat 1: Delete in suggesting mode with distinct user color
  function deleteTrackedText() {
    if (!editorRef.current) return false;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return false;

    const changeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const spanHtml = `<span class="cml-change-item cml-change-delete" data-change-id="${changeId}" data-author-id="${currentUserId}" data-author-name="${currentUserName}" data-author-color="${currentUserColor}" style="color: ${currentUserColor}; text-decoration: line-through; text-decoration-color: ${currentUserColor};">${selectedText}</span>`;

    document.execCommand('insertHTML', false, spanHtml);
    handleInput();
    return true;
  }

  // Feat 1: Formatting command with distinct user color
  function handleCommand(command: string, value?: string) {
    if (readOnly || trackChangesMode === 'viewing') return;
    if (editorRef.current) {
      editorRef.current.focus();
    }

    if (trackChangesMode === 'suggesting') {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const selectedText = selection.toString();
        const changeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        let formatDetail = command;
        let styleAttr = '';
        if (command === 'bold') {
          formatDetail = 'Font: Bold';
          styleAttr = 'font-weight: 700;';
        } else if (command === 'italic') {
          formatDetail = 'Font: Italic';
          styleAttr = 'font-style: italic;';
        } else if (command === 'underline') {
          formatDetail = 'Font: Underline';
          styleAttr = 'text-decoration: underline;';
        } else if (command === 'strikeThrough') {
          formatDetail = 'Font: Strikethrough';
          styleAttr = 'text-decoration: line-through;';
        } else if (command === 'formatBlock') {
          formatDetail = value ? `Heading ${value.replace(/[<>/]/g, '')}` : 'Heading';
        }

        const spanHtml = `<span class="cml-change-item cml-change-format" data-change-id="${changeId}" data-format="${command}" data-format-detail="${formatDetail}" data-author-id="${currentUserId}" data-author-name="${currentUserName}" data-author-color="${currentUserColor}" style="color: ${currentUserColor}; text-decoration: underline; text-decoration-color: ${currentUserColor}; ${styleAttr}">${selectedText}</span>`;
        document.execCommand('insertHTML', false, spanHtml);
        handleInput();
        return;
      }
    }

    // Default editing command
    document.execCommand(command, false, value);
    handleInput();
  }

  // Keyboard navigation & shortcuts
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Ctrl+S / Cmd+S -> Trigger Save Version
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onTriggerSaveVersion?.();
      return;
    }

    // Ctrl+F -> Toggle Find & Replace
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setIsFindOpen((prev) => !prev);
      return;
    }

    // Ctrl+M -> Comment on selected text
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm' && !e.shiftKey) {
      e.preventDefault();
      handleTriggerComment();
      return;
    }

    // Suggesting mode: Handle Backspace / Delete on selected text
    if (
      trackChangesMode === 'suggesting' &&
      (e.key === 'Backspace' || e.key === 'Delete')
    ) {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        e.preventDefault();
        deleteTrackedText();
        return;
      }
    }
  }

  function captureSelection() {
    broadcastLocalCursor();
  }

  function handleTriggerComment() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !editorRef.current) return;
    const quote = selection.toString().replace(/\s+/g, ' ').trim();
    if (quote) {
      setPendingQuoteText(quote);
    }
  }

  // Clicking a formatted element in the editor selects its detail badge in Markup & Formatting
  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const changeEl = target.closest<HTMLElement>('.cml-change-item');
    if (changeEl && changeEl.dataset.changeId) {
      handleSelectChange(changeEl.dataset.changeId);
    }
  }

  // Select Change and scroll both editor and markup badge into view
  function handleSelectChange(changeId: string) {
    setActiveChangeId(changeId);
    if (!editorRef.current) return;
    const el = editorRef.current.querySelector<HTMLElement>(`[data-change-id="${changeId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('cml-focus-pulse');
      setTimeout(() => el.classList.remove('cml-focus-pulse'), 2500);
    }
  }

  // Feat 2: Clicks comment icon on the right of the document -> highlights the actual comment in comments column
  function handleSelectComment(commentId: string) {
    onSelectQuoteId?.(commentId);
    if (!editorRef.current) return;
    const comment = comments.find((c) => c.id === commentId);
    if (!comment?.quoteText) return;

    // Scroll to the commented line in the document smoothly
    const range = rangeForQuote(editorRef.current, comment.quoteText);
    const node = range?.startContainer;
    const el = node instanceof HTMLElement ? node : node?.parentElement;
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // Next / Prev Navigation for Changes
  function handleNextChange() {
    if (trackedChanges.length === 0) return;
    const currentIdx = trackedChanges.findIndex((c) => c.id === activeChangeId);
    const nextIdx = (currentIdx + 1) % trackedChanges.length;
    handleSelectChange(trackedChanges[nextIdx].id);
  }

  function handlePrevChange() {
    if (trackedChanges.length === 0) return;
    const currentIdx = trackedChanges.findIndex((c) => c.id === activeChangeId);
    const prevIdx = currentIdx <= 0 ? trackedChanges.length - 1 : currentIdx - 1;
    handleSelectChange(trackedChanges[prevIdx].id);
  }

  // Next / Prev Navigation for Comments
  function handleNextComment() {
    if (comments.length === 0) return;
    const currentIdx = comments.findIndex((c) => c.id === activeQuoteId);
    const nextIdx = (currentIdx + 1) % comments.length;
    handleSelectComment(comments[nextIdx].id);
  }

  function handlePrevComment() {
    if (comments.length === 0) return;
    const currentIdx = comments.findIndex((c) => c.id === activeQuoteId);
    const prevIdx = currentIdx <= 0 ? comments.length - 1 : currentIdx - 1;
    handleSelectComment(comments[prevIdx].id);
  }

  // Find & Replace
  function handleFind() {
    if (!findTerm || !editorRef.current) {
      setMatchCount(0);
      return;
    }
    const text = editorRef.current.innerText.toLowerCase();
    const matches = text.split(findTerm.toLowerCase()).length - 1;
    setMatchCount(matches);
  }

  function handleReplace() {
    if (!findTerm || !editorRef.current || readOnly) return;
    const html = editorRef.current.innerHTML;
    const regex = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (regex.test(html)) {
      editorRef.current.innerHTML = html.replace(regex, replaceTerm);
      handleInput();
      handleFind();
    }
  }

  function handleReplaceAll() {
    if (!findTerm || !editorRef.current || readOnly) return;
    const html = editorRef.current.innerHTML;
    const regex = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    editorRef.current.innerHTML = html.replace(regex, replaceTerm);
    handleInput();
    handleFind();
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border shadow-card overflow-hidden transition-colors ${
        isDarkMode
          ? 'border-zinc-800 bg-[#09090b] text-zinc-100'
          : 'border-ink-100 bg-white text-ink-900'
      }`}
    >
      {/* Top Formatting & Controls Toolbar */}
      <DocumentEditorToolbar
        onCommand={handleCommand}
        onToggleFind={() => setIsFindOpen((prev) => !prev)}
        onCommentSelection={handleTriggerComment}
        isFindOpen={isFindOpen}
        readOnly={readOnly || trackChangesMode === 'viewing'}
        trackChangesMode={trackChangesMode}
        onChangeTrackChangesMode={setTrackChangesMode}
        onNextComment={handleNextComment}
        onPrevComment={handlePrevComment}
        onNextChange={handleNextChange}
        onPrevChange={handlePrevChange}
        commentCount={comments.length}
        changeCount={trackedChanges.length}
        onOpenVersionHistory={onOpenVersionHistory}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((prev) => !prev)}
      />

      {/* Find & Replace Banner */}
      {isFindOpen && (
        <div
          id="find-replace-banner"
          className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs transition ${
            isDarkMode
              ? 'border-zinc-800 bg-zinc-900 text-zinc-200'
              : 'border-ink-100 bg-amber-50/70 text-ink-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-400">Find:</span>
            <input
              type="text"
              placeholder="Search contract text..."
              value={findTerm}
              onChange={(e) => {
                setFindTerm(e.target.value);
                if (!e.target.value) setMatchCount(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleFind()}
              className={`rounded-md border px-2 py-1 text-xs focus:border-accent focus:outline-none ${
                isDarkMode
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-100 placeholder-zinc-500'
                  : 'border-ink-200 bg-white text-ink-900'
              }`}
            />
            <button
              type="button"
              onClick={handleFind}
              className="rounded-md bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-600"
            >
              Find
            </button>
            {matchCount !== null && (
              <span className="text-[11px] font-medium text-zinc-400">
                {matchCount} match{matchCount === 1 ? '' : 'es'}
              </span>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5 border-l border-zinc-700 pl-3">
              <span className="font-semibold text-zinc-400">Replace:</span>
              <input
                type="text"
                placeholder="Replacement text..."
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                className={`rounded-md border px-2 py-1 text-xs focus:border-accent focus:outline-none ${
                  isDarkMode
                    ? 'border-zinc-700 bg-zinc-800 text-zinc-100 placeholder-zinc-500'
                    : 'border-ink-200 bg-white text-ink-900'
                }`}
              />
              <button
                type="button"
                onClick={handleReplace}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Replace All
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFindOpen(false)}
            className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Split Layout: Document Paper (Left/Center) + Review Rails (Middle Markup & Right Comments) */}
      <div className="flex flex-col lg:flex-row min-h-[660px] divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        {/* Document Canvas Container */}
        <div
          ref={canvasContainerRef}
          onScroll={handleCanvasScroll}
          className={`flex-1 overflow-auto p-4 sm:p-6 lg:p-8 flex justify-center ${
            isDarkMode ? 'bg-[#121215]' : 'bg-slate-100/70'
          }`}
        >
          <div
            className="w-full transition-transform origin-top"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              maxWidth: '840px',
            }}
          >
            {/* Document Paper Layout */}
            <div
              id="contract-document-page"
              ref={pageRef}
              className={`relative min-h-[940px] rounded-xl border p-8 sm:p-12 pr-14 shadow-sm transition ${
                isDarkMode
                  ? 'border-zinc-800/90 bg-[#18181c] text-zinc-100'
                  : 'border-ink-200/90 bg-white text-ink-900'
              }`}
            >
              {/* Document Header Line */}
              <div className="mb-6 flex items-center justify-between border-b border-zinc-800/70 pb-3 text-[11px] uppercase tracking-wider text-zinc-500">
                <span className="font-semibold text-zinc-400">
                  CLM Legal Workspace — Contract Document
                </span>
                <div className="flex items-center gap-2">
                  {trackChangesMode === 'suggesting' && (
                    <span className="rounded bg-red-950/40 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-800/50">
                      ⚡ Redline / Track Changes Active
                    </span>
                  )}
                  <span>Confidential</span>
                </div>
              </div>

              {/* Editable Container with Accurate Collaborator Cursors Overlay */}
              <div className="relative">
                {/* 100% Accurate Collaborator Cursors & Selection Highlights */}
                <CollaboratorCursors
                  presences={activeUsers}
                  currentUserId={currentUserId}
                  editorRef={editorRef}
                />

                {/* Feat 1: Rich-Text Editable Content with multi-user color rendering */}
                <div
                  ref={editorRef}
                  id="contract-editable-content"
                  contentEditable={!readOnly && trackChangesMode !== 'viewing'}
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onBeforeInput={handleBeforeInput}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  onMouseUp={captureSelection}
                  onKeyUp={captureSelection}
                  onClick={handleEditorClick}
                  className={`editor-doc relative z-10 prose max-w-none focus:outline-none ${
                    isDarkMode
                      ? 'prose-invert text-zinc-100 [&>p]:leading-relaxed [&>p]:mb-4 font-sans text-sm'
                      : 'prose-slate text-ink-900 [&>p]:leading-relaxed [&>p]:mb-4 font-sans text-sm'
                  } [&>blockquote]:border-l-4 [&>blockquote]:border-blue-500 [&>blockquote]:p-3 [&>h2]:mb-3 [&>h2]:mt-6 [&>h2]:font-serif [&>h2]:text-xl [&>h2]:font-bold [&>h3]:mb-2 [&>h3]:mt-4 [&>h3]:font-serif [&>h3]:text-base [&>h3]:font-semibold`}
                />

                {/* FEAT 2: Comment Icons on the right of the document next to commented text (NO text highlight) */}
                <div className="absolute -right-10 sm:-right-12 top-0 bottom-0 w-10 pointer-events-none z-20">
                  {comments.map((comment) => {
                    const top = resolvedCommentPositions[comment.id];
                    if (typeof top !== 'number') return null;
                    const isCommentActive = comment.id === activeQuoteId;

                    return (
                      <button
                        key={`comment-icon-${comment.id}`}
                        type="button"
                        title={`Comment by ${comment.author.name}: "${comment.content.slice(
                          0,
                          50,
                        )}..." (Click to highlight comment)`}
                        onClick={() => handleSelectComment(comment.id)}
                        style={{ top: `${top}px` }}
                        className={`pointer-events-auto absolute left-0 -translate-y-1/2 flex items-center justify-center rounded-full p-2 transition-all duration-200 cursor-pointer shadow-md ${
                          isCommentActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-125 z-30 ring-2 ring-white/80'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-blue-600 hover:text-white hover:scale-110 border border-zinc-700'
                        }`}
                      >
                        {/* Speech bubble icon matching screenshot */}
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Document Footer */}
              <div className="mt-14 flex items-center justify-between border-t border-zinc-800/70 pt-4 text-[11px] text-zinc-500">
                <span>Acme Contracts Legal Repository</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Margin Review Rail (ISSUE 1: Markup detail badges positioned next to formatted text) */}
        <DocumentReviewMargin
          comments={comments}
          activeCommentId={activeQuoteId}
          onSelectComment={handleSelectComment}
          onReplyComment={async (commentId, content) => {
            if (onReplyComment) await onReplyComment(commentId, content);
          }}
          onResolveComment={async (commentId) => {
            if (onResolveComment) await onResolveComment(commentId);
          }}
          onDeleteComment={onDeleteComment}
          onCreateComment={async (quoteText, content) => {
            if (onCreateSelectionComment) {
              await onCreateSelectionComment({ quoteText, content });
            }
          }}
          pendingQuoteText={pendingQuoteText}
          onCancelPendingComment={() => setPendingQuoteText(null)}
          trackedChanges={trackedChanges}
          activeChangeId={activeChangeId}
          onSelectChange={handleSelectChange}
          trackChangesMode={trackChangesMode}
          onChangeTrackChangesMode={setTrackChangesMode}
          readOnly={readOnly}
          changePositions={changePositions}
          commentPositions={commentPositions}
          badgeContainerRef={badgeContainerRef}
          onBadgeScroll={handleBadgeScroll}
        />
      </div>

      {/* Bottom Status & Metrics Bar */}
      <div
        id="editor-status-bar"
        className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-xs ${
          isDarkMode
            ? 'border-zinc-800 bg-[#0d0d10] text-zinc-400'
            : 'border-ink-100 bg-slate-50 text-ink-600'
        }`}
      >
        {/* Left: Autosave & Mode indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {autosaveStatus === 'saving' && (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                <span className="text-amber-500 font-medium">Autosaving draft...</span>
              </>
            )}
            {autosaveStatus === 'saved' && (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-500 font-medium">Draft autosaved</span>
                {lastSavedAt && (
                  <span className="text-zinc-500">
                    (
                    {new Date(lastSavedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    )
                  </span>
                )}
              </>
            )}
            {autosaveStatus === 'unsaved' && (
              <>
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                <span className="text-zinc-400">Unsaved changes (Ctrl+S to save new version)</span>
              </>
            )}
          </div>

          <div className="h-3 w-px bg-zinc-700 hidden sm:block" />

          <div className="text-[11px] font-semibold text-zinc-400 hidden sm:block">
            Mode:{' '}
            <span
              className={
                trackChangesMode === 'suggesting'
                  ? 'text-red-400 font-bold'
                  : 'text-zinc-200'
              }
            >
              {trackChangesMode === 'suggesting'
                ? '⚡ Redline / Track Changes'
                : trackChangesMode === 'viewing'
                ? 'Viewing'
                : 'Editing'}
            </span>
          </div>
        </div>

        {/* Right: Metrics & Zoom */}
        <div className="flex items-center gap-4 text-zinc-400">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
          <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-zinc-700 pl-3">
            <button
              type="button"
              title="Zoom out"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="rounded px-1.5 py-0.5 hover:bg-zinc-800 hover:text-zinc-100"
            >
              −
            </button>
            <span className="w-10 text-center font-mono text-[11px] font-medium">{zoomLevel}%</span>
            <button
              type="button"
              title="Zoom in"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="rounded px-1.5 py-0.5 hover:bg-zinc-800 hover:text-zinc-100"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Collaborator Activity Toasts */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="pointer-events-auto flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-2.5 text-xs font-semibold text-zinc-100 shadow-xl backdrop-blur transition"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{notif.message}</span>
              {onDismissNotification && (
                <button
                  type="button"
                  onClick={() => onDismissNotification(notif.id)}
                  className="ml-2 text-zinc-400 hover:text-zinc-200"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
