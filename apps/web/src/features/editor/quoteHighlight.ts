export type QuotedPassage = {
  id: string;
  quoteText: string;
  isResolved?: boolean;
};

type TextPiece = {
  node: Text;
  start: number;
  end: number;
};

function collectTextPieces(root: HTMLElement): { text: string; pieces: TextPiece[] } {
  const pieces: TextPiece[] = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const value = node.textContent ?? '';
    pieces.push({ node: node as Text, start: text.length, end: text.length + value.length });
    text += value;
    node = walker.nextNode();
  }
  return { text, pieces };
}

function rangeFromIndexes(pieces: TextPiece[], start: number, end: number): Range | null {
  const startPiece = pieces.find((piece) => start >= piece.start && start < piece.end);
  const endPiece = [...pieces].reverse().find((piece) => end > piece.start && end <= piece.end);
  if (!startPiece || !endPiece) return null;
  const range = document.createRange();
  range.setStart(startPiece.node, start - startPiece.start);
  range.setEnd(endPiece.node, end - endPiece.start);
  return range;
}

export function rangeForQuote(root: HTMLElement, quote: string): Range | null {
  const needle = quote.replace(/\s+/g, ' ').trim();
  if (!needle) return null;
  const { text, pieces } = collectTextPieces(root);
  let index = text.indexOf(quote.trim());
  let length = quote.trim().length;
  if (index < 0) {
    const compact = text.replace(/\s+/g, ' ');
    const compactIndex = compact.indexOf(needle);
    if (compactIndex < 0) return null;
    let seen = 0;
    let start = -1;
    let end = -1;
    for (let i = 0; i < text.length; i += 1) {
      if (/\s/.test(text[i]!) && i > 0 && /\s/.test(text[i - 1]!)) continue;
      if (seen === compactIndex) start = i;
      seen += 1;
      if (seen === compactIndex + needle.length) {
        end = i + 1;
        break;
      }
    }
    if (start < 0 || end < 0) return null;
    return rangeFromIndexes(pieces, start, end);
  }
  return rangeFromIndexes(pieces, index, index + length);
}

export function applyQuoteHighlights(
  root: HTMLElement,
  passages: QuotedPassage[],
  activeId?: string | null,
) {
  const cssHighlights = (
    CSS as typeof CSS & {
      highlights?: Map<string, Highlight>;
    }
  ).highlights;
  if (!cssHighlights || typeof Highlight === 'undefined') {
    return;
  }

  const resolved = new Highlight();
  const open = new Highlight();
  const active = new Highlight();

  for (const passage of passages) {
    if (!passage.quoteText) continue;
    const range = rangeForQuote(root, passage.quoteText);
    if (!range) continue;
    if (passage.id === activeId) {
      active.add(range);
    } else if (passage.isResolved) {
      resolved.add(range);
    } else {
      open.add(range);
    }
  }

  cssHighlights.set('cml-comment-open', open);
  cssHighlights.set('cml-comment-resolved', resolved);
  cssHighlights.set('cml-comment-active', active);
}

export function clearQuoteHighlights() {
  const cssHighlights = (
    CSS as typeof CSS & {
      highlights?: Map<string, Highlight>;
    }
  ).highlights;
  cssHighlights?.delete('cml-comment-open');
  cssHighlights?.delete('cml-comment-resolved');
  cssHighlights?.delete('cml-comment-active');
}
