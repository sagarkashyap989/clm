import { type MouseEvent } from 'react';

type DocumentEditorToolbarProps = {
  onCommand: (command: string, value?: string) => void;
  onToggleFind: () => void;
  onCommentSelection?: () => void;
  isFindOpen: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  readOnly?: boolean;
};

export function DocumentEditorToolbar({
  onCommand,
  onToggleFind,
  onCommentSelection,
  isFindOpen,
  readOnly = false,
}: DocumentEditorToolbarProps) {
  function handleButtonClick(e: MouseEvent, command: string, value?: string) {
    e.preventDefault();
    if (readOnly) return;
    onCommand(command, value);
  }

  return (
    <div
      id="document-editor-toolbar"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-1 rounded-t-2xl border-b border-ink-100 bg-slate-50/95 px-3 py-2 backdrop-blur sm:px-4"
    >
      {/* Headings / Block Dropdown */}
      <div className="flex items-center gap-1 border-r border-ink-100 pr-2">
        <select
          aria-label="Format block level"
          disabled={readOnly}
          onChange={(e) => {
            const val = e.target.value;
            onCommand('formatBlock', val);
          }}
          className="rounded-lg border border-ink-100 bg-white px-2.5 py-1 text-xs font-semibold text-ink-900 shadow-sm focus:border-accent focus:outline-none disabled:opacity-50"
        >
          <option value="<p>">Normal Text</option>
          <option value="<h2>">Heading 1</option>
          <option value="<h3>">Heading 2</option>
          <option value="<h4>">Heading 3</option>
          <option value="<blockquote>">Quote Block</option>
        </select>
      </div>

      {/* Bold, Italic, Underline, Strikethrough */}
      <div className="flex items-center gap-0.5 border-r border-ink-100 pr-2">
        <button
          type="button"
          title="Bold (Ctrl+B)"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'bold')}
          className="rounded p-1.5 font-bold text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <span className="font-serif text-sm">B</span>
        </button>
        <button
          type="button"
          title="Italic (Ctrl+I)"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'italic')}
          className="rounded p-1.5 italic text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <span className="font-serif text-sm">I</span>
        </button>
        <button
          type="button"
          title="Underline (Ctrl+U)"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'underline')}
          className="rounded p-1.5 underline text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <span className="font-serif text-sm">U</span>
        </button>
        <button
          type="button"
          title="Strikethrough"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'strikeThrough')}
          className="rounded p-1.5 line-through text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <span className="font-serif text-sm">S</span>
        </button>
      </div>

      {/* Lists & Indent */}
      <div className="flex items-center gap-0.5 border-r border-ink-100 pr-2">
        <button
          type="button"
          title="Bullet List"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'insertUnorderedList')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16M2 6h.01M2 12h.01M2 18h.01" />
          </svg>
        </button>
        <button
          type="button"
          title="Numbered List"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'insertOrderedList')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-0.5 border-r border-ink-100 pr-2">
        <button
          type="button"
          title="Align Left"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'justifyLeft')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h14" />
          </svg>
        </button>
        <button
          type="button"
          title="Align Center"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'justifyCenter')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M7 12h10M5 18h14" />
          </svg>
        </button>
        <button
          type="button"
          title="Align Right"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'justifyRight')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M10 12h10M6 18h14" />
          </svg>
        </button>
      </div>

      {/* Divider / Horizontal Rule */}
      <div className="flex items-center gap-0.5 border-r border-ink-100 pr-2">
        <button
          type="button"
          title="Insert Horizontal Divider"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'insertHorizontalRule')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          ―
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 border-r border-ink-100 pr-2">
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'undo')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          ↺
        </button>
        <button
          type="button"
          title="Redo (Ctrl+Y)"
          disabled={readOnly}
          onClick={(e) => handleButtonClick(e, 'redo')}
          className="rounded p-1.5 text-xs text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
        >
          ↻
        </button>
      </div>

      {/* Find & Replace Toggle */}
      <div className="ml-auto flex items-center gap-1">
        {onCommentSelection ? (
          <button
            type="button"
            title="Comment on selected text (Ctrl+M)"
            disabled={readOnly}
            onClick={onCommentSelection}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-white hover:text-ink-950 disabled:opacity-50"
          >
            Comment
          </button>
        ) : null}
        <button
          type="button"
          id="toggle-find-replace-btn"
          title="Find and Replace (Ctrl+F)"
          onClick={onToggleFind}
          className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
            isFindOpen
              ? 'bg-accent text-white'
              : 'text-ink-700 hover:bg-white hover:text-ink-950'
          }`}
        >
          Find / Replace
        </button>
      </div>
    </div>
  );
}
