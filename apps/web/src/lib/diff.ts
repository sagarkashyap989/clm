import { diffWords, diffLines, type Change } from 'diff';

export type DiffMode = 'words' | 'lines';

export type DiffResult = {
  changes: Change[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
};

export function computeTextDiff(
  oldText: string,
  newText: string,
  mode: DiffMode = 'words',
): DiffResult {
  const changes =
    mode === 'lines' ? diffLines(oldText, newText) : diffWords(oldText, newText);

  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  for (const change of changes) {
    if (change.added) {
      addedCount += change.count ?? 1;
    } else if (change.removed) {
      removedCount += change.count ?? 1;
    } else {
      unchangedCount += change.count ?? 1;
    }
  }

  return {
    changes,
    addedCount,
    removedCount,
    unchangedCount,
  };
}

/**
 * Strips HTML tags to plain text for comparison purposes
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
