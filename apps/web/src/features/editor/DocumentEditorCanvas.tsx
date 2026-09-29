import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  useCallback,
  useMemo,
} from 'react';
import { DocumentEditorToolbar } from './DocumentEditorToolbar';
import {
  applyQuoteHighlights,
  clearQuoteHighlights,
  rangeForQuote,
  type QuotedPassage,
} from './quoteHighlight';
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

// Helper: parse all tracked changes from DOM
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

    changes.push({
      id,
      type,
      text: el.innerText || el.textContent || '',
      formatDetail: el.dataset.formatDetail,
      author: {
        id: el.dataset.authorId || 'usr_unknown',
        name: el.dataset.authorName || 'Collaborator',
        color: el.dataset.authorColor || '#0d9488',
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
  quotedPassages = [],
  activeQuoteId = null,
  onSelectQuoteId,
  onCreateSelectionComment,
  onReplyComment,
  onResolveComment,
  onDeleteComment,
  activeUsers = [],
  currentUserId = 'usr_demo',
  currentUserName = 'Administrator',
  currentUserColor = '#0f766e',
  onBroadcastCursor,
  onBroadcastSelection,
  notifications = [],
  onDismissNotification,
  onOpenVersionHistory,
}: DocumentEditorCanvasProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

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
            // Ignore if DOM elements restructured
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
      // Fallback: measure bounding rect or parent node rect
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
      xRatio: editorRect.width > 0 ? (clientRect ? (clientRect.left - editorRect.left) / editorRect.width : 0) : 0,
      yRatio: editorRect.height > 0 ? (clientRect ? (clientRect.top - editorRect.top) / editorRect.height : 0) : 0,
    });

    if (!selection.isCollapsed) {
      const quote = selection.toString().replace(/\s+/g, ' ').trim();
      onBroadcastSelection?.({ quoteText: quote.slice(0, 500) });
    } else {
      onBroadcastSelection?.(null);
    }
  }, [onBroadcastCursor, onBroadcastSelection, zoomLevel]);

  // Apply quote highlights
  const effectivePassages = useMemo(() => {
    if (quotedPassages.length > 0) return quotedPassages;
    return comments.map((c) => ({
      id: c.id,
      quoteText: c.quoteText || '',
      isResolved: c.isResolved,
    }));
  }, [quotedPassages, comments]);

  useEffect(() => {
    if (!editorRef.current) return;
    applyQuoteHighlights(editorRef.current, effectivePassages, activeQuoteId);
    return () => clearQuoteHighlights();
  }, [effectivePassages, activeQuoteId, initialContent]);

  // Trigger input change
  function handleInput() {
    if (!editorRef.current) return;
    calculateMetricsAndChanges();
    onContentChange(editorRef.current.innerHTML);
    broadcastLocalCursor();
    applyQuoteHighlights(editorRef.current, effectivePassages, activeQuoteId);
  }

  // Handle Track Changes: Insertions
  function insertTrackedText(text: string) {
    if (!editorRef.current) return;
    const changeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const spanHtml = `<span class="cml-change-item cml-change-insert" data-change-id="${changeId}" data-author-id="${currentUserId}" data-author-name="${currentUserName}" data-author-color="${currentUserColor}" data-timestamp="${new Date().toISOString()}">${text}</span>`;
    document.execCommand('insertHTML', false, spanHtml);
    handleInput();
  }

  // Handle Track Changes: Deletions
  function deleteTrackedText() {
    if (!editorRef.current) return false;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;

    const selectedText = selection.toString();
    if (!selectedText.trim()) return false;

    const changeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const spanHtml = `<span class="cml-change-item cml-change-delete" data-change-id="${changeId}" data-author-id="${currentUserId}" data-author-name="${currentUserName}" data-author-color="${currentUserColor}" data-timestamp="${new Date().toISOString()}">${selectedText}</span>`;

    document.execCommand('insertHTML', false, spanHtml);
    handleInput();
    return true;
  }

  // Handle formatting command with track changes support
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
          formatDetail = 'Bold';
          styleAttr = 'font-weight: 700;';
        } else if (command === 'italic') {
          formatDetail = 'Italic';
          styleAttr = 'font-style: italic;';
        } else if (command === 'underline') {
          formatDetail = 'Underline';
          styleAttr = 'text-decoration: underline;';
        } else if (command === 'strikeThrough') {
          formatDetail = 'Strikethrough';
          styleAttr = 'text-decoration: line-through;';
        } else if (command === 'formatBlock') {
          formatDetail = value ? `Heading ${value.replace(/[<>/]/g, '')}` : 'Heading';
        }

        const spanHtml = `<span class="cml-change-item cml-change-format" data-change-id="${changeId}" data-format="${command}" data-format-detail="${formatDetail}" data-author-id="${currentUserId}" data-author-name="${currentUserName}" data-author-color="${currentUserColor}" data-timestamp="${new Date().toISOString()}" style="${styleAttr}">${selectedText}</span>`;
        document.execCommand('insertHTML', false, spanHtml);
        handleInput();
        return;
      }
    }

    // Default editing command
    document.execCommand(command, false, value);
    handleInput();
  }

  // Keyboard navigation & track changes shortcuts
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

  // Handle BeforeInput for typing in Suggesting mode
  function handleBeforeInput(e: any) {
    if (trackChangesMode !== 'suggesting' || readOnly) return;

    if (e.inputType === 'insertText' && e.data) {
      e.preventDefault();
      insertTrackedText(e.data);
    }
  }

  // Capture selection for comments
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

  // Accept a Tracked Change
  function handleAcceptChange(changeId: string) {
    if (!editorRef.current) return;
    const el = editorRef.current.querySelector<HTMLElement>(`[data-change-id="${changeId}"]`);
    if (!el) return;

    if (el.classList.contains('cml-change-insert')) {
      // Keep inserted text: unwrap span
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    } else if (el.classList.contains('cml-change-delete')) {
      // Permanently remove deleted text
      el.remove();
    } else if (el.classList.contains('cml-change-format')) {
      // Keep format, unwrap change tracking span
      const parent = el.parentNode;
      const formattedSpan = document.createElement('span');
      if (el.getAttribute('style')) {
        formattedSpan.setAttribute('style', el.getAttribute('style') || '');
      }
      while (el.firstChild) {
        formattedSpan.appendChild(el.firstChild);
      }
      parent?.insertBefore(formattedSpan, el);
      parent?.removeChild(el);
    }

    handleInput();
  }

  // Reject a Tracked Change
  function handleRejectChange(changeId: string) {
    if (!editorRef.current) return;
    const el = editorRef.current.querySelector<HTMLElement>(`[data-change-id="${changeId}"]`);
    if (!el) return;

    if (el.classList.contains('cml-change-insert')) {
      // Discard inserted text
      el.remove();
    } else if (el.classList.contains('cml-change-delete')) {
      // Revert deleted text: unwrap span back to normal text
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    } else if (el.classList.contains('cml-change-format')) {
      // Strip formatting, unwrap
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    }

    handleInput();
  }

  // Accept All Changes
  function handleAcceptAllChanges() {
    if (!editorRef.current) return;
    const changeElements = Array.from(
      editorRef.current.querySelectorAll<HTMLElement>('.cml-change-item'),
    );
    changeElements.forEach((el) => {
      const id = el.dataset.changeId;
      if (id) handleAcceptChange(id);
    });
  }

  // Reject All Changes
  function handleRejectAllChanges() {
    if (!editorRef.current) return;
    const changeElements = Array.from(
      editorRef.current.querySelectorAll<HTMLElement>('.cml-change-item'),
    );
    changeElements.forEach((el) => {
      const id = el.dataset.changeId;
      if (id) handleRejectChange(id);
    });
  }

  // Select Change and scroll into view
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

  // Select Comment and scroll quote into view
  function handleSelectComment(commentId: string) {
    onSelectQuoteId?.(commentId);
    if (!editorRef.current) return;
    const comment = comments.find((c) => c.id === commentId);
    if (!comment?.quoteText) return;

    const range = rangeForQuote(editorRef.current, comment.quoteText);
    const node = range?.startContainer;
    const el = node instanceof HTMLElement ? node : node?.parentElement;
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('cml-focus-pulse');
      setTimeout(() => el.classList.remove('cml-focus-pulse'), 2500);
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
    const prevIdx =
      currentIdx <= 0 ? trackedChanges.length - 1 : currentIdx - 1;
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
    <div className="flex flex-col rounded-2xl border border-ink-100 bg-white shadow-card overflow-hidden">
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
      />

      {/* Find & Replace Banner */}
      {isFindOpen && (
        <div
          id="find-replace-banner"
          className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-amber-50/70 px-4 py-2 text-xs text-ink-800 transition"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-ink-600">Find:</span>
            <input
              type="text"
              placeholder="Search contract text..."
              value={findTerm}
              onChange={(e) => {
                setFindTerm(e.target.value);
                if (!e.target.value) setMatchCount(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleFind()}
              className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900 focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={handleFind}
              className="rounded-md bg-ink-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-900"
            >
              Find
            </button>
            {matchCount !== null && (
              <span className="text-[11px] font-medium text-ink-600">
                {matchCount} match{matchCount === 1 ? '' : 'es'}
              </span>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5 border-l border-ink-200 pl-3">
              <span className="font-semibold text-ink-600">Replace:</span>
              <input
                type="text"
                placeholder="Replacement text..."
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={handleReplace}
                className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-800 hover:bg-slate-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-800 hover:bg-slate-50"
              >
                Replace All
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFindOpen(false)}
            className="ml-auto rounded p-1 text-ink-500 hover:bg-amber-100 hover:text-ink-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Split Layout: Document Paper (Center) + Comments & Changes Gutter (Right) */}
      <div className="flex flex-col lg:flex-row min-h-[620px] divide-y lg:divide-y-0 lg:divide-x divide-ink-100">
        {/* Document Canvas Container */}
        <div className="flex-1 overflow-auto bg-slate-100/70 p-4 sm:p-6 lg:p-8 flex justify-center">
          <div
            className="w-full transition-transform origin-top"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              maxWidth: '820px',
            }}
          >
            {/* Simulated 8.5 x 11 Page Layout */}
            <div
              id="contract-document-page"
              ref={pageRef}
              className="relative min-h-[920px] rounded-xl border border-ink-200/90 bg-white p-8 sm:p-12 shadow-sm transition"
            >
              {/* Document Header Line */}
              <div className="mb-6 flex items-center justify-between border-b border-ink-100 pb-3 text-[11px] uppercase tracking-wider text-ink-400">
                <span className="font-semibold text-ink-600">
                  CLM Legal Workspace — Contract Document
                </span>
                <div className="flex items-center gap-2">
                  {trackChangesMode === 'suggesting' && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      ⚡ Track Changes Mode
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

                {/* Rich-Text Editable Content */}
                <div
                  ref={editorRef}
                  id="contract-editable-content"
                  contentEditable={!readOnly && trackChangesMode !== 'viewing'}
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onBeforeInput={handleBeforeInput}
                  onKeyDown={handleKeyDown}
                  onMouseUp={captureSelection}
                  onKeyUp={captureSelection}
                  className="editor-doc relative z-10 prose prose-slate max-w-none text-ink-900 focus:outline-none [&>blockquote]:border-l-4 [&>blockquote]:border-accent [&>blockquote]:bg-slate-50 [&>blockquote]:p-3 [&>h2]:mb-3 [&>h2]:mt-6 [&>h2]:font-serif [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-ink-950 [&>h3]:mb-2 [&>h3]:mt-4 [&>h3]:font-serif [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-ink-900 [&>p]:mb-3 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
                />
              </div>

              {/* Document Footer */}
              <div className="mt-14 flex items-center justify-between border-t border-ink-100 pt-4 text-[11px] text-ink-400">
                <span>Acme Contracts Legal Repository</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Margin Review Rail (Always Visible Beside the Document Clauses) */}
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
          onAcceptChange={handleAcceptChange}
          onRejectChange={handleRejectChange}
          onAcceptAllChanges={handleAcceptAllChanges}
          onRejectAllChanges={handleRejectAllChanges}
          trackChangesMode={trackChangesMode}
          onChangeTrackChangesMode={setTrackChangesMode}
          readOnly={readOnly}
          currentUserId={currentUserId}
        />
      </div>

      {/* Bottom Status & Metrics Bar */}
      <div
        id="editor-status-bar"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-slate-50 px-4 py-2.5 text-xs text-ink-600"
      >
        {/* Left: Autosave & Mode indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {autosaveStatus === 'saving' && (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                <span className="text-amber-700 font-medium">Autosaving draft...</span>
              </>
            )}
            {autosaveStatus === 'saved' && (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-medium">Draft autosaved</span>
                {lastSavedAt && (
                  <span className="text-ink-400">
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
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-ink-500">Unsaved changes (Ctrl+S to commit version)</span>
              </>
            )}
          </div>

          <div className="h-3 w-px bg-ink-200 hidden sm:block" />

          <div className="text-[11px] font-semibold text-ink-500 hidden sm:block">
            Mode:{' '}
            <span
              className={
                trackChangesMode === 'suggesting'
                  ? 'text-emerald-700 font-bold'
                  : 'text-ink-800'
              }
            >
              {trackChangesMode === 'suggesting'
                ? '⚡ Suggesting (Track Changes)'
                : trackChangesMode === 'viewing'
                ? 'Viewing'
                : 'Editing'}
            </span>
          </div>
        </div>

        {/* Right: Metrics & Zoom */}
        <div className="flex items-center gap-4 text-ink-500">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
          <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-ink-200 pl-3">
            <button
              type="button"
              title="Zoom out"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="rounded px-1.5 py-0.5 hover:bg-ink-100 hover:text-ink-900"
            >
              −
            </button>
            <span className="w-10 text-center font-mono text-[11px] font-medium">{zoomLevel}%</span>
            <button
              type="button"
              title="Zoom in"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="rounded px-1.5 py-0.5 hover:bg-ink-100 hover:text-ink-900"
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
              className="pointer-events-auto flex items-center gap-2 rounded-xl border border-ink-100 bg-white/95 px-4 py-2.5 text-xs font-semibold text-ink-900 shadow-xl backdrop-blur transition"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{notif.message}</span>
              {onDismissNotification && (
                <button
                  type="button"
                  onClick={() => onDismissNotification(notif.id)}
                  className="ml-2 text-ink-400 hover:text-ink-700"
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
