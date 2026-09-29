import { type FC, type RefObject, useState, useEffect } from 'react';
import type { CollaboratorPresence } from '@cml/shared';

interface CollaboratorCursorsProps {
  presences: CollaboratorPresence[];
  currentUserId?: string;
  editorRef: RefObject<HTMLDivElement | null>;
}

type ComputedCursor = {
  socketId: string;
  user: CollaboratorPresence['user'];
  left: number;
  top: number;
  height: number;
  selectionRects?: Array<{ left: number; top: number; width: number; height: number }>;
};

export const CollaboratorCursors: FC<CollaboratorCursorsProps> = ({
  presences,
  currentUserId,
  editorRef,
}) => {
  const [computedCursors, setComputedCursors] = useState<ComputedCursor[]>([]);

  useEffect(() => {
    if (!editorRef.current) return;
    const editorEl = editorRef.current;
    const editorRect = editorEl.getBoundingClientRect();

    const otherPresences = presences.filter(
      (p) => p.user.id !== currentUserId && p.cursor,
    );

    const calculated: ComputedCursor[] = [];

    // Helper: find range from character offset
    function rangeFromCharOffset(targetOffset: number): Range | null {
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
      let currentNode = walker.nextNode();
      let accumulated = 0;

      while (currentNode) {
        const textLen = (currentNode.textContent || '').length;
        if (accumulated + textLen >= targetOffset) {
          const offsetInNode = Math.max(0, Math.min(textLen, targetOffset - accumulated));
          const range = document.createRange();
          try {
            range.setStart(currentNode, offsetInNode);
            range.collapse(true);
            return range;
          } catch {
            return null;
          }
        }
        accumulated += textLen;
        currentNode = walker.nextNode();
      }

      // If at end of document
      if (editorEl.lastChild) {
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        range.collapse(false);
        return range;
      }
      return null;
    }

    // Helper: find quote range
    function rangeForQuoteText(quote: string): Range | null {
      const cleanQuote = quote.replace(/\s+/g, ' ').trim();
      if (!cleanQuote) return null;
      const text = editorEl.innerText || '';
      const idx = text.indexOf(cleanQuote);
      if (idx < 0) return null;
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      let count = 0;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;

      while (node) {
        const len = (node.textContent || '').length;
        if (!startNode && count + len >= idx) {
          startNode = node;
          startOffset = idx - count;
        }
        if (startNode && count + len >= idx + cleanQuote.length) {
          endNode = node;
          endOffset = idx + cleanQuote.length - count;
          break;
        }
        count += len;
        node = walker.nextNode();
      }

      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
      }
      return null;
    }

    for (const p of otherPresences) {
      const cur = p.cursor!;
      let x: number | null = null;
      let y: number | null = null;
      let h = 20;

      // 1. Try exact character offset resolution
      if (typeof cur.characterOffset === 'number' && cur.characterOffset >= 0) {
        const charRange = rangeFromCharOffset(cur.characterOffset);
        if (charRange) {
          const rects = charRange.getClientRects();
          if (rects.length > 0) {
            x = rects[0].left - editorRect.left;
            y = rects[0].top - editorRect.top;
            h = Math.max(16, rects[0].height);
          }
        }
      }

      // 2. Fall back to unscaled coordinates if available
      if (x === null || y === null) {
        if (typeof cur.unscaledX === 'number' && typeof cur.unscaledY === 'number') {
          x = cur.unscaledX;
          y = cur.unscaledY;
          h = cur.caretHeight || 20;
        }
      }

      // 3. Fall back to ratio relative to editorRect
      if (x === null || y === null) {
        if (typeof cur.xRatio === 'number' && typeof cur.yRatio === 'number') {
          x = cur.xRatio * editorRect.width;
          y = cur.yRatio * editorRect.height;
        }
      }

      if (x !== null && y !== null) {
        // Look up selection highlight if present
        let selRects: Array<{ left: number; top: number; width: number; height: number }> | undefined;
        if (p.selection?.quoteText) {
          const selRange = rangeForQuoteText(p.selection.quoteText);
          if (selRange) {
            const rawRects = Array.from(selRange.getClientRects());
            selRects = rawRects.map((r) => ({
              left: r.left - editorRect.left,
              top: r.top - editorRect.top,
              width: r.width,
              height: r.height,
            }));
          }
        }

        calculated.push({
          socketId: p.socketId,
          user: p.user,
          left: Math.max(0, Math.min(x, editorRect.width - 2)),
          top: Math.max(0, y),
          height: h,
          selectionRects: selRects,
        });
      }
    }

    setComputedCursors(calculated);
  }, [presences, currentUserId, editorRef]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {/* Remote User Selections */}
      {computedCursors.map((c) =>
        c.selectionRects?.map((rect, idx) => (
          <div
            key={`sel-${c.socketId}-${idx}`}
            className="absolute rounded-xs pointer-events-none transition-all duration-75"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              backgroundColor: c.user.color || '#3b82f6',
              opacity: 0.22,
            }}
          />
        )),
      )}

      {/* Remote User Carets & Name Badges */}
      {computedCursors.map((c) => (
        <div
          key={`cursor-${c.socketId}`}
          className="absolute pointer-events-none transition-all duration-100 ease-out"
          style={{
            transform: `translate3d(${c.left}px, ${c.top}px, 0)`,
          }}
        >
          {/* Vertical Caret */}
          <div
            className="w-[2.5px] rounded-full shadow-xs"
            style={{
              height: `${c.height}px`,
              backgroundColor: c.user.color || '#3b82f6',
            }}
          />

          {/* User Name Tooltip Badge */}
          <div
            className="absolute left-0 -top-6 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md whitespace-nowrap select-none flex items-center gap-1"
            style={{
              backgroundColor: c.user.color || '#3b82f6',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span>{c.user.name}</span>
            {c.user.role && (
              <span className="opacity-80 text-[9px] uppercase font-normal">
                ({c.user.role})
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
