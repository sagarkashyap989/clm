import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  useCallback,
} from 'react';
import { DocumentEditorToolbar } from './DocumentEditorToolbar';

type DocumentEditorCanvasProps = {
  initialContent: string;
  onContentChange: (content: string) => void;
  onTriggerSaveVersion?: () => void;
  autosaveStatus?: 'saved' | 'saving' | 'unsaved';
  lastSavedAt?: string | null;
  readOnly?: boolean;
};

export function DocumentEditorCanvas({
  initialContent,
  onContentChange,
  onTriggerSaveVersion,
  autosaveStatus = 'saved',
  lastSavedAt,
  readOnly = false,
}: DocumentEditorCanvasProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);

  // Initialize editor content once
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
      editorRef.current.innerHTML = initialContent || '<p>Start typing your contract clauses here...</p>';
      calculateMetrics();
    }
  }, [initialContent]);

  const calculateMetrics = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    setWordCount(words);
    setCharCount(chars);
  }, []);

  function handleInput() {
    if (!editorRef.current) return;
    calculateMetrics();
    onContentChange(editorRef.current.innerHTML);
  }

  function handleCommand(command: string, value?: string) {
    if (readOnly) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleInput();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Ctrl+S / Cmd+S -> Trigger Save Version
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onTriggerSaveVersion?.();
      return;
    }
    // Ctrl+F / Cmd+F -> Toggle Find & Replace
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setIsFindOpen((prev) => !prev);
      return;
    }
  }

  // Find occurrences
  function handleFind() {
    if (!findTerm || !editorRef.current) {
      setMatchCount(0);
      return;
    }
    const text = editorRef.current.innerText.toLowerCase();
    const matches = text.split(findTerm.toLowerCase()).length - 1;
    setMatchCount(matches);
  }

  // Replace occurrence
  function handleReplace() {
    if (!findTerm || !editorRef.current || readOnly) return;
    const html = editorRef.current.innerHTML;
    // Replace first occurrence (case-insensitive)
    const regex = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (regex.test(html)) {
      editorRef.current.innerHTML = html.replace(regex, replaceTerm);
      handleInput();
      handleFind();
    }
  }

  // Replace All occurrences
  function handleReplaceAll() {
    if (!findTerm || !editorRef.current || readOnly) return;
    const html = editorRef.current.innerHTML;
    const regex = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    editorRef.current.innerHTML = html.replace(regex, replaceTerm);
    handleInput();
    handleFind();
  }

  return (
    <div className="flex flex-col rounded-2xl border border-ink-100 bg-white shadow-card">
      {/* Top Formatting Toolbar */}
      <DocumentEditorToolbar
        onCommand={handleCommand}
        onToggleFind={() => setIsFindOpen((prev) => !prev)}
        isFindOpen={isFindOpen}
        readOnly={readOnly}
      />

      {/* Floating Find & Replace Banner */}
      {isFindOpen && (
        <div
          id="find-replace-banner"
          className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-amber-50/70 px-4 py-2.5 text-xs text-ink-800 transition"
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

      {/* Editor Paper Canvas Container */}
      <div className="relative min-h-[560px] overflow-auto bg-slate-100/70 p-4 sm:p-8">
        <div
          className="mx-auto transition-transform origin-top"
          style={{ transform: `scale(${zoomLevel / 100})`, width: '100%', maxWidth: '820px' }}
        >
          {/* Simulated 8.5 x 11 Page Layout */}
          <div
            id="contract-document-page"
            className="relative min-h-[900px] rounded-lg border border-ink-200/80 bg-white p-8 shadow-md sm:p-14"
          >
            {/* Document Header Line */}
            <div className="mb-6 flex items-center justify-between border-b border-ink-100 pb-3 text-[11px] uppercase tracking-wider text-ink-400">
              <span>CLM Legal Workspace — Contract Document</span>
              <span>Confidential</span>
            </div>

            {/* Editable rich-text canvas */}
            <div
              ref={editorRef}
              id="contract-editable-content"
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              className="prose prose-slate max-w-none text-ink-900 focus:outline-none [&>blockquote]:border-l-4 [&>blockquote]:border-accent [&>blockquote]:bg-slate-50 [&>blockquote]:p-3 [&>h2]:mb-3 [&>h2]:mt-6 [&>h2]:font-serif [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-ink-950 [&>h3]:mb-2 [&>h3]:mt-4 [&>h3]:font-serif [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-ink-900 [&>p]:mb-3 [&>p]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
            />

            {/* Document Footer */}
            <div className="mt-12 flex items-center justify-between border-t border-ink-100 pt-4 text-[11px] text-ink-400">
              <span>Acme Contracts Legal Repository</span>
              <span>Page 1</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status & Metrics Bar */}
      <div
        id="editor-status-bar"
        className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-ink-100 bg-slate-50 px-4 py-2.5 text-xs text-ink-600"
      >
        {/* Left: Autosave indicator */}
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
                  ({new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </>
          )}
          {autosaveStatus === 'unsaved' && (
            <>
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="text-ink-500">Unsaved changes (press Ctrl+S to save new version)</span>
            </>
          )}
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
    </div>
  );
}
