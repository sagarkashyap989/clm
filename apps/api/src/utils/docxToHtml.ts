import { DOMParser, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import JSZip from 'jszip';

function isElement(node: XmlNode): node is XmlElement {
  return node.nodeType === 1;
}

function localName(node: XmlNode): string {
  if (!isElement(node)) return '';
  return node.localName || node.nodeName.replace(/^.*:/, '');
}

function childElements(el: XmlElement): XmlElement[] {
  return Array.from(el.childNodes).filter(isElement);
}

function childrenNamed(el: XmlElement, name: string): XmlElement[] {
  return childElements(el).filter((child) => localName(child) === name);
}

function firstNamed(el: XmlElement, name: string): XmlElement | undefined {
  return childrenNamed(el, name)[0];
}

function descendant(el: XmlElement, name: string): XmlElement | undefined {
  if (localName(el) === name) return el;
  for (const child of childElements(el)) {
    const found = descendant(child, name);
    if (found) return found;
  }
  return undefined;
}

function attr(el: XmlElement, name: string): string {
  return (
    el.getAttribute(name) ||
    el.getAttribute(`w:${name}`) ||
    el.getAttribute(`r:${name}`) ||
    el.getAttribute(`a:${name}`) ||
    ''
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const nodes = Array.from(doc.getElementsByTagName('*')).filter(
    (node) => localName(node) === 'Relationship',
  );
  for (const node of nodes) {
    const id = node.getAttribute('Id') || '';
    const target = node.getAttribute('Target') || '';
    if (id && target) {
      map.set(id, target.replace(/^\//, '').replace(/^word\//, ''));
    }
  }
  return map;
}

function paragraphAlign(pPr: XmlElement | undefined): string {
  const jc = pPr ? firstNamed(pPr, 'jc') : undefined;
  const val = jc ? attr(jc, 'val') : '';
  if (val === 'center') return 'text-align:center';
  if (val === 'right' || val === 'end') return 'text-align:right';
  if (val === 'both') return 'text-align:justify';
  return '';
}

function headingTag(pPr: XmlElement | undefined): string {
  const pStyle = pPr ? firstNamed(pPr, 'pStyle') : undefined;
  const style = (pStyle ? attr(pStyle, 'val') : '').toLowerCase();
  if (style.includes('heading1') || style === 'title') return 'h2';
  if (style.includes('heading2') || style === 'subtitle') return 'h3';
  if (style.includes('heading3')) return 'h4';
  return 'p';
}

function isListParagraph(pPr: XmlElement | undefined): boolean {
  if (!pPr) return false;
  if (firstNamed(pPr, 'numPr')) return true;
  const pStyle = firstNamed(pPr, 'pStyle');
  const style = (pStyle ? attr(pStyle, 'val') : '').toLowerCase();
  return style.includes('list');
}

function onOff(el: XmlElement | undefined): boolean {
  if (!el) return false;
  const val = attr(el, 'val').toLowerCase();
  if (!val) return true;
  return val !== '0' && val !== 'false' && val !== 'off';
}

function convertRun(run: XmlElement): string {
  const rPr = firstNamed(run, 'rPr');
  const bold = onOff(rPr ? firstNamed(rPr, 'b') : undefined);
  const italic = onOff(rPr ? firstNamed(rPr, 'i') : undefined);
  const underline = Boolean(rPr && firstNamed(rPr, 'u') && attr(firstNamed(rPr, 'u')!, 'val') !== 'none');
  const strike = Boolean(rPr && (firstNamed(rPr, 'strike') || firstNamed(rPr, 'dstrike')));

  let text = '';
  for (const child of childElements(run)) {
    const name = localName(child);
    if (name === 't') {
      text += escapeHtml(child.textContent ?? '');
    } else if (name === 'tab') {
      text += '&emsp;';
    } else if (name === 'br') {
      text += '<br>';
    } else if (name === 'cr') {
      text += '<br>';
    } else if (name === 'drawing' || name === 'pict') {
      text += convertImage(child);
    }
  }
  if (!text) return '';
  if (bold) text = `<strong>${text}</strong>`;
  if (italic) text = `<em>${text}</em>`;
  if (underline) text = `<u>${text}</u>`;
  if (strike) text = `<s>${text}</s>`;
  return text;
}

let imageResolver: ((relId: string) => string) | null = null;

function convertImage(drawing: XmlElement): string {
  const blip = descendant(drawing, 'blip');
  if (!blip || !imageResolver) return '';
  const relId = attr(blip, 'embed') || blip.getAttribute('r:embed') || '';
  if (!relId) return '';
  const src = imageResolver(relId);
  if (!src) return '';
  return `<img src="${src}" alt="" />`;
}

function unwrapBlocks(el: XmlElement): XmlElement[] {
  const blocks: XmlElement[] = [];
  for (const child of childElements(el)) {
    const name = localName(child);
    if (name === 'sdt') {
      const content = firstNamed(child, 'sdtContent');
      if (content) blocks.push(...unwrapBlocks(content));
    } else if (name === 'ins' || name === 'del' || name === 'moveFrom' || name === 'moveTo' || name === 'smartTag') {
      blocks.push(...unwrapBlocks(child));
    } else if (name === 'customXml' || name === 'fldSimple') {
      blocks.push(...unwrapBlocks(child));
    } else {
      blocks.push(child);
    }
  }
  return blocks;
}

function convertParagraph(p: XmlElement): string {
  const pPr = firstNamed(p, 'pPr');
  const tag = headingTag(pPr);
  const align = paragraphAlign(pPr);
  let inner = '';
  for (const child of childElements(p)) {
    const name = localName(child);
    if (name === 'r') inner += convertRun(child);
    else if (name === 'hyperlink') {
      inner += childElements(child)
        .filter((node) => localName(node) === 'r')
        .map(convertRun)
        .join('');
    } else if (name === 'sdt') {
      const content = firstNamed(child, 'sdtContent');
      if (content) {
        inner += childElements(content)
          .filter((node) => localName(node) === 'r' || localName(node) === 'hyperlink')
          .map((node) => (localName(node) === 'r' ? convertRun(node) : convertParagraph(node)))
          .join('');
      }
    }
  }
  const style = align ? ` style="${align}"` : '';
  if (isListParagraph(pPr)) {
    return `<li${style}>${inner || '&nbsp;'}</li>`;
  }
  return `<${tag}${style}>${inner || '&nbsp;'}</${tag}>`;
}

type ParsedCell = {
  el: XmlElement;
  col: number;
  colspan: number;
  merge: 'restart' | 'continue' | null;
  header: boolean;
  skip: boolean;
  rowspan: number;
};

function parseTableCells(tbl: XmlElement): ParsedCell[][] {
  return unwrapBlocks(tbl)
    .filter((node) => localName(node) === 'tr')
    .map((tr) => {
      const header = Boolean(firstNamed(tr, 'trPr') && firstNamed(firstNamed(tr, 'trPr')!, 'tblHeader'));
      let col = 0;
      return unwrapBlocks(tr)
        .filter((node) => localName(node) === 'tc')
        .map((tc) => {
          const tcPr = firstNamed(tc, 'tcPr');
          const gridSpanEl = tcPr ? firstNamed(tcPr, 'gridSpan') : undefined;
          const colspan = Math.max(1, Number(gridSpanEl ? attr(gridSpanEl, 'val') : '1') || 1);
          const vMerge = tcPr ? firstNamed(tcPr, 'vMerge') : undefined;
          const mergeVal = vMerge ? attr(vMerge, 'val') || 'continue' : '';
          const cell: ParsedCell = {
            el: tc,
            col,
            colspan,
            merge: vMerge ? (mergeVal === 'restart' ? 'restart' : 'continue') : null,
            header,
            skip: false,
            rowspan: 1,
          };
          col += colspan;
          return cell;
        });
    });
}

function convertTable(tbl: XmlElement): string {
  const parsedRows = parseTableCells(tbl);
  parsedRows.forEach((row, rowIndex) => {
    for (const cell of row) {
      if (cell.merge !== 'restart') continue;
      let span = 1;
      for (let next = rowIndex + 1; next < parsedRows.length; next += 1) {
        const continued = parsedRows[next].find(
          (candidate) => candidate.col === cell.col && candidate.merge === 'continue',
        );
        if (!continued) break;
        continued.skip = true;
        span += 1;
      }
      cell.rowspan = span;
    }
  });

  const rows = parsedRows.map((row) => {
    const cells = row
      .filter((cell) => !cell.skip)
      .map((cell) => {
        const tag = cell.header ? 'th' : 'td';
        const inner = convertBlockList(unwrapBlocks(cell.el));
        const attrs = [
          cell.colspan > 1 ? `colspan="${cell.colspan}"` : '',
          cell.rowspan > 1 ? `rowspan="${cell.rowspan}"` : '',
        ]
          .filter(Boolean)
          .join(' ');
        return `<${tag}${attrs ? ` ${attrs}` : ''}>${inner || '&nbsp;'}</${tag}>`;
      });
    return `<tr>${cells.join('')}</tr>`;
  });

  return `<table class="imported-table">${rows.join('')}</table>`;
}

function convertBlockList(blocks: XmlElement[]): string {
  const html: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      html.push(`<ul>${listBuffer.join('')}</ul>`);
      listBuffer = [];
    }
  };

  for (const block of blocks) {
    const name = localName(block);
    if (name === 'tbl') {
      flushList();
      html.push(convertTable(block));
    } else if (name === 'p') {
      const converted = convertParagraph(block);
      if (converted.startsWith('<li')) {
        listBuffer.push(converted);
      } else {
        flushList();
        html.push(converted);
      }
    } else if (name === 'sdt') {
      const content = firstNamed(block, 'sdtContent');
      if (content) {
        flushList();
        html.push(convertBlockList(unwrapBlocks(content)));
      }
    }
  }
  flushList();
  return html.join('');
}

export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('Invalid Word document');
  }
  const documentXml = await documentFile.async('string');
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const rels = relsFile ? parseRels(await relsFile.async('string')) : new Map<string, string>();
  const mediaCache = new Map<string, string>();

  for (const [id, target] of rels.entries()) {
    if (!/media\//i.test(target)) continue;
    const file = zip.file(target.startsWith('word/') ? target : `word/${target}`);
    if (!file) continue;
    const bytes = await file.async('base64');
    const ext = target.split('.').pop()?.toLowerCase() ?? 'png';
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/png';
    mediaCache.set(id, `data:${mime};base64,${bytes}`);
  }

  imageResolver = (relId: string) => mediaCache.get(relId) ?? '';

  const doc = new DOMParser().parseFromString(documentXml, 'text/xml');
  const body = Array.from(doc.getElementsByTagName('*')).find((node) => localName(node) === 'body');
  if (!body) {
    throw new Error('Word document has no body');
  }

  const html = convertBlockList(unwrapBlocks(body as XmlElement));
  imageResolver = null;
  return html.trim();
}
