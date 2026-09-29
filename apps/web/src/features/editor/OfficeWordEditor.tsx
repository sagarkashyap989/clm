import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  useCallback,
} from 'react';
import { useAuthStore } from '@/stores/auth';
import {
  exportContractToDocx,
  parseDocxFile,
  copyFormattedForWord,
} from './WordExportHelper';
import {
  WordMarkupBalloons,
  type TrackedChange,
  type DocumentComment,
} from './WordMarkupBalloons';

type RibbonTab = 'home' | 'insert' | 'review' | 'view';

interface OfficeWordEditorProps {
  initialContent: string;
  contractName: string;
  counterparty?: string;
  contractType?: string;
  status?: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  onContentChange: (content: string) => void;
  onTriggerSaveVersion?: () => void;
  autosaveStatus?: 'saved' | 'saving' | 'unsaved';
  lastSavedAt?: string | null;
  readOnly?: boolean;
}

// Pre-defined Legal Clauses for Insert Tab
const LEGAL_CLAUSE_SNIPPETS: { title: string; label: string; text: string }[] = [
  {
    title: 'Confidentiality & Non-Disclosure',
    label: 'Confidentiality Clause',
    text: `<h3>CONFIDENTIALITY</h3><p>Each party acknowledges that in the course of performance of this Agreement, it may receive confidential or proprietary information of the other party. Neither party shall disclose, reproduce, or distribute the proprietary materials of the disclosing party to any third party for a period of no less than three (3) years from the date of disclosure without express prior written consent.</p>`,
  },
  {
    title: 'Indemnification & Hold Harmless',
    label: 'Indemnification Clause',
    text: `<h3>INDEMNIFICATION</h3><p>Each party ("Indemnifying Party") agrees to defend, indemnify, and hold harmless the other party, its affiliates, directors, and employees against any and all third-party claims, liabilities, losses, damages, and reasonable legal expenses arising out of any material breach of this Agreement, gross negligence, or willful misconduct.</p>`,
  },
  {
    title: 'Limitation of Liability',
    label: 'Limitation of Liability',
    text: `<h3>LIMITATION OF LIABILITY</h3><p>Except for indemnification obligations and breaches of confidentiality, neither party shall be liable for indirect, incidental, punitive, or consequential damages. Aggregate liability under this Agreement shall not exceed the total fees paid or payable in the twelve (12) months preceding the claim.</p>`,
  },
  {
    title: 'Term & Termination',
    label: 'Termination for Cause',
    text: `<h3>TERM AND TERMINATION</h3><p>Either party may terminate this Agreement immediately upon written notice if the other party materially breaches any provision and fails to cure such breach within thirty (30) calendar days of receiving written notice thereof.</p>`,
  },
  {
    title: 'Governing Law & Jurisdiction',
    label: 'Governing Law',
    text: `<h3>GOVERNING LAW AND JURISDICTION</h3><p>This Agreement shall be governed by and construed in accordance with the substantive laws of the State of Delaware, without giving effect to conflict of laws principles. The state and federal courts in New Castle County, Delaware shall have exclusive jurisdiction.</p>`,
  },
  {
    title: 'Severability & Entire Agreement',
    label: 'Severability',
    text: `<h3>SEVERABILITY</h3><p>If any provision of this Agreement is held to be invalid or unenforceable, such provision shall be severed and the remaining provisions shall continue in full force and effect. This Agreement constitutes the entire understanding between the parties.</p>`,
  },
];

const AUTHOR_COLORS = [
  '#1D4ED8', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#7C3AED', // Purple
  '#0891B2', // Cyan
];

function getAuthorColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

