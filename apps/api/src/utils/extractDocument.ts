import mammoth from 'mammoth';
import { convertDocxToHtml } from './docxToHtml.js';
import { AppError } from './errors.js';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const;

export function fileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

export function assertAllowedUpload(fileName: string, size: number, maxSize: number) {
  const ext = fileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'Please upload a valid DOCX, PDF, or TXT document.');
  }
  if (size > maxSize) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds maximum allowed size of 25MB.');
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function htmlToSearchText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textToHtml(text: string) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks
    .map((block) => `<p>${escapeHtml(block).replaceAll('\n', '<br>')}</p>`)
    .join('');
}

export async function extractEditorContent(
  fileName: string,
  buffer: Buffer,
): Promise<{ html: string; searchableText: string }> {
  const ext = fileExtension(fileName);

  if (ext === '.docx') {
    let html = '';
    try {
      html = await convertDocxToHtml(buffer);
    } catch {
      html = '';
    }
    const tableMissing = !html.includes('<table');
    if (!html.trim() || tableMissing) {
      const result = await mammoth.convertToHtml(
        { buffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const imageBuffer = await image.read('base64');
            return { src: `data:${image.contentType};base64,${imageBuffer}` };
          }),
        },
      );
      const mammothHtml = result.value?.trim() ?? '';
      if (!html.trim() || (tableMissing && mammothHtml.includes('<table'))) {
        html = mammothHtml;
      }
    }
    html = html.trim()
      ? html
      : '<p>(This Word file had no extractable text.)</p>';
    return { html, searchableText: htmlToSearchText(html) };
  }

  if (ext === '.txt') {
    const html = textToHtml(buffer.toString('utf8'));
    return { html, searchableText: htmlToSearchText(html) };
  }

  return { html: '', searchableText: '' };
}
