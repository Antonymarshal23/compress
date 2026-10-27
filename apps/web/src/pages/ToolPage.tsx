import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { Link, useLocation, useParams } from 'react-router-dom';
import { tools } from '../data/tools';
import { Seo } from '../components/Seo';
import { AdSlot } from '../components/AdSlot';
import { PaperPilotBrand } from '../components/PaperPilotBrand';

export default function ToolPage() {
  const { slug } = useParams();
  const location = useLocation();
  const tool = useMemo(() => tools.find((candidate) => candidate.slug === slug) ?? tools[0], [slug]);
  const [files, setFiles] = useState<File[]>(() => {
    const state = location.state as { files?: File[] } | null;
    return state?.files ?? [];
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [pages, setPages] = useState('');
  const [ranges, setRanges] = useState('');
  const [rotation, setRotation] = useState('90');
  const [order, setOrder] = useState('');
  const [text, setText] = useState('');
  const [insertFile, setInsertFile] = useState<File | null>(null);
  const [afterPage, setAfterPage] = useState('0');
  const [page, setPage] = useState('1');
  const [x, setX] = useState('36');
  const [y, setY] = useState('36');
  const [size, setSize] = useState('12');
  const [format, setFormat] = useState('Page {n}');
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState('24');

  const imageTools = new Set(['scan-pdf', 'jpg-to-pdf', 'png-to-pdf', 'webp-to-pdf', 'tiff-to-pdf']);
  const imageAccept: Accept = tool.slug === 'jpg-to-pdf' ? { 'image/jpeg': ['.jpg', '.jpeg'] }
    : tool.slug === 'png-to-pdf' ? { 'image/png': ['.png'] }
      : tool.slug === 'webp-to-pdf' ? { 'image/webp': ['.webp'] }
        : tool.slug === 'tiff-to-pdf' ? { 'image/tiff': ['.tif', '.tiff'] }
          : { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'] };
  const officeAccept: Accept = tool.slug === 'word-to-pdf' ? { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
    : tool.slug === 'excel-to-pdf' ? { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      : tool.slug === 'powerpoint-to-pdf' ? { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] }
        : tool.slug === 'txt-to-pdf' ? { 'text/plain': ['.txt'] }
          : tool.slug === 'markdown-to-pdf' ? { 'text/markdown': ['.md', '.markdown'] }
            : tool.slug === 'html-to-pdf' ? { 'text/html': ['.html', '.htm'] }
              : { 'application/pdf': ['.pdf'] };
  const isMultiFile = tool.slug === 'merge-pdf' || imageTools.has(tool.slug);
  const acceptedTypes = imageTools.has(tool.slug) ? imageAccept : officeAccept;
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptedTypes,
    multiple: isMultiFile,
    maxFiles: isMultiFile ? 10 : 1,
    maxSize: 25 * 1024 * 1024,
    onDrop: (acceptedFiles) => {
      setError('');
      setFiles(acceptedFiles);
    },
    onDropRejected: (rejections) => {
      setError(rejections[0]?.errors[0]?.code === 'file-too-large'
        ? 'Each file must be 25 MB or smaller.'
        : `Choose a supported file for ${tool.name}.`);
    },
  });

  const endpoint = `/api/tools/${encodeURIComponent(tool.slug)}`;
  const isAvailable = tool.status === 'available';
  const inputDescription = tool.slug === 'merge-pdf'
    ? '2–10 PDF files'
    : imageTools.has(tool.slug)
      ? 'One or more supported image files'
      : tool.slug === 'add-pdf-pages'
        ? 'Two PDF files'
        : tool.slug.endsWith('-to-pdf') && !tool.slug.startsWith('pdf-')
          ? `${tool.slug.replace('-to-pdf', '').toUpperCase()} file`
          : 'One PDF file';
  const outputDescription = tool.slug === 'split-pdf'
    ? 'ZIP archive of PDF files'
    : tool.slug === 'pdf-to-text'
      ? 'Plain text file'
      : tool.slug === 'pdf-to-markdown'
        ? 'Markdown file'
        : tool.slug === 'pdf-to-html'
          ? 'HTML file'
          : tool.slug === 'pdf-to-word'
            ? 'DOCX file'
            : tool.slug === 'pdf-to-excel'
              ? 'XLSX workbook'
              : tool.slug === 'pdf-to-powerpoint'
                ? 'PPTX presentation'
                : tool.slug === 'pdf-to-jpg' || tool.slug === 'pdf-to-png'
                  ? 'ZIP archive of page images'
                : 'PDF file';

  async function handleSubmit() {
    if (!isAvailable) {
      setError('This tool is not available yet. Try one of the available PDF actions instead.');
      setStatusMessage('');
      return;
    }

    if (tool.slug === 'merge-pdf' && files.length < 2) {
      setError('Please upload at least two PDF files to merge.');
      return;
    }

    if (files.length === 0) {
      setError('Please upload a file to process.');
      return;
    }

    setError('');
    setProcessing(true);
    setDownloadUrl(null);
    setStatusMessage('Processing your document. Larger files may take a little longer...');

    try {
      const formData = new FormData();

      if (isMultiFile) {
        files.forEach((file) => formData.append('files', file));
      } else {
        formData.append('file', files[0]);
      }
      if (insertFile) formData.append('insertFile', insertFile);
      if (pages.trim()) formData.append('pages', pages.trim());
      if (ranges.trim()) formData.append('ranges', ranges.trim());
      if (tool.slug === 'rotate-pdf') formData.append('rotation', rotation);
      if (order.trim()) formData.append('order', order.trim());
      if (text.trim()) formData.append('text', text);
      if (tool.slug === 'add-pdf-pages') formData.append('afterPage', afterPage);
      if (tool.slug === 'add-text') {
        formData.append('page', page);
        formData.append('x', x);
        formData.append('y', y);
        formData.append('size', size);
      }
      if (tool.slug === 'page-numbers') {
        formData.append('format', format);
        formData.append('position', position);
        formData.append('size', size);
      }
      if (imageTools.has(tool.slug)) {
        formData.append('orientation', orientation);
        formData.append('margin', margin);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(result?.message ?? 'The PDF operation failed.');
      }

      const result = await response.json() as { downloadUrl?: string };
      if (!result.downloadUrl) throw new Error('The operation finished without a download link.');
      setDownloadUrl(result.downloadUrl);
      setStatusMessage('Your file is ready to download.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'An unexpected error occurred.');
      setStatusMessage('');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="PaperPilot home" className="inline-flex items-center gap-3 text-slate-900">
            <ArrowLeft size={18} />
            <PaperPilotBrand />
          </Link>
        </div>
      </header>

      {tool.status === 'available' && tool.seoTitle && tool.seoDescription ? (
        <Seo title={tool.seoTitle} description={tool.seoDescription} path={`/tools/${tool.slug}`} />
      ) : (
        <Seo title="Tool not available | PaperPilot" description="This PaperPilot tool is not currently available." path={`/tools/${tool.slug}`} noindex />
      )}

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <section className="card p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary-700">{tool.category}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{tool.name}</h1>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{tool.status}</div>
          </div>

          <p className="text-base leading-7 text-slate-600">{tool.description}</p>

          {(tool.slug === 'split-pdf' || tool.slug === 'extract-pages' || tool.slug === 'remove-pages' || tool.slug === 'rotate-pdf') ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {tool.slug === 'split-pdf' ? (
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Page ranges (for example 1-3,5-6)
                  <input value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="1-3,5-6" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Leave blank to split into individual pages.</span>
                </label>
              ) : null}
              {tool.slug !== 'split-pdf' ? (
                <label className="text-sm font-medium text-slate-700">
                  Page selection (for example 1,3-5)
                  <input value={pages} onChange={(event) => setPages(event.target.value)} placeholder={tool.slug === 'rotate-pdf' ? 'All pages' : '1,3-5'} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">{tool.slug === 'rotate-pdf' ? 'Leave blank to rotate every page.' : 'Required. Page numbers start at 1.'}</span>
                </label>
              ) : null}
              {tool.slug === 'rotate-pdf' ? (
                <label className="text-sm font-medium text-slate-700">
                  Rotation
                  <select value={rotation} onChange={(event) => setRotation(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                    <option value="90">90° clockwise</option>
                    <option value="180">180°</option>
                    <option value="270">270° clockwise</option>
                    <option value="-90">90° counter-clockwise</option>
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {tool.slug === 'organize-pdf' ? (
            <label className="mt-6 block text-sm font-medium text-slate-700">
              New page order
              <input value={order} onChange={(event) => setOrder(event.target.value)} placeholder="3,1,2" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              <span className="mt-1 block text-xs font-normal text-slate-500">Enter every page number exactly once. Example: 3,1,2.</span>
            </label>
          ) : null}

          {tool.slug === 'add-pdf-pages' ? (
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Insert after page (0 inserts at the beginning)
                <input type="number" min="0" value={afterPage} onChange={(event) => setAfterPage(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                PDF to insert
                <input type="file" accept=".pdf,application/pdf" onChange={(event) => setInsertFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
              </label>
              {insertFile ? <p className="text-sm text-slate-600">Selected: {insertFile.name}</p> : null}
            </div>
          ) : null}

          {tool.slug === 'add-text' || tool.slug === 'watermark' ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                {tool.slug === 'watermark' ? 'Watermark text' : 'Text to add'}
                <input value={text} onChange={(event) => setText(event.target.value)} maxLength={tool.slug === 'watermark' ? 100 : 2000} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
              </label>
              {tool.slug === 'add-text' ? (
                <>
                  <label className="text-sm font-medium text-slate-700">Page number<input type="number" min="1" value={page} onChange={(event) => setPage(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                  <label className="text-sm font-medium text-slate-700">Font size<input type="number" min="6" max="72" value={size} onChange={(event) => setSize(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                  <label className="text-sm font-medium text-slate-700">X position<input type="number" min="0" value={x} onChange={(event) => setX(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                  <label className="text-sm font-medium text-slate-700">Y position<input type="number" min="0" value={y} onChange={(event) => setY(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                </>
              ) : null}
            </div>
          ) : null}

          {tool.slug === 'page-numbers' ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Number format<input value={format} onChange={(event) => setFormat(event.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /><span className="mt-1 block text-xs font-normal text-slate-500">Use {'{n}'} for the page number.</span></label>
              <label className="text-sm font-medium text-slate-700">Position<select value={position} onChange={(event) => setPosition(event.target.value as 'top' | 'bottom')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="bottom">Bottom</option><option value="top">Top</option></select></label>
              <label className="text-sm font-medium text-slate-700">Font size<input type="number" min="6" max="36" value={size} onChange={(event) => setSize(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            </div>
          ) : null}

          {imageTools.has(tool.slug) ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Page orientation<select value={orientation} onChange={(event) => setOrientation(event.target.value as 'portrait' | 'landscape')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
              <label className="text-sm font-medium text-slate-700">Margins (points)<input type="number" min="0" max="144" value={margin} onChange={(event) => setMargin(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            </div>
          ) : null}

          {['word-to-pdf', 'excel-to-pdf', 'powerpoint-to-pdf'].includes(tool.slug) ? (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This conversion requires LibreOffice on the server. Complex layouts may not be preserved exactly.</p>
          ) : null}
          {tool.slug === 'html-to-pdf' ? (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Only restricted HTML is accepted. Scripts and external resources are rejected; output contains extracted text rather than browser-rendered layout.</p>
          ) : null}
          {['ocr-pdf', 'pdf-to-jpg', 'pdf-to-png'].includes(tool.slug) ? (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This operation requires Poppler on the server{tool.slug === 'ocr-pdf' ? ' plus Tesseract and its English language data' : ''}. OCR is limited to five pages per request; image export is limited to 50 pages.</p>
          ) : null}

          <div
            {...getRootProps()}
            className={`mt-8 rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-300 bg-slate-50'}`}
          >
            <input {...getInputProps()} />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-primary-700 shadow-sm">
              <UploadCloud size={28} />
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-800">{isDragActive ? 'Drop the file here' : 'Drag and drop your files here'}</p>
            <p className="mt-2 text-sm text-slate-500">or click to browse from your device</p>
          </div>

          <div className="mt-6 space-y-3">
            {files.length > 0 ? (
              files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="file-row flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <div className="file-icon rounded-lg bg-primary-50 p-2 text-primary-700">
                      <FileText size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{file.name}</div>
                      <div className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isMultiFile ? (
                      <>
                        <button type="button" aria-label={`Move ${file.name} up`} disabled={index === 0} onClick={() => setFiles((current) => {
                          const next = [...current];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        })} className="file-order-button text-sm font-medium text-slate-500 disabled:opacity-40">↑</button>
                        <button type="button" aria-label={`Move ${file.name} down`} disabled={index === files.length - 1} onClick={() => setFiles((current) => {
                          const next = [...current];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return next;
                        })} className="file-order-button text-sm font-medium text-slate-500 disabled:opacity-40">↓</button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                      className="file-remove-button inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rose-700"
                    >
                      Remove <Sparkles className="remove-sparkle" size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No files selected yet.</div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={processing}
              className="action-sparkle inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? <Loader2 className="animate-spin" size={18} /> : null}
              {processing ? 'Processing...' : 'Start processing'}
            </button>
            {downloadUrl ? (
              <a href={downloadUrl} className="sparkle-download inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white">
                <Download size={18} /> Download result <Sparkles className="sparkle-icon" size={16} aria-hidden="true" />
              </a>
            ) : null}
          </div>

          {statusMessage ? (
            <div role="status" aria-live="polite" className={`mt-5 flex items-center gap-3 rounded-2xl p-4 ${downloadUrl ? 'success-glow border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-primary-100 bg-primary-50 text-primary-800'}`}>
              {downloadUrl ? <CheckCircle2 className="shrink-0 text-emerald-600" size={20} aria-hidden="true" /> : <Loader2 className="shrink-0 animate-spin" size={20} aria-hidden="true" />}
              <span className="font-medium">{statusMessage}</span>
              {downloadUrl ? <Sparkles className="success-sparkle ml-auto shrink-0 text-amber-500" size={18} aria-hidden="true" /> : null}
            </div>
          ) : null}
          {error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-bold text-slate-900">Tool details</h2>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li>• Supported input: {inputDescription}</li>
              <li>• Output: {outputDescription}</li>
              <li>• Status: {isAvailable ? 'Ready to use' : 'Not available yet'}</li>
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-bold text-slate-900">Related tools</h2>
            <div className="mt-4 space-y-3">
              {tools.filter((item) => item.status === 'available' && item.category === tool.category && item.slug !== tool.slug).slice(0, 4).map((item) => (
                <Link key={item.slug} to={`/tools/${item.slug}`} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700">
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <AdSlot slot={import.meta.env.VITE_ADSENSE_SIDEBAR_SLOT} />
        </aside>
      </main>
      <AdSlot slot={import.meta.env.VITE_ADSENSE_TOOL_BOTTOM_SLOT} />
    </div>
  );
}
