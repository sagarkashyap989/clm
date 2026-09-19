import { useState } from 'react';

type PdfDocumentViewerProps = {
  contractName: string;
  counterparty: string;
  file?: {
    fileName?: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: string;
  } | null;
  onSwitchToEditor?: () => void;
};

export function PdfDocumentViewer({
  contractName,
  counterparty,
  file,
  onSwitchToEditor,
}: PdfDocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = 2;
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  function handleDownload() {
    const fakeContent = `CLM Legal Contract Export: ${contractName}\nCounterparty: ${counterparty}\nGenerated on: ${new Date().toISOString()}`;
    const blob = new Blob([fakeContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file?.fileName || `${contractName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      id="pdf-document-viewer"
      className="flex flex-col rounded-2xl border border-ink-100 bg-white shadow-card"
    >
      {/* Top Document Viewer Control Bar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-slate-50/95 px-3 py-2 backdrop-blur sm:px-4">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Previous Page"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="rounded border border-ink-200 bg-white p-1 text-xs font-bold text-ink-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-xs font-medium text-ink-700">
            Page <span className="font-semibold text-ink-950">{currentPage}</span> of{' '}
            <span className="font-semibold text-ink-950">{totalPages}</span>
          </span>
          <button
            type="button"
            title="Next Page"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-ink-200 bg-white p-1 text-xs font-bold text-ink-700 hover:bg-slate-50 disabled:opacity-40"
          >
            →
          </button>
        </div>

        {/* Center: Zoom and Rotate */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Zoom out"
            onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
            className="rounded border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-700 hover:bg-slate-50"
          >
            −
          </button>
          <span className="w-12 text-center text-xs font-mono font-medium text-ink-700">
            {zoomLevel}%
          </span>
          <button
            type="button"
            title="Zoom in"
            onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
            className="rounded border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-700 hover:bg-slate-50"
          >
            +
          </button>
          <button
            type="button"
            title="Rotate 90 deg"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="ml-2 rounded border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-700 hover:bg-slate-50"
          >
            ↻ Rotate
          </button>
        </div>

        {/* Right: Search, Download, and Switch to Editor */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSearchOpen((s) => !s)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              isSearchOpen
                ? 'border-accent bg-accent text-white'
                : 'border-ink-200 bg-white text-ink-700 hover:bg-slate-50'
            }`}
          >
            Search text
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-50"
          >
            Download Original
          </button>
          {onSwitchToEditor && (
            <button
              type="button"
              onClick={onSwitchToEditor}
              className="rounded-lg bg-ink-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-ink-800"
            >
              Edit in Workspace →
            </button>
          )}
        </div>
      </div>

      {/* Search Input dropdown */}
      {isSearchOpen && (
        <div className="flex items-center gap-2 border-b border-ink-100 bg-amber-50/70 px-4 py-2 text-xs">
          <span className="font-semibold text-ink-700">Find in document:</span>
          <input
            type="text"
            placeholder="Type keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded border border-ink-200 bg-white px-2 py-1 text-xs focus:border-accent focus:outline-none"
          />
          {searchTerm && (
            <span className="text-[11px] text-ink-500">
              Highlighting terms matching &quot;{searchTerm}&quot;
            </span>
          )}
        </div>
      )}

      {/* PDF Viewport */}
      <div className="relative min-h-[620px] overflow-auto bg-slate-200/70 p-4 sm:p-8">
        <div
          className="mx-auto transition-transform origin-top"
          style={{
            transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
            width: '100%',
            maxWidth: '820px',
          }}
        >
          {/* Simulated PDF Sheet */}
          <div
            id="pdf-rendered-sheet"
            className="relative min-h-[1050px] rounded border border-ink-300 bg-white p-12 shadow-xl sm:p-16"
          >
            {/* Watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03]">
              <span className="font-serif text-8xl font-black uppercase tracking-widest text-ink-950">
                OFFICIAL COPY
              </span>
            </div>

            {/* Document Header */}
            <div className="mb-8 border-b-2 border-ink-900 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="font-serif text-2xl font-bold tracking-tight text-ink-950">
                    {contractName}
                  </h1>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-500">
                    Binding Legal Instrument • Registered Repository Copy
                  </p>
                </div>
                <div className="rounded border border-ink-300 bg-slate-50 px-3 py-1.5 text-right font-mono text-[11px] text-ink-600">
                  <div>DOC REF: CLM-{file?.fileName ? 'ORIG' : 'ELEC'}</div>
                  <div>SECURITY: ENCRYPTED</div>
                </div>
              </div>
            </div>

            {/* Page 1 Content */}
            {currentPage === 1 && (
              <div className="space-y-6 text-xs leading-relaxed text-ink-800">
                <p>
                  THIS AGREEMENT (the &quot;Agreement&quot;) is entered into and made effective as of the
                  execution date, by and between <strong>Acme Contracts Corp</strong>, having its
                  principal business office at 100 Corporate Plaza, Suite 400 (&quot;First Party&quot;), and{' '}
                  <strong>{counterparty}</strong> (&quot;Second Party&quot;).
                </p>

                <div>
                  <h3 className="mb-2 font-serif text-sm font-bold uppercase text-ink-950">
                    SECTION 1: PURPOSE AND APPOINTMENT
                  </h3>
                  <p className="text-justify">
                    1.1 The purpose of this Instrument is to establish the formal contractual terms,
                    covenants, service definitions, and commercial responsibilities binding upon both
                    parties regarding the delivery of contracted services and deliverables.
                  </p>
                  <p className="mt-2 text-justify">
                    1.2 Each party covenants to perform its respective duties in good faith and in
                    strict accordance with applicable federal, state, and international regulatory
                    standards.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 font-serif text-sm font-bold uppercase text-ink-950">
                    SECTION 2: OBLIGATIONS AND COMPLIANCE
                  </h3>
                  <p className="text-justify">
                    2.1 Deliverables and performance milestones shall be reviewed by designated
                    officers within ten (10) business days of submission.
                  </p>
                  <p className="mt-2 text-justify">
                    2.2 Any amendment or modification to terms must be executed in writing and
                    electronically counter-signed by an authorized representative of each party.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 font-serif text-sm font-bold uppercase text-ink-950">
                    SECTION 3: CONFIDENTIALITY AND DATA GOVERNANCE
                  </h3>
                  <p className="text-justify">
                    3.1 All non-public financial, technical, or customer data disclosed during the term
                    shall be maintained under strict cryptographic and operational protections.
                  </p>
                </div>
              </div>
            )}

            {/* Page 2 Content */}
            {currentPage === 2 && (
              <div className="space-y-6 text-xs leading-relaxed text-ink-800">
                <div>
                  <h3 className="mb-2 font-serif text-sm font-bold uppercase text-ink-950">
                    SECTION 4: GOVERNING LAW AND DISPUTE RESOLUTION
                  </h3>
                  <p className="text-justify">
                    4.1 This Agreement shall be governed by, construed, and enforced in accordance
                    with the laws of the State of Delaware, without regard to principles of
                    conflicts of law.
                  </p>
                  <p className="mt-2 text-justify">
                    4.2 Any dispute arising hereunder shall be submitted to confidential binding
                    arbitration under the auspices of the American Arbitration Association (AAA).
                  </p>
                </div>

                {/* Signature Blocks */}
                <div className="mt-16 border-t-2 border-ink-200 pt-8">
                  <h4 className="mb-6 font-serif text-xs font-bold uppercase tracking-wider text-ink-900">
                    IN WITNESS WHEREOF, THE PARTIES HERETO HAVE EXECUTED THIS AGREEMENT:
                  </h4>

                  <div className="grid grid-cols-2 gap-10">
                    {/* Acme Contracts Corp */}
                    <div className="rounded-lg border border-ink-200 bg-slate-50/50 p-4">
                      <div className="text-[11px] font-bold text-ink-900">ACME CONTRACTS CORP</div>
                      <div className="my-6 border-b border-dashed border-ink-400 pb-1 font-serif italic text-ink-800">
                        Sarah Connor, Legal Counsel
                      </div>
                      <div className="text-[10px] text-ink-500">
                        Date: {new Date().toLocaleDateString()}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800">
                        ✓ Authenticated Signature
                      </div>
                    </div>

                    {/* Counterparty */}
                    <div className="rounded-lg border border-ink-200 bg-slate-50/50 p-4">
                      <div className="text-[11px] font-bold text-ink-900">
                        {counterparty.toUpperCase()}
                      </div>
                      <div className="my-6 border-b border-dashed border-ink-400 pb-1 font-serif italic text-ink-800">
                        Authorized Signatory
                      </div>
                      <div className="text-[10px] text-ink-500">
                        Date: {new Date().toLocaleDateString()}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800">
                        ✓ Counter-Signed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sheet Footer */}
            <div className="absolute bottom-6 left-12 right-12 flex items-center justify-between border-t border-ink-100 pt-3 text-[10px] text-ink-400">
              <span>{file?.fileName || `${contractName}.pdf`}</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