export function OfficeWordEditor({
  initialContent,
  contractName,
  counterparty,
  contractType,
  status,
  effectiveDate,
  expirationDate,
  onContentChange,
  onTriggerSaveVersion,
  autosaveStatus = 'saved',
  lastSavedAt,
  readOnly = false,
}: OfficeWordEditorProps) {
  const user = useAuthStore((s) => s.user);
  const currentUserName = user?.name || 'Reviewer';
  const currentUserEmail = user?.email || 'reviewer@company.com';
  const currentUserColor = getAuthorColor(currentUserName);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Ribbon Tab
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('home');

  // Document Styling & States
  const [fontFamily, setFontFamily] = useState<string>('Calibri');
  const [fontSize, setFontSize] = useState<string>('11');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [showNavPane, setShowNavPane] = useState<boolean>(false);
  const [showMarkupBalloons, setShowMarkupBalloons] = useState<boolean>(true);
  const [darkCanvas, setDarkCanvas] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Track Changes & Review
  const [trackChanges, setTrackChanges] = useState<boolean>(false);
  const [markupView, setMarkupView] = useState<'all' | 'simple' | 'none' | 'original'>('all');
  const [changes, setChanges] = useState<TrackedChange[]>([]);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Selection floating action bar
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState<boolean>(false);
  const [newCommentDraft, setNewCommentDraft] = useState<string>('');

  // Find & Replace
  const [isFindOpen, setIsFindOpen] = useState<boolean>(false);
  const [findTerm, setFindTerm] = useState<string>('');
  const [replaceTerm, setReplaceTerm] = useState<string>('');
  const [findMatchCount, setFindMatchCount] = useState<number | null>(null);

  // Metrics
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  // Seed sample initial changes and comments for realistic demonstration if none exist
  useEffect(() => {
    if (changes.length === 0) {
      setChanges([
        {
          id: 'chg-seed-1',
          type: 'insertion',
          authorName: 'Sarah Jenkins',
          authorEmail: 'sarah.j@acme.com',
          authorColor: '#059669',
          timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
          textSnippet: 'and regulatory compliance covenants under Delaware General Corporation Law',
          details: 'Inserted warranty clause',
          status: 'pending',
        },
        {
          id: 'chg-seed-2',
          type: 'deletion',
          authorName: 'Marcus Vance',
          authorEmail: 'marcus.v@partner.com',
          authorColor: '#D97706',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          textSnippet: 'unilateral indemnification cap of $10,000',
          details: 'Deleted liability clause',
          status: 'pending',
        },
        {
          id: 'chg-seed-3',
          type: 'formatting',
          authorName: currentUserName,
          authorEmail: currentUserEmail,
          authorColor: currentUserColor,
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          textSnippet: '3. CONFIDENTIALITY AND GOVERNING LAW',
          details: 'Formatted: Bold, Aptos 14pt, Word Blue',
          status: 'pending',
        },
      ]);
    }

    if (comments.length === 0) {
      setComments([
        {
          id: 'cmt-seed-1',
          authorName: 'Alex Rivera',
          authorEmail: 'alex.r@acme.com',
          authorColor: '#7C3AED',
          timestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
          quoteText: 'duration of no less than three (3) years',
          content: 'Counterparty counsel requested extending this to 5 years for proprietary software patents.',
          isResolved: false,
          replies: [
            {
              id: 'rep-1',
              authorName: currentUserName,
              authorEmail: currentUserEmail,
              authorColor: currentUserColor,
              timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
              content: 'Standard corporate policy allows up to 5 years if limited strictly to trade secrets. Proposing a mutual compromise.',
            },
          ],
        },
      ]);
    }
  }, []);

  // Initialize editor content once
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
      editorRef.current.innerHTML = initialContent || '<p>Start drafting contract clauses...</p>';
      refreshMetrics();
    }
  }, [initialContent]);

  const refreshMetrics = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(text.length);

    // Extract headings for navigation pane
    const headingEls = editorRef.current.querySelectorAll('h1, h2, h3, h4');
    const parsedHeadings: { id: string; text: string; level: number }[] = [];
    headingEls.forEach((el, index) => {
      const headingText = el.textContent || `Section ${index + 1}`;
      const level = parseInt(el.tagName.replace('H', ''), 10);
      const id = `heading-${index}`;
      el.setAttribute('data-heading-id', id);
      parsedHeadings.push({ id, text: headingText, level });
    });
    setHeadings(parsedHeadings);
  }, []);

  function handleEditorInput() {
    if (!editorRef.current) return;
    refreshMetrics();
    onContentChange(editorRef.current.innerHTML);
  }

  // Handle Text Selection for Floating Comment & Review Affordance
  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelectedText('');
      setFloatingPos(null);
      setSelectionRange(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setSelectedText('');
      setFloatingPos(null);
      setSelectionRange(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setSelectionRange(range.cloneRange());
    setFloatingPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }

  // Apply Document Commands with optional Track Changes formatting logging
  function executeDocCommand(command: string, value: string = '') {
    if (readOnly) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }

    const sel = window.getSelection();
    const selectedSnippet = sel?.toString().trim();

    document.execCommand(command, false, value);
    handleEditorInput();

    // If Track Changes is ON and a text range was formatted, record formatting change
    if (trackChanges && selectedSnippet) {
      const newChange: TrackedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'formatting',
        authorName: currentUserName,
        authorEmail: currentUserEmail,
        authorColor: currentUserColor,
        timestamp: new Date().toISOString(),
        textSnippet: selectedSnippet,
        details: `Formatted: ${command.toUpperCase()}${value ? ` (${value})` : ''}`,
        status: 'pending',
      };
      setChanges((prev) => [newChange, ...prev]);
      setActiveChangeId(newChange.id);
      showToast(`Tracked: Formatted ${command}`);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Ctrl+S / Cmd+S: Save Version
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onTriggerSaveVersion?.();
      showToast('Version snapshot modal opened');
      return;
    }
    // Ctrl+F / Cmd+F: Toggle Find
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setIsFindOpen((prev) => !prev);
      return;
    }
    // Ctrl+B: Bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      executeDocCommand('bold');
      return;
    }
    // Ctrl+I: Italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      executeDocCommand('italic');
      return;
    }
    // Ctrl+U: Underline
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      executeDocCommand('underline');
      return;
    }

    // Intercept deletion if Track Changes is ON
    if (trackChanges && !readOnly && (e.key === 'Backspace' || e.key === 'Delete')) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        e.preventDefault();
        markSelectedDeletion(sel.toString().trim());
        return;
      }
    }
  }

  // Mark Selected Text as Deleted (Word Strikethrough Markup)
  function markSelectedDeletion(snippet: string) {
    if (readOnly || !editorRef.current) return;
    const changeId = `chg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const delHtml = `<span class="word-deleted rounded px-0.5" data-change-id="${changeId}" style="text-decoration: line-through; color: #DC2626; background-color: rgba(220, 38, 38, 0.1); border-left: 2px solid #DC2626;" title="Deleted by ${currentUserName}">${snippet}</span>`;

    document.execCommand('insertHTML', false, delHtml);
    handleEditorInput();

    const newChange: TrackedChange = {
      id: changeId,
      type: 'deletion',
      authorName: currentUserName,
      authorEmail: currentUserEmail,
      authorColor: currentUserColor,
      timestamp: new Date().toISOString(),
      textSnippet: snippet,
      details: 'Marked text for deletion',
      status: 'pending',
    };

    setChanges((prev) => [newChange, ...prev]);
    setActiveChangeId(changeId);
    setSelectedText('');
    setFloatingPos(null);
    showToast(`Marked deletion by ${currentUserName}`);
  }

  // Mark Text as Inserted (Word Insertion Markup)
  function handleInsertTrackedText(textToInsert: string) {
    if (readOnly || !editorRef.current) return;
    const changeId = `chg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const insHtml = `<span class="word-inserted rounded px-0.5" data-change-id="${changeId}" style="text-decoration: underline; color: ${currentUserColor}; background-color: rgba(29, 78, 216, 0.08); border-bottom: 2px solid ${currentUserColor};" title="Inserted by ${currentUserName}">${textToInsert}</span>`;

    document.execCommand('insertHTML', false, insHtml);
    handleEditorInput();

    const newChange: TrackedChange = {
      id: changeId,
      type: 'insertion',
      authorName: currentUserName,
      authorEmail: currentUserEmail,
      authorColor: currentUserColor,
      timestamp: new Date().toISOString(),
      textSnippet: textToInsert,
      details: 'Inserted new contract text',
      status: 'pending',
    };

    setChanges((prev) => [newChange, ...prev]);
    setActiveChangeId(changeId);
    showToast(`Tracked insertion by ${currentUserName}`);
  }

  // Add Comment on selected text
  function handleCreateComment() {
    if (!selectedText) {
      showToast('Please select contract text first to attach a comment.');
      return;
    }
    setIsCommentModalOpen(true);
  }

  function handleConfirmCreateComment() {
    if (!newCommentDraft.trim() || !selectedText) return;

    const commentId = `cmt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    // Wrap the selected range in document canvas with comment highlight
    if (selectionRange) {
      try {
        const mark = document.createElement('mark');
        mark.setAttribute('data-comment-id', commentId);
        mark.className = 'word-comment-highlight rounded px-0.5 bg-amber-100 border-b-2 border-amber-400 text-amber-950 cursor-pointer';
        mark.title = `Comment by ${currentUserName}: "${newCommentDraft}"`;
        mark.textContent = selectedText;

        selectionRange.deleteContents();
        selectionRange.insertNode(mark);
        handleEditorInput();
      } catch (err) {
        console.warn('DOM range wrap fallback:', err);
      }
    }

    const newComment: DocumentComment = {
      id: commentId,
      authorName: currentUserName,
      authorEmail: currentUserEmail,
      authorColor: currentUserColor,
      timestamp: new Date().toISOString(),
      quoteText: selectedText,
      content: newCommentDraft.trim(),
      isResolved: false,
      replies: [],
    };

    setComments((prev) => [newComment, ...prev]);
    setActiveCommentId(commentId);
    setShowMarkupBalloons(true);
    setIsCommentModalOpen(false);
    setNewCommentDraft('');
    setSelectedText('');
    setFloatingPos(null);
    showToast('Threaded comment posted in margin');
  }

  // Reply to Comment
  function handleReplyComment(commentId: string, replyText: string) {
    const newReply = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      authorName: currentUserName,
      authorEmail: currentUserEmail,
      authorColor: currentUserColor,
      timestamp: new Date().toISOString(),
      content: replyText,
    };

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...c.replies, newReply] }
          : c
      )
    );
    showToast('Reply added to thread');
  }

  // Toggle Resolve Comment
  function handleToggleResolveComment(commentId: string) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
      )
    );
    showToast('Comment thread status updated');
  }

  // Delete Comment
  function handleDeleteComment(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    // Remove highlight in DOM
    if (editorRef.current) {
      const el = editorRef.current.querySelector(`[data-comment-id="${commentId}"]`);
      if (el) {
        const text = el.textContent || '';
        el.replaceWith(document.createTextNode(text));
        handleEditorInput();
      }
    }
    showToast('Comment deleted');
  }

  // Accept Individual Change
  function handleAcceptChange(changeId: string) {
    if (editorRef.current) {
      const el = editorRef.current.querySelector(`[data-change-id="${changeId}"]`);
      if (el) {
        if (el.classList.contains('word-deleted')) {
          el.remove();
        } else {
          const text = el.textContent || '';
          el.replaceWith(document.createTextNode(text));
        }
        handleEditorInput();
      }
    }

    setChanges((prev) =>
      prev.map((c) => (c.id === changeId ? { ...c, status: 'accepted' } : c))
    );
    showToast('Change accepted');
  }

  // Reject Individual Change
  function handleRejectChange(changeId: string) {
    if (editorRef.current) {
      const el = editorRef.current.querySelector(`[data-change-id="${changeId}"]`);
      if (el) {
        if (el.classList.contains('word-inserted')) {
          el.remove();
        } else {
          const text = el.textContent || '';
          el.replaceWith(document.createTextNode(text));
        }
        handleEditorInput();
      }
    }

    setChanges((prev) =>
      prev.map((c) => (c.id === changeId ? { ...c, status: 'rejected' } : c))
    );
    showToast('Change rejected');
  }

  // Accept All Changes
  function handleAcceptAllChanges() {
    if (!editorRef.current) return;
    const ins = editorRef.current.querySelectorAll('.word-inserted');
    ins.forEach((el) => {
      const text = el.textContent || '';
      el.replaceWith(document.createTextNode(text));
    });
    const dels = editorRef.current.querySelectorAll('.word-deleted');
    dels.forEach((el) => el.remove());

    setChanges((prev) => prev.map((c) => ({ ...c, status: 'accepted' })));
    handleEditorInput();
    showToast('Accepted all tracked changes');
  }

  // Reject All Changes
  function handleRejectAllChanges() {
    if (!editorRef.current) return;
    const ins = editorRef.current.querySelectorAll('.word-inserted');
    ins.forEach((el) => el.remove());
    const dels = editorRef.current.querySelectorAll('.word-deleted');
    dels.forEach((el) => {
      const text = el.textContent || '';
      el.replaceWith(document.createTextNode(text));
    });

    setChanges((prev) => prev.map((c) => ({ ...c, status: 'rejected' })));
    handleEditorInput();
    showToast('Rejected all tracked changes');
  }

  // Jump to Next / Prev Change
  function handleJumpNextChange() {
    const pending = changes.filter((c) => c.status === 'pending');
    if (pending.length === 0) return;
    const currentIndex = pending.findIndex((c) => c.id === activeChangeId);
    const nextIndex = (currentIndex + 1) % pending.length;
    const target = pending[nextIndex];
    setActiveChangeId(target.id);
    scrollToElement(`[data-change-id="${target.id}"]`);
  }

  function handleJumpPrevChange() {
    const pending = changes.filter((c) => c.status === 'pending');
    if (pending.length === 0) return;
    const currentIndex = pending.findIndex((c) => c.id === activeChangeId);
    const prevIndex = currentIndex <= 0 ? pending.length - 1 : currentIndex - 1;
    const target = pending[prevIndex];
    setActiveChangeId(target.id);
    scrollToElement(`[data-change-id="${target.id}"]`);
  }

  // Jump to Next / Prev Comment
  function handleJumpNextComment() {
    const active = comments.filter((c) => !c.isResolved);
    if (active.length === 0) return;
    const currentIndex = active.findIndex((c) => c.id === activeCommentId);
    const nextIndex = (currentIndex + 1) % active.length;
    const target = active[nextIndex];
    setActiveCommentId(target.id);
    scrollToElement(`[data-comment-id="${target.id}"]`);
  }

  function handleJumpPrevComment() {
    const active = comments.filter((c) => !c.isResolved);
    if (active.length === 0) return;
    const currentIndex = active.findIndex((c) => c.id === activeCommentId);
    const prevIndex = currentIndex <= 0 ? active.length - 1 : currentIndex - 1;
    const target = active[prevIndex];
    setActiveCommentId(target.id);
    scrollToElement(`[data-comment-id="${target.id}"]`);
  }

  function scrollToElement(selector: string) {
    if (!editorRef.current) return;
    const el = editorRef.current.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#185ABD]', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#185ABD]', 'ring-offset-2');
      }, 1500);
    }
  }

  // Insert Legal Snippet
  function handleInsertClause(snippet: { title: string; text: string }) {
    if (readOnly || !editorRef.current) return;
    if (trackChanges) {
      handleInsertTrackedText(snippet.text);
    } else {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, snippet.text);
      handleEditorInput();
    }
    showToast(`Inserted: ${snippet.title}`);
  }

  // Insert Table
  function handleInsertTable(rows: number, cols: number) {
    if (readOnly || !editorRef.current) return;
    editorRef.current.focus();
    let tableHtml = '<table class="w-full my-4 border-collapse border border-slate-300 text-xs">';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          tableHtml += `<th class="border border-slate-300 bg-slate-100 p-2 font-bold text-left">Header ${c + 1}</th>`;
        } else {
          tableHtml += `<td class="border border-slate-300 p-2">Row ${r} Col ${c + 1}</td>`;
        }
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table><p></p>';
    document.execCommand('insertHTML', false, tableHtml);
    handleEditorInput();
    showToast(`Inserted ${rows}×${cols} Table`);
  }

  // Insert Legal Symbol
  function handleInsertSymbol(symbol: string) {
    if (readOnly || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, symbol);
    handleEditorInput();
  }

  // Insert Signature Block
  function handleInsertSignatureBlock() {
    if (readOnly || !editorRef.current) return;
    const sigHtml = `
      <div class="my-6 border-t border-slate-300 pt-4">
        <h4 class="font-bold text-sm mb-4">IN WITNESS WHEREOF:</h4>
        <div class="grid grid-cols-2 gap-8 text-xs">
          <div>
            <p class="font-bold">For: Acme Contracts Corp</p>
            <div class="mt-8 border-b border-slate-400 w-48"></div>
            <p class="mt-1 text-slate-500">Authorized Signature</p>
            <p class="mt-1 text-slate-500">Date: ${new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p class="font-bold">For: ${counterparty || 'Counterparty Corp'}</p>
            <div class="mt-8 border-b border-slate-400 w-48"></div>
            <p class="mt-1 text-slate-500">Authorized Signature</p>
            <p class="mt-1 text-slate-500">Date: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div><p></p>
    `;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, sigHtml);
    handleEditorInput();
    showToast('Signature block inserted');
  }

  // Find & Replace
  function handleFind() {
    if (!findTerm || !editorRef.current) {
      setFindMatchCount(0);
      return;
    }
    const text = editorRef.current.innerText.toLowerCase();
    const count = text.split(findTerm.toLowerCase()).length - 1;
    setFindMatchCount(count);
  }

  function handleReplace() {
    if (!findTerm || !editorRef.current || readOnly) return;
    const html = editorRef.current.innerHTML;
    const regex = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (regex.test(html)) {
      editorRef.current.innerHTML = html.replace(regex, replaceTerm);
      handleEditorInput();
      handleFind();
    }
  }

  function handleReplaceAll() {
    if (!findTerm || !editorRef.current || readOnly) return;
    const html = editorRef.current.innerHTML;
    const regex = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    editorRef.current.innerHTML = html.replace(regex, replaceTerm);
    handleEditorInput();
    handleFind();
  }

  // Export to .docx
  async function handleExportDocx() {
    if (!editorRef.current) return;
    try {
      showToast('Generating Word document (.docx)...');
      await exportContractToDocx({
        contractName,
        counterparty,
        contractType,
        status,
        contentHtml: editorRef.current.innerHTML,
        effectiveDate,
        expirationDate,
      });
      showToast('Word document downloaded successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to export Word document');
    }
  }

  // Copy Formatted for Word
  async function handleCopyWord() {
    if (!editorRef.current) return;
    const success = await copyFormattedForWord(editorRef.current.innerHTML);
    if (success) {
      showToast('Copied with Word styling! You can paste into Word.');
    } else {
      showToast('Copy to clipboard completed');
    }
  }

  // Import .docx file
  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast(`Importing ${file.name}...`);
      const extractedHtml = await parseDocxFile(file);
      if (editorRef.current) {
        editorRef.current.innerHTML = extractedHtml;
        handleEditorInput();
        showToast(`Imported ${file.name} successfully`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not parse Word document. Please ensure valid .docx format.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-300 bg-[#F3F4F6] shadow-xl overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-slate-900/90 p-4' : ''
      }`}
    >
      {/* Hidden File Input for .docx Ingestion */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Floating Action Toast */}
      {toastMessage && (
        <div className="absolute top-16 right-6 z-50 rounded-lg bg-[#185ABD] px-4 py-2 text-xs font-semibold text-white shadow-lg animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. OFFICE 365 TOP HEADER (Word Blue Bar) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#185ABD] px-4 py-2 text-white shadow-sm">
        {/* Left: Word Emblem & Document Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#103F91] text-xs font-black shadow-inner">
            W
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight truncate max-w-[240px] sm:max-w-md">
              {contractName}
            </span>
            <span className="hidden sm:inline-block text-[11px] opacity-75 font-normal">
              — Word for Web
            </span>
          </div>

          {/* Cloud Autosave Indicator */}
          <div className="hidden md:flex items-center gap-1.5 rounded-full bg-[#103F91]/80 px-2.5 py-0.5 text-[11px]">
            {autosaveStatus === 'saving' && (
              <>
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-300" />
                <span className="text-amber-200 font-medium">Saving to CLM Cloud...</span>
              </>
            )}
            {autosaveStatus === 'saved' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-100 font-medium">Saved to CLM Cloud</span>
                {lastSavedAt && (
                  <span className="opacity-60">
                    ({new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
              </>
            )}
            {autosaveStatus === 'unsaved' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span className="text-slate-200">Unsaved edits (Ctrl+S to snapshot)</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Author Badge & Quick Action Buttons */}
        <div className="flex items-center gap-2 text-xs">
          {/* Active Reviewer Identity Tag */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#103F91] px-2.5 py-1 text-[11px]">
            <span
              className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
              style={{ backgroundColor: currentUserColor }}
            >
              {currentUserName[0]}
            </span>
            <span className="font-semibold text-white truncate max-w-[120px]">{currentUserName}</span>
            <span className="text-slate-300 text-[10px]">(Reviewer)</span>
          </div>

          <button
            type="button"
            title="Import existing .docx file"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded bg-[#103F91] hover:bg-[#0C2F6E] px-2.5 py-1 font-medium transition"
          >
            <span>📂</span>
            <span className="hidden sm:inline">Import .docx</span>
          </button>

          <button
            type="button"
            title="Download contract as Microsoft Word (.docx)"
            onClick={handleExportDocx}
            className="flex items-center gap-1 rounded bg-white text-[#185ABD] hover:bg-slate-100 px-3 py-1 font-bold shadow-sm transition"
          >
            <span>💾</span>
            <span>Export .docx</span>
          </button>

          <button
            type="button"
            title="Copy with Word styling for pasting into native Word"
            onClick={handleCopyWord}
            className="hidden sm:flex items-center gap-1 rounded bg-[#103F91] hover:bg-[#0C2F6E] px-2.5 py-1 font-medium transition"
          >
            <span>📋</span>
            <span>Copy for Word</span>
          </button>

          {onTriggerSaveVersion && (
            <button
              type="button"
              title="Save a new version snapshot in CLM"
              onClick={onTriggerSaveVersion}
              className="rounded bg-[#103F91] hover:bg-[#0C2F6E] px-2.5 py-1 font-semibold transition"
            >
              Revision History
            </button>
          )}

          <button
            type="button"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Word View'}
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="rounded bg-[#103F91] hover:bg-[#0C2F6E] p-1.5 font-bold transition"
          >
            {isFullscreen ? '⤢' : '⤡'}
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. MICROSOFT WORD RIBBON TABS & TOOLBAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-300 bg-[#F3F4F6]">
        {/* Ribbon Tab Bar */}
        <nav className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 pt-1 text-xs">
          {(['home', 'insert', 'review', 'view'] as RibbonTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveRibbonTab(tab)}
              className={`relative px-4 py-2 font-semibold capitalize transition ${
                activeRibbonTab === tab
                  ? 'text-[#185ABD] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#185ABD]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'home' && 'Home'}
              {tab === 'insert' && 'Insert'}
              {tab === 'review' && (
                <span className="flex items-center gap-1.5">
                  <span>Review</span>
                  {changes.filter((c) => c.status === 'pending').length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </span>
              )}
              {tab === 'view' && 'View'}
            </button>
          ))}
        </nav>

        {/* Ribbon Command Container */}
        <div className="min-h-[64px] flex flex-wrap items-center gap-2 p-2 bg-[#F9FAFB] text-slate-800 text-xs">
          {/* ──────── TAB 1: HOME ──────── */}
          {activeRibbonTab === 'home' && (
            <div className="flex flex-wrap items-center gap-2 w-full">
              {/* Undo / Redo */}
              <div className="flex items-center border-r border-slate-300 pr-2">
                <button
                  type="button"
                  title="Undo (Ctrl+Z)"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('undo')}
                  className="rounded p-1.5 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
                >
                  ↺
                </button>
                <button
                  type="button"
                  title="Redo (Ctrl+Y)"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('redo')}
                  className="rounded p-1.5 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
                >
                  ↻
                </button>
              </div>

              {/* Font Family & Size */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <select
                  aria-label="Font Family"
                  value={fontFamily}
                  disabled={readOnly}
                  onChange={(e) => {
                    setFontFamily(e.target.value);
                    executeDocCommand('fontName', e.target.value);
                  }}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-[#185ABD] focus:outline-none"
                >
                  <option value="Calibri">Calibri</option>
                  <option value="Aptos">Aptos</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                </select>

                <select
                  aria-label="Font Size"
                  value={fontSize}
                  disabled={readOnly}
                  onChange={(e) => {
                    setFontSize(e.target.value);
                    executeDocCommand('fontSize', '3');
                  }}
                  className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-medium text-slate-800 focus:border-[#185ABD] focus:outline-none"
                >
                  {['9', '10', '11', '12', '14', '16', '18', '24', '32'].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} pt
                    </option>
                  ))}
                </select>
              </div>

              {/* Bold, Italic, Underline, Strikethrough */}
              <div className="flex items-center gap-0.5 border-r border-slate-300 pr-2">
                <button
                  type="button"
                  title="Bold (Ctrl+B)"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('bold')}
                  className="rounded p-1.5 font-bold hover:bg-slate-200 text-slate-800 disabled:opacity-40"
                >
                  B
                </button>
                <button
                  type="button"
                  title="Italic (Ctrl+I)"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('italic')}
                  className="rounded p-1.5 italic hover:bg-slate-200 text-slate-800 disabled:opacity-40"
                >
                  I
                </button>
                <button
                  type="button"
                  title="Underline (Ctrl+U)"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('underline')}
                  className="rounded p-1.5 underline hover:bg-slate-200 text-slate-800 disabled:opacity-40"
                >
                  U
                </button>
                <button
                  type="button"
                  title="Strikethrough"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('strikeThrough')}
                  className="rounded p-1.5 line-through hover:bg-slate-200 text-slate-800 disabled:opacity-40"
                >
                  ab
                </button>
              </div>

              {/* Text Highlight & Color */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
                <button
                  type="button"
                  title="Highlight Yellow"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('hiliteColor', '#FEF08A')}
                  className="flex items-center gap-0.5 rounded px-1.5 py-1 hover:bg-slate-200 text-slate-800"
                >
                  <span className="rounded bg-yellow-300 px-1 text-[10px] font-bold text-slate-900">ab</span>
                </button>
                <button
                  type="button"
                  title="Word Blue Color"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('foreColor', '#185ABD')}
                  className="flex items-center gap-0.5 rounded px-1.5 py-1 hover:bg-slate-200 text-slate-800"
                >
                  <span className="font-bold text-[#185ABD]">A</span>
                </button>
                <button
                  type="button"
                  title="Reset Font Color"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('foreColor', '#1F2937')}
                  className="flex items-center gap-0.5 rounded px-1.5 py-1 hover:bg-slate-200 text-slate-800"
                >
                  <span className="font-bold text-slate-900">A</span>
                </button>
              </div>

              {/* Lists & Alignment */}
              <div className="flex items-center gap-0.5 border-r border-slate-300 pr-2">
                <button
                  type="button"
                  title="Bulleted List"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('insertUnorderedList')}
                  className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
                >
                  •≡
                </button>
                <button
                  type="button"
                  title="Numbered List"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('insertOrderedList')}
                  className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
                >
                  1≡
                </button>
                <button
                  type="button"
                  title="Align Left"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('justifyLeft')}
                  className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
                >
                  ⇤
                </button>
                <button
                  type="button"
                  title="Align Center"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('justifyCenter')}
                  className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
                >
                  ⇥⇤
                </button>
                <button
                  type="button"
                  title="Align Right"
                  disabled={readOnly}
                  onClick={() => executeDocCommand('justifyRight')}
                  className="rounded p-1.5 hover:bg-slate-200 text-slate-700"
                >
                  ⇥
                </button>
              </div>

              {/* Styles Gallery */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 border-r border-slate-300 pr-2">
                <button
                  type="button"
                  onClick={() => executeDocCommand('formatBlock', '<p>')}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-normal hover:border-[#185ABD]"
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => executeDocCommand('formatBlock', '<h2>')}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-[#185ABD] hover:border-[#185ABD]"
                >
                  Heading 1
                </button>
                <button
                  type="button"
                  onClick={() => executeDocCommand('formatBlock', '<h3>')}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#103F91] hover:border-[#185ABD]"
                >
                  Heading 2
                </button>
                <button
                  type="button"
                  onClick={() => executeDocCommand('formatBlock', '<blockquote>')}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] italic text-slate-600 hover:border-[#185ABD]"
                >
                  Legal Block
                </button>
              </div>

              {/* Find & Replace button */}
              <div className="ml-auto flex items-center">
                <button
                  type="button"
                  onClick={() => setIsFindOpen((prev) => !prev)}
                  className={`rounded px-2.5 py-1 font-semibold transition ${
                    isFindOpen ? 'bg-[#185ABD] text-white' : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Find & Replace
                </button>
              </div>
            </div>
          )}

          {/* ──────── TAB 2: INSERT ──────── */}
          {activeRibbonTab === 'insert' && (
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Insert Table Dropdown */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-3">
                <span className="font-semibold text-slate-600">Table:</span>
                <button
                  type="button"
                  onClick={() => handleInsertTable(2, 2)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:border-[#185ABD] hover:text-[#185ABD]"
                >
                  2 × 2
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTable(3, 3)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:border-[#185ABD] hover:text-[#185ABD]"
                >
                  3 × 3
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTable(4, 2)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:border-[#185ABD] hover:text-[#185ABD]"
                >
                  4 × 2 (Metadata)
                </button>
              </div>

              {/* Insert Standard Legal Clauses */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-3">
                <span className="font-semibold text-slate-600">Legal Clauses:</span>
                <select
                  aria-label="Insert Legal Clause"
                  onChange={(e) => {
                    const snippet = LEGAL_CLAUSE_SNIPPETS.find((s) => s.title === e.target.value);
                    if (snippet) handleInsertClause(snippet);
                    e.target.value = '';
                  }}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-[#185ABD] focus:outline-none"
                >
                  <option value="">+ Insert Clause...</option>
                  {LEGAL_CLAUSE_SNIPPETS.map((s) => (
                    <option key={s.title} value={s.title}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Insert Symbols */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-3">
                <span className="font-semibold text-slate-600">Legal Symbols:</span>
                {['§', '¶', '©', '®', '™'].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    title={`Insert ${sym}`}
                    onClick={() => handleInsertSymbol(sym)}
                    className="h-7 w-7 rounded border border-slate-300 bg-white font-serif font-bold hover:bg-slate-100 hover:text-[#185ABD]"
                  >
                    {sym}
                  </button>
                ))}
              </div>

              {/* Page Break & Signature Block */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertSignatureBlock}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800 hover:border-[#185ABD] hover:text-[#185ABD]"
                >
                  ✍ Insert Signature Block
                </button>
                <button
                  type="button"
                  onClick={() => executeDocCommand('insertHorizontalRule')}
                  className="rounded border border-slate-300 bg-white px-2 py-1 font-medium hover:bg-slate-100"
                >
                  ― Page Break Divider
                </button>
              </div>
            </div>
          )}

          {/* ──────── TAB 3: REVIEW (Track Changes, Comments, Markup) ──────── */}
          {activeRibbonTab === 'review' && (
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Track Changes Toggle */}
              <div className="flex items-center gap-2 border-r border-slate-300 pr-3">
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !trackChanges;
                    setTrackChanges(nextState);
                    showToast(nextState ? 'Track Changes activated (records insertions, deletions & formatting)' : 'Track Changes turned off');
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition shadow-xs ${
                    trackChanges
                      ? 'bg-rose-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${trackChanges ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                  <span>Track Changes: {trackChanges ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* New Comment Button */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-3">
                <button
                  type="button"
                  onClick={handleCreateComment}
                  className="flex items-center gap-1 rounded bg-[#185ABD] hover:bg-[#103F91] text-white px-2.5 py-1 font-semibold shadow-xs transition"
                >
                  <span>💬</span>
                  <span>New Comment</span>
                </button>
              </div>

              {/* Change Navigation (Prev / Next) */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-3">
                <span className="font-semibold text-slate-600">Changes:</span>
                <button
                  type="button"
                  title="Previous Change"
                  onClick={handleJumpPrevChange}
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100 font-semibold"
                >
                  ⇦ Prev
                </button>
                <button
                  type="button"
                  title="Next Change"
                  onClick={handleJumpNextChange}
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100 font-semibold"
                >
                  Next ⇨
                </button>
              </div>

              {/* Comment Navigation (Prev / Next) */}
              <div className="flex items-center gap-1 border-r border-slate-300 pr-3">
                <span className="font-semibold text-slate-600">Comments:</span>
                <button
                  type="button"
                  title="Previous Comment"
                  onClick={handleJumpPrevComment}
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100 font-semibold"
                >
                  ⇦ Prev
                </button>
                <button
                  type="button"
                  title="Next Comment"
                  onClick={handleJumpNextComment}
                  className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100 font-semibold"
                >
                  Next ⇨
                </button>
              </div>

              {/* Display for Review */}
              <div className="flex items-center gap-1.5 border-r border-slate-300 pr-3">
                <span className="font-semibold text-slate-600">Markup:</span>
                <select
                  aria-label="Display for Review"
                  value={markupView}
                  onChange={(e) => setMarkupView(e.target.value as any)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-[#185ABD]"
                >
                  <option value="all">All Markup (Balloons & Redlines)</option>
                  <option value="simple">Simple Markup</option>
                  <option value="none">No Markup (Final Draft)</option>
                  <option value="original">Original</option>
                </select>
              </div>

              {/* Accept / Reject All */}
              <div className="flex items-center gap-1.5 border-r border-slate-300 pr-3">
                <button
                  type="button"
                  onClick={handleAcceptAllChanges}
                  className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 font-semibold"
                >
                  ✓ Accept All
                </button>
                <button
                  type="button"
                  onClick={handleRejectAllChanges}
                  className="rounded border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 px-2.5 py-1 font-semibold"
                >
                  ✕ Reject All
                </button>
              </div>

              {/* Toggle Markup Balloons Panel */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowMarkupBalloons((prev) => !prev)}
                  className={`rounded px-2.5 py-1 font-semibold transition ${
                    showMarkupBalloons
                      ? 'bg-[#185ABD] text-white shadow-xs'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {showMarkupBalloons ? 'Hide Balloons' : 'Show Balloons'}
                </button>
              </div>
            </div>
          )}

          {/* ──────── TAB 4: VIEW ──────── */}
          {activeRibbonTab === 'view' && (
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 border-r border-slate-300 pr-3">
                <span className="font-semibold text-slate-600">Zoom:</span>
                {[75, 100, 125, 150].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`rounded px-2 py-1 font-medium transition ${
                      zoomLevel === z
                        ? 'bg-[#185ABD] text-white font-bold'
                        : 'border border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>

              {/* Show / Hide Options */}
              <div className="flex items-center gap-3 border-r border-slate-300 pr-3">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showRuler}
                    onChange={(e) => setShowRuler(e.target.checked)}
                    className="rounded border-slate-300 text-[#185ABD] focus:ring-[#185ABD]"
                  />
                  <span>Ruler</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showNavPane}
                    onChange={(e) => setShowNavPane(e.target.checked)}
                    className="rounded border-slate-300 text-[#185ABD] focus:ring-[#185ABD]"
                  />
                  <span>Navigation Pane</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showMarkupBalloons}
                    onChange={(e) => setShowMarkupBalloons(e.target.checked)}
                    className="rounded border-slate-300 text-[#185ABD] focus:ring-[#185ABD]"
                  />
                  <span>Markup Balloons</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={darkCanvas}
                    onChange={(e) => setDarkCanvas(e.target.checked)}
                    className="rounded border-slate-300 text-[#185ABD] focus:ring-[#185ABD]"
                  />
                  <span>Dark Canvas Mode</span>
                </label>
              </div>

              {/* Fullscreen view toggle */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:border-[#185ABD]"
                >
                  {isFullscreen ? 'Exit Full Screen' : 'Distraction-Free Mode'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. FIND & REPLACE FLOATING TOOLBAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isFindOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-slate-900">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700">Find:</span>
            <input
              type="text"
              placeholder="Search in Word document..."
              value={findTerm}
              onChange={(e) => {
                setFindTerm(e.target.value);
                if (!e.target.value) setFindMatchCount(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleFind()}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-[#185ABD] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleFind}
              className="rounded bg-[#185ABD] px-2.5 py-1 font-bold text-white hover:bg-[#103F91]"
            >
              Find
            </button>
            {findMatchCount !== null && (
              <span className="text-[11px] font-semibold text-slate-600">
                {findMatchCount} match{findMatchCount === 1 ? '' : 'es'}
              </span>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5 border-l border-amber-300 pl-3">
              <span className="font-bold text-slate-700">Replace:</span>
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-[#185ABD] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleReplace}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-medium hover:bg-slate-100"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-medium hover:bg-slate-100"
              >
                Replace All
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFindOpen(false)}
            className="ml-auto rounded p-1 text-slate-500 hover:bg-amber-100 hover:text-slate-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. OFFICE RULER BAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRuler && (
        <div className="flex items-center border-b border-slate-300 bg-[#E5E7EB] px-8 py-0.5 text-[9px] font-mono text-slate-500 select-none">
          <div className="w-12 text-center text-slate-400">MARGIN</div>
          <div className="flex flex-1 justify-between px-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((inch) => (
              <div key={inch} className="flex flex-col items-center">
                <span>{inch}"</span>
                <span className="h-1.5 w-px bg-slate-400" />
              </div>
            ))}
          </div>
          <div className="w-12 text-center text-slate-400">MARGIN</div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. WORKSPACE CONTAINER (Navigation + 8.5x11 Sheet + Balloons Rail) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 min-h-[640px] overflow-hidden">
        {/* Optional Word Navigation Pane */}
        {showNavPane && (
          <aside className="w-60 border-r border-slate-300 bg-white p-4 overflow-y-auto text-xs shrink-0 select-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-bold text-slate-800">
              <span>Navigation</span>
              <button
                type="button"
                onClick={() => setShowNavPane(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Headings ({headings.length})
              </p>
              {headings.length === 0 ? (
                <p className="mt-2 text-slate-400 italic">No headings found in document.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {headings.map((h) => (
                    <li
                      key={h.id}
                      className={`truncate py-1 px-1.5 rounded cursor-pointer hover:bg-slate-100 text-slate-700 ${
                        h.level === 1 ? 'font-bold' : h.level === 2 ? 'pl-3 font-semibold' : 'pl-5'
                      }`}
                      onClick={() => {
                        const target = editorRef.current?.querySelector(`[data-heading-id="${h.id}"]`);
                        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      {h.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}

        {/* Main Canvas Scroll Area */}
        <div
          className={`flex-1 overflow-auto p-4 sm:p-8 transition-colors ${
            darkCanvas ? 'bg-slate-900' : 'bg-[#E5E7EB]'
          }`}
          onMouseUp={handleMouseUp}
        >
          <div
            className="mx-auto origin-top transition-transform"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              width: '100%',
              maxWidth: '850px',
            }}
          >
            {/* 8.5" x 11" Proportional Sheet Container */}
            <div
              id="word-document-page"
              className={`relative min-h-[1050px] rounded-sm p-8 sm:p-14 shadow-2xl transition-all ${
                darkCanvas
                  ? 'border border-slate-700 bg-slate-800 text-slate-100 shadow-black/50'
                  : 'border border-slate-300 bg-white text-slate-900'
              }`}
              style={{
                fontFamily: fontFamily || 'Calibri',
              }}
            >
              {/* Document Header Marker */}
              <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] uppercase tracking-wider text-slate-400 select-none">
                <span>Microsoft Word Document — Confidential Legal Draft</span>
                <span>{contractType ? `${contractType.toUpperCase()} AGREEMENT` : 'AGREEMENT'}</span>
              </div>

              {/* Track Changes Notice Banner if active */}
              {trackChanges && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-900 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                    <span>
                      <strong>Track Changes is ON</strong> — Recording text insertions, deletions, and formatting with author attribution (<strong>{currentUserName}</strong>).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrackChanges(false)}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-950 underline"
                  >
                    Turn Off
                  </button>
                </div>
              )}

              {/* ContentEditable Word Canvas */}
              <div
                ref={editorRef}
                id="word-editable-content"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleKeyDown}
                className={`prose prose-slate max-w-none focus:outline-none transition-all ${
                  darkCanvas ? 'prose-invert' : ''
                } ${
                  markupView === 'none' ? '[&_.word-deleted]:hidden [&_.word-inserted]:no-underline [&_.word-inserted]:text-inherit' : ''
                } ${
                  markupView === 'original' ? '[&_.word-inserted]:hidden [&_.word-deleted]:no-underline [&_.word-deleted]:text-inherit [&_.word-deleted]:bg-transparent' : ''
                } [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-[#185ABD] [&>h1]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-[#185ABD] [&>h2]:mb-3 [&>h2]:mt-6 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-[#103F91] [&>h3]:mb-2 [&>h3]:mt-4 [&>p]:leading-relaxed [&>p]:mb-3 [&>blockquote]:border-l-4 [&>blockquote]:border-[#185ABD] [&>blockquote]:bg-slate-50 [&>blockquote]:p-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&_table]:border-collapse [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:p-2 [&_td]:border [&_th]:border`}
              />

              {/* Document Footer Marker */}
              <div className="mt-16 flex items-center justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-400 select-none">
                <span>{contractName}</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Quick Action Selection Bubble */}
        {floatingPos && selectedText && (
          <div
            className="fixed z-40 flex items-center gap-1 rounded-xl border border-slate-300 bg-white/95 p-1 shadow-xl backdrop-blur -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95"
            style={{ left: `${floatingPos.x}px`, top: `${floatingPos.y}px` }}
          >
            <button
              type="button"
              onClick={handleCreateComment}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-amber-100 hover:text-amber-900 transition"
            >
              <span>💬</span>
              <span>Comment</span>
            </button>

            {trackChanges && (
              <button
                type="button"
                onClick={() => markSelectedDeletion(selectedText)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
              >
                <span>✕</span>
                <span>Mark Deletion</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => executeDocCommand('bold')}
              className="rounded-lg p-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => executeDocCommand('hiliteColor', '#FEF08A')}
              className="rounded-lg p-1 text-xs text-yellow-600 hover:bg-yellow-50"
            >
              🖍
            </button>
          </div>
        )}

        {/* Right Margin: Word Markup Balloons & Threaded Comments */}
        {showMarkupBalloons && (
          <WordMarkupBalloons
            changes={changes}
            comments={comments}
            activeChangeId={activeChangeId}
            activeCommentId={activeCommentId}
            onSelectChange={(id) => {
              setActiveChangeId(id);
              scrollToElement(`[data-change-id="${id}"]`);
            }}
            onSelectComment={(id) => {
              setActiveCommentId(id);
              scrollToElement(`[data-comment-id="${id}"]`);
            }}
            onAcceptChange={handleAcceptChange}
            onRejectChange={handleRejectChange}
            onReplyComment={handleReplyComment}
            onToggleResolveComment={handleToggleResolveComment}
            onDeleteComment={handleDeleteComment}
            onJumpNextChange={handleJumpNextChange}
            onJumpPrevChange={handleJumpPrevChange}
            onJumpNextComment={handleJumpNextComment}
            onJumpPrevComment={handleJumpPrevComment}
            currentUserName={currentUserName}
            currentUserColor={currentUserColor}
            readOnly={readOnly}
          />
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. MODAL: Add New Comment on Selected Text */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isCommentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: currentUserColor }}
                >
                  {currentUserName[0]}
                </span>
                <span className="font-bold text-sm text-slate-900">New Threaded Comment</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCommentModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Selected Contract Text:
              </span>
              <div className="mt-1 rounded-lg border-l-3 border-amber-400 bg-amber-50/70 p-2.5 text-xs text-amber-950 italic">
                "{selectedText}"
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-700">Your Discussion / Feedback:</label>
              <textarea
                autoFocus
                rows={3}
                placeholder="Enter feedback or question for counterparties..."
                value={newCommentDraft}
                onChange={(e) => setNewCommentDraft(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-[#185ABD] focus:outline-none"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                Author: <strong>{currentUserName}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCommentModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newCommentDraft.trim()}
                  onClick={handleConfirmCreateComment}
                  className="rounded-xl bg-[#185ABD] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#103F91] disabled:opacity-40"
                >
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. OFFICE WORD STATUS BAR (Bottom Blue/Slate Bar) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-white px-4 py-2 text-xs text-slate-600 select-none">
        {/* Left: Page count, Word count, Proofing */}
        <div className="flex items-center gap-3">
          <span>Page 1 of 1</span>
          <span className="font-semibold text-slate-800">
            {wordCount.toLocaleString()} words · {charCount.toLocaleString()} characters
          </span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="hidden sm:inline">English (United States)</span>
          {trackChanges && (
            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              🔴 Track Changes Active
            </span>
          )}
          {changes.filter((c) => c.status === 'pending').length > 0 && (
            <span className="text-slate-500 hidden sm:inline">
              ({changes.filter((c) => c.status === 'pending').length} pending revisions)
            </span>
          )}
        </div>

        {/* Right: View Mode & Zoom Slider */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Font: <strong className="text-slate-800">{fontFamily}</strong></span>
            <span>·</span>
            <span>Size: <strong className="text-slate-800">{fontSize}pt</strong></span>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Zoom out"
              onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
              className="h-5 w-5 rounded hover:bg-slate-100 text-slate-700 font-bold"
            >
              −
            </button>
            <input
              type="range"
              min="50"
              max="150"
              step="5"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseInt(e.target.value, 10))}
              className="h-1.5 w-20 accent-[#185ABD] cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-[11px] font-medium text-slate-700">
              {zoomLevel}%
            </span>
            <button
              type="button"
              title="Zoom in"
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="h-5 w-5 rounded hover:bg-slate-100 text-slate-700 font-bold"
            >
              +
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
