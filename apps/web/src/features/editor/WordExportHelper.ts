import JSZip from 'jszip';

interface ExportWordOptions {
  contractName: string;
  counterparty?: string;
  contractType?: string;
  status?: string;
  contentHtml: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
}

/**
 * Escapes XML special characters for safe inclusion in Word OpenXML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts HTML content from the editor into valid Word OpenXML paragraph elements (<w:p>)
 */
function convertHtmlToOpenXml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  let xml = '';

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text) return '';
      return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Headings
    if (tagName === 'h1' || tagName === 'h2') {
      const runs = Array.from(el.childNodes).map(processRun).join('');
      return `<w:p>
        <w:pPr>
          <w:pStyle w:val="Heading1"/>
          <w:spacing w:before="240" w:after="120"/>
        </w:pPr>
        ${runs}
      </w:p>`;
    }

    if (tagName === 'h3') {
      const runs = Array.from(el.childNodes).map(processRun).join('');
      return `<w:p>
        <w:pPr>
          <w:pStyle w:val="Heading2"/>
          <w:spacing w:before="180" w:after="80"/>
        </w:pPr>
        ${runs}
      </w:p>`;
    }

    if (tagName === 'h4') {
      const runs = Array.from(el.childNodes).map(processRun).join('');
      return `<w:p>
        <w:pPr>
          <w:pStyle w:val="Heading3"/>
          <w:spacing w:before="120" w:after="60"/>
        </w:pPr>
        ${runs}
      </w:p>`;
    }

    // Paragraphs
    if (tagName === 'p') {
      const runs = Array.from(el.childNodes).map(processRun).join('');
      return `<w:p>
        <w:pPr>
          <w:spacing w:after="160" w:line="276" w:lineRule="auto"/>
        </w:pPr>
        ${runs}
      </w:p>`;
    }

    // Blockquote
    if (tagName === 'blockquote') {
      const runs = Array.from(el.childNodes).map(processRun).join('');
      return `<w:p>
        <w:pPr>
          <w:ind w:left="720" w:right="720"/>
          <w:spacing w:before="120" w:after="120"/>
          <w:pBdr>
            <w:left w:val="single" w:sz="18" w:space="12" w:color="185ABD"/>
          </w:pBdr>
        </w:pPr>
        ${runs}
      </w:p>`;
    }

    // Lists
    if (tagName === 'ul' || tagName === 'ol') {
      const isOrdered = tagName === 'ol';
      return Array.from(el.children)
        .map((li, index) => {
          const runs = Array.from(li.childNodes).map(processRun).join('');
          const prefix = isOrdered ? `${index + 1}. ` : '• ';
          return `<w:p>
            <w:pPr>
              <w:ind w:left="720" w:hanging="360"/>
              <w:spacing w:after="80"/>
            </w:pPr>
            <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(prefix)}</w:t></w:r>
            ${runs}
          </w:p>`;
        })
        .join('');
    }

    // Horizontal Rule
    if (tagName === 'hr') {
      return `<w:p>
        <w:pPr>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="6" w:space="1" w:color="D1D5DB"/>
          </w:pBdr>
          <w:spacing w:before="240" w:after="240"/>
        </w:pPr>
      </w:p>`;
    }

    // Table
    if (tagName === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      const rowsXml = rows
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll('th, td'));
          const cellsXml = cells
            .map((td) => {
              const text = td.textContent || '';
              const isHeader = td.tagName.toLowerCase() === 'th';
              return `<w:tc>
                <w:tcPr>
                  <w:tcW w:w="3000" w:type="dxa"/>
                  <w:tcBorders>
                    <w:top w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                    <w:left w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                    <w:right w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                  </w:tcBorders>
                  ${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : ''}
                </w:tcPr>
                <w:p>
                  <w:pPr><w:spacing w:after="60"/></w:pPr>
                  <w:r>
                    ${isHeader ? '<w:rPr><w:b/></w:rPr>' : ''}
                    <w:t xml:space="preserve">${escapeXml(text)}</w:t>
                  </w:r>
                </w:p>
              </w:tc>`;
            })
            .join('');

          return `<w:tr>${cellsXml}</w:tr>`;
        })
        .join('');

      return `<w:tbl>
        <w:tblPr>
          <w:tblW w:w="9360" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          </w:tblBorders>
        </w:tblPr>
        ${rowsXml}
      </w:tbl>`;
    }

    // Default fallback: parse child nodes as run or paragraph
    const runs = Array.from(el.childNodes).map(processRun).join('');
    if (runs) {
      return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr>${runs}</w:p>`;
    }

    return '';
  }

  function processRun(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text) return '';
      return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const text = el.textContent || '';

      const isBold = tag === 'strong' || tag === 'b' || el.style.fontWeight === 'bold';
      const isItalic = tag === 'em' || tag === 'i' || el.style.fontStyle === 'italic';
      const isUnderline = tag === 'u' || el.style.textDecoration?.includes('underline');
      const isStrike = tag === 's' || tag === 'del' || tag === 'strike' || el.style.textDecoration?.includes('line-through');

      let rPr = '<w:rPr>';
      if (isBold) rPr += '<w:b/>';
      if (isItalic) rPr += '<w:i/>';
      if (isUnderline) rPr += '<w:u w:val="single"/>';
      if (isStrike) rPr += '<w:strike/>';
      rPr += '</w:rPr>';

      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
    }

    return '';
  }

  Array.from(body.childNodes).forEach((child) => {
    xml += processNode(child);
  });

  return xml;
}

/**
 * Builds a true OpenXML .docx archive and triggers the browser download.
 */
export async function exportContractToDocx(options: ExportWordOptions): Promise<void> {
  const {
    contractName,
    counterparty,
    contractType,
    status,
    contentHtml,
    effectiveDate,
    expirationDate,
  } = options;

  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1F2937"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:sz w:val="32"/>
      <w:color w:val="185ABD"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:sz w:val="26"/>
      <w:color w:val="1E3A8A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="374151"/>
    </w:rPr>
  </w:style>
</w:styles>`
  );

  // 5. word/document.xml with legal metadata block + clauses
  const bodyContentXml = convertHtmlToOpenXml(contentHtml);

  // Header legal metadata banner
  const metadataBannerXml = `
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="8" w:color="185ABD"/>
        </w:pBdr>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="18"/>
          <w:color w:val="185ABD"/>
        </w:rPr>
        <w:t xml:space="preserve">CONTRACT LIFECYCLE MANAGEMENT · LEGAL INSTRUMENT</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="120" w:after="200"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="111827"/>
        </w:rPr>
        <w:t>${escapeXml(contractName)}</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="F3F4F6"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="120" w:type="dxa"/>
          <w:left w:w="160" w:type="dxa"/>
          <w:bottom w:w="120" w:type="dxa"/>
          <w:right w:w="160" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="6B7280"/></w:rPr><w:t>COUNTERPARTY</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="111827"/></w:rPr><w:t>${escapeXml(counterparty || 'Acme Partner Corp')}</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="6B7280"/></w:rPr><w:t>CLASSIFICATION / STATUS</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="185ABD"/></w:rPr><w:t>${escapeXml((contractType || 'AGREEMENT').toUpperCase())} · ${escapeXml((status || 'ACTIVE').toUpperCase())}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="6B7280"/></w:rPr><w:t>EFFECTIVE DATE</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(effectiveDate ? new Date(effectiveDate).toLocaleDateString() : 'Upon Signature')}</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="6B7280"/></w:rPr><w:t>EXPIRATION DATE</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(expirationDate ? new Date(expirationDate).toLocaleDateString() : 'Perpetual Term')}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:pPr><w:spacing w:after="300"/></w:pPr></w:p>
  `;

  // Standard legal signature block at bottom
  const signatureBlockXml = `
    <w:p><w:pPr><w:spacing w:before="400" w:after="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>EXECUTION AND SIGNATURES</w:t></w:r></w:p>
    <w:p><w:r><w:t>IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the date first above written.</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/>
          <w:left w:val="none"/>
          <w:bottom w:val="none"/>
          <w:right w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>FIRST PARTY: Acme Contracts Corp</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:before="600"/></w:pPr><w:r><w:t>By: ___________________________</w:t></w:r></w:p>
          <w:p><w:r><w:t>Name: Authorized Signatory</w:t></w:r></w:p>
          <w:p><w:r><w:t>Title: Legal Counsel</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>SECOND PARTY: ${escapeXml(counterparty || 'Counterparty')}</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:before="600"/></w:pPr><w:r><w:t>By: ___________________________</w:t></w:r></w:p>
          <w:p><w:r><w:t>Name: Corporate Officer</w:t></w:r></w:p>
          <w:p><w:r><w:t>Title: Director</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  `;

  // Standard Page geometry: 8.5" x 11" (12240 x 15840 dxa), 1-inch margins (1440 dxa)
  const fullDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${metadataBannerXml}
    ${bodyContentXml}
    ${signatureBlockXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', fullDocumentXml);

  // Generate binary package and trigger browser download
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const fileName = `${contractName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Word.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Parses an uploaded .docx file and extracts the structured text / html content
 */
export async function parseDocxFile(file: File): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(file);
    const documentXmlFile = zip.file('word/document.xml');
    if (!documentXmlFile) {
      throw new Error('Invalid Word document: word/document.xml not found.');
    }

    const xmlContent = await documentXmlFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
    if (paragraphs.length === 0) {
      return '<p>Empty Word document</p>';
    }

    const htmlParts: string[] = [];

    paragraphs.forEach((p) => {
      // Check style
      const styleEl = p.getElementsByTagName('w:pStyle')[0];
      const styleVal = styleEl?.getAttribute('w:val')?.toLowerCase() || '';

      // Extract text runs
      const runs = Array.from(p.getElementsByTagName('w:r'));
      let paragraphHtml = '';

      runs.forEach((r) => {
        const textEl = r.getElementsByTagName('w:t')[0];
        if (!textEl) return;
        const text = textEl.textContent || '';
        const isBold = r.getElementsByTagName('w:b').length > 0;
        const isItalic = r.getElementsByTagName('w:i').length > 0;
        const isUnderline = r.getElementsByTagName('w:u').length > 0;
        const isStrike = r.getElementsByTagName('w:strike').length > 0;

        let formatted = escapeXml(text);
        if (isBold) formatted = `<strong>${formatted}</strong>`;
        if (isItalic) formatted = `<em>${formatted}</em>`;
        if (isUnderline) formatted = `<u>${formatted}</u>`;
        if (isStrike) formatted = `<s>${formatted}</s>`;
        paragraphHtml += formatted;
      });

      if (!paragraphHtml.trim()) return;

      if (styleVal.includes('heading1') || styleVal.includes('title')) {
        htmlParts.push(`<h2>${paragraphHtml}</h2>`);
      } else if (styleVal.includes('heading2')) {
        htmlParts.push(`<h3>${paragraphHtml}</h3>`);
      } else if (styleVal.includes('heading3')) {
        htmlParts.push(`<h4>${paragraphHtml}</h4>`);
      } else {
        htmlParts.push(`<p>${paragraphHtml}</p>`);
      }
    });

    return htmlParts.join('\n');
  } catch (err) {
    console.error('Failed to parse .docx file:', err);
    throw err;
  }
}

/**
 * Copies formatted contract text to clipboard in HTML & text format for seamless pasting into native Word
 */
export async function copyFormattedForWord(html: string): Promise<boolean> {
  try {
    const blobHtml = new Blob([html], { type: 'text/html' });
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const blobText = new Blob([tempDiv.innerText || ''], { type: 'text/plain' });

    if (navigator.clipboard && 'write' in navigator.clipboard) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Clipboard write API unavailable:', err);
    return false;
  }
}
