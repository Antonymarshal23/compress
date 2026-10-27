import { Router, type Request } from 'express';
import type { Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { createDownloadJob, readDownloadJob } from '../services/download-jobs.js';
import {
  addPageNumbers,
  addPdfPages,
  addText,
  addWatermark,
  compressPdfBuffer,
  extractPdfPages,
  getPdfPageCount,
  flattenPdf,
  imagesToPdf,
  mergePdfBuffers,
  organizePdf,
  ocrPdf,
  parsePages,
  parseRanges,
  removeMetadata,
  removePdfPages,
  renderPdfPages,
  rotatePdfPages,
  splitPdfBuffer,
} from '../services/pdf-tools.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { convertOfficeToPdf, htmlToPdf, inspectOfficeArchive, pdfToOffice, textToPdf } from '../services/document-converters.js';

const maxBytes = Number(process.env.UPLOAD_LIMIT_MB ?? 25) * 1024 * 1024;
const maxTotalUploadBytes = Number(process.env.MAX_TOTAL_UPLOAD_MB ?? 50) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 10, fields: 20, fieldSize: 16_384 },
});
const router = Router();
const concurrentLimit = Number(process.env.MAX_CONCURRENT_JOBS ?? 2);
const perIpConcurrentLimit = Number(process.env.MAX_CONCURRENT_JOBS_PER_IP ?? 1);
let activeProcessing = 0;
const activeByIp = new Map<string, number>();
const releaseSlots = new WeakMap<Response, () => void>();

const pdfTools = new Set([
  'merge-pdf', 'split-pdf', 'extract-pages', 'remove-pages', 'rotate-pdf',
  'organize-pdf', 'add-pdf-pages', 'compress-pdf', 'flatten-pdf',
  'remove-metadata', 'add-text', 'page-numbers', 'watermark',
]);
const imageTools = new Set(['scan-pdf', 'scan-to-pdf', 'jpg-to-pdf', 'png-to-pdf', 'webp-to-pdf', 'tiff-to-pdf']);
const fileToPdfTools = new Set(['word-to-pdf', 'excel-to-pdf', 'powerpoint-to-pdf', 'txt-to-pdf', 'markdown-to-pdf', 'html-to-pdf']);
const pdfExportTools = new Set(['pdf-to-text', 'pdf-to-markdown', 'pdf-to-html', 'pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint', 'pdf-to-jpg', 'pdf-to-png']);
const optionalPdfTools = new Set(['ocr-pdf']);
const acceptedTools = new Set([...pdfTools, ...imageTools, ...fileToPdfTools, ...pdfExportTools, ...optionalPdfTools]);
const formFieldsSchema = z.record(z.string(), z.string().max(16_384));

function parsePositivePageList(value: unknown, pageCount: number) {
  return parsePages(value, pageCount);
}

async function processTool(req: Request) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const toolParam = req.params.toolId;
  const toolId = Array.isArray(toolParam) ? toolParam[0] : toolParam;
  if (!toolId) throw new AppError('A tool identifier is required.', 404);
  const parsedBody = formFieldsSchema.safeParse(req.body);
  if (!parsedBody.success) throw new AppError('One or more form fields are invalid or too long.', 400);
  const body: Record<string, string | undefined> = parsedBody.data;
  const primary = files.find((file) => file.fieldname === 'file');
  const secondary = files.find((file) => file.fieldname === 'insertFile');
  const list = files.filter((file) => file.fieldname === 'files');
  if (files.reduce((total, file) => total + file.size, 0) > maxTotalUploadBytes) {
    throw new AppError('The combined upload exceeds the configured total size limit.', 413);
  }
  const allowedFields = toolId === 'merge-pdf'
    ? new Set(['files'])
    : imageTools.has(toolId)
      ? new Set(['files', 'file'])
    : toolId === 'add-pdf-pages'
      ? new Set(['file', 'insertFile'])
      : new Set(['file']);
  if (files.some((file) => !allowedFields.has(file.fieldname))) {
    throw new AppError('The upload contains an unexpected file field.', 400);
  }
  if (files.filter((file) => file.fieldname === 'file').length > 1 || files.filter((file) => file.fieldname === 'insertFile').length > 1) {
    throw new AppError('Upload only the expected number of files for this tool.', 400);
  }
  if (imageTools.has(toolId) && primary && list.length) {
    throw new AppError('Upload images using either one file or the multiple-file field, not both.', 400);
  }

  if (fileToPdfTools.has(toolId)) {
    if (!primary) throw new AppError('Upload a file to convert.', 400);
    let output: Buffer;
    let extension: 'docx' | 'xlsx' | 'pptx' | undefined;
    if (toolId === 'word-to-pdf') extension = 'docx';
    if (toolId === 'excel-to-pdf') extension = 'xlsx';
    if (toolId === 'powerpoint-to-pdf') extension = 'pptx';
    if (extension) {
      await inspectOfficeArchive(primary.buffer, extension);
      output = await convertOfficeToPdf(primary.buffer, extension);
    } else {
      if (primary.buffer.includes(0)) throw new AppError('The uploaded text document is not valid UTF-8 text.', 415);
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(primary.buffer);
      } catch {
        throw new AppError('The uploaded text document is not valid UTF-8 text.', 415);
      }
      output = toolId === 'html-to-pdf' ? await htmlToPdf(text) : await textToPdf(text);
    }
    return { output, filename: `${toolId.replace('-to-pdf', '')}.pdf`, mimeType: 'application/pdf' };
  }

  if (pdfExportTools.has(toolId)) {
    if (!primary || !primary.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new AppError('Upload a valid PDF file to continue.', 415);
    }
    if (toolId === 'pdf-to-jpg' || toolId === 'pdf-to-png') {
      const format = toolId === 'pdf-to-jpg' ? 'jpg' : 'png';
      return {
        output: await renderPdfPages(primary.buffer, format),
        filename: `pages-${format}.zip`,
        mimeType: 'application/zip',
      };
    }
    const { extractPdfText } = await import('../services/pdf-tools.js');
    const text = await extractPdfText(primary.buffer);
    if (toolId === 'pdf-to-text') return { output: text, filename: 'extracted.txt', mimeType: 'text/plain; charset=utf-8' };
    if (toolId === 'pdf-to-markdown') return { output: Buffer.from(`# Extracted PDF text\n\n${text.toString('utf8')}`, 'utf8'), filename: 'extracted.md', mimeType: 'text/markdown; charset=utf-8' };
    if (toolId === 'pdf-to-html') {
      const escaped = text.toString('utf8').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      return { output: Buffer.from(`<!doctype html><html lang="en"><meta charset="utf-8"><title>PDF text</title><pre>${escaped}</pre></html>`, 'utf8'), filename: 'extracted.html', mimeType: 'text/html; charset=utf-8' };
    }
    const format = toolId === 'pdf-to-word' ? 'docx' : toolId === 'pdf-to-excel' ? 'xlsx' : 'pptx';
    const output = await pdfToOffice(primary.buffer, format);
    const mimeType = format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return { output, filename: `converted.${format}`, mimeType };
  }

  if (optionalPdfTools.has(toolId)) {
    if (!primary || !primary.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new AppError('Upload a valid PDF file to continue.', 415);
    }
    return { output: await ocrPdf(primary.buffer), filename: 'searchable.pdf', mimeType: 'application/pdf' };
  }

  if (imageTools.has(toolId)) {
    const images = list.length ? list : primary ? [primary] : [];
    if (!images.length) throw new AppError('Upload at least one image.', 400);
    for (const image of images) {
      if (image.size > maxBytes) throw new AppError('An image exceeds the configured file-size limit.', 413);
    }
    if (body.orientation && !['portrait', 'landscape'].includes(body.orientation)) {
      throw new AppError('Orientation must be portrait or landscape.', 400);
    }
    const orientation = body.orientation === 'landscape' ? 'landscape' : 'portrait';
    const margin = Number(body.margin ?? 24);
    if (!Number.isFinite(margin) || margin < 0 || margin > 144) throw new AppError('Margins must be between 0 and 144 points.', 400);
    const expectedFormat = toolId === 'jpg-to-pdf' ? 'jpeg'
      : toolId === 'png-to-pdf' ? 'png'
        : toolId === 'webp-to-pdf' ? 'webp'
          : toolId === 'tiff-to-pdf' ? 'tiff'
            : undefined;
    const output = await imagesToPdf(images.map((item) => item.buffer), orientation, margin, expectedFormat);
    return { output, filename: 'images.pdf', mimeType: 'application/pdf' };
  }

  if (!acceptedTools.has(toolId)) throw new AppError('This tool is not available.', 404);
  const pdfFiles = toolId === 'merge-pdf' ? list : primary ? [primary] : [];
  if (toolId === 'merge-pdf') {
    if (pdfFiles.length < 2 || pdfFiles.length > 10) throw new AppError('Upload between 2 and 10 PDF files to merge.', 400);
  } else if (!primary) {
    throw new AppError('Upload a PDF file to continue.', 400);
  }

  for (const file of [...pdfFiles, ...(primary && toolId !== 'merge-pdf' ? [primary] : []), ...(secondary ? [secondary] : [])]) {
    if (!file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new AppError('The uploaded file is not a valid PDF.', 415);
    }
  }

  const data = primary?.buffer;
  let output: Buffer;
  let filename = `${toolId}.pdf`;
  let mimeType = 'application/pdf';
  switch (toolId) {
    case 'merge-pdf':
      output = await mergePdfBuffers(pdfFiles.map((file) => file.buffer));
      filename = 'merged.pdf';
      break;
    case 'split-pdf': {
      const pageCount = await getPdfPageCount(data!);
      const ranges = body.ranges
        ? await parseRanges(body.ranges, pageCount)
        : body.pages
          ? (await parsePositivePageList(body.pages, pageCount)).map((page) => ({ start: page, end: page }))
          : Array.from({ length: pageCount }, (_, index) => ({ start: index + 1, end: index + 1 }));
      output = await splitPdfBuffer(data!, ranges);
      mimeType = 'application/zip';
      filename = 'split-pages.zip';
      break;
    }
    case 'extract-pages': {
      const pageCount = await getPdfPageCount(data!);
      const pages = await parsePositivePageList(body.pages, pageCount);
      output = await extractPdfPages(data!, pages);
      filename = 'extracted-pages.pdf';
      break;
    }
    case 'remove-pages': {
      const pageCount = await getPdfPageCount(data!);
      const pages = await parsePositivePageList(body.pages, pageCount);
      output = await removePdfPages(data!, pages);
      filename = 'pages-removed.pdf';
      break;
    }
    case 'rotate-pdf': {
      const pageCount = await getPdfPageCount(data!);
      const pages = body.pages ? await parsePositivePageList(body.pages, pageCount) : undefined;
      const rotation = Number(body.rotation ?? 90);
      output = await rotatePdfPages(data!, rotation, pages);
      filename = 'rotated.pdf';
      break;
    }
    case 'organize-pdf': {
      const order = (body.order ?? '').split(',').map((page) => Number(page.trim()));
      output = await organizePdf(data!, order);
      filename = 'organized.pdf';
      break;
    }
    case 'add-pdf-pages': {
      if (!secondary) throw new AppError('Upload the PDF containing pages to insert.', 400);
      output = await addPdfPages(data!, secondary.buffer, Number(body.afterPage ?? 0));
      filename = 'pages-added.pdf';
      break;
    }
    case 'compress-pdf':
      output = await compressPdfBuffer(data!);
      filename = 'optimized.pdf';
      break;
    case 'flatten-pdf':
      output = await flattenPdf(data!);
      filename = 'flattened.pdf';
      break;
    case 'remove-metadata':
      output = await removeMetadata(data!);
      filename = 'metadata-removed.pdf';
      break;
    case 'add-text':
      output = await addText(data!, body.text ?? '', Number(body.page ?? 1), Number(body.x ?? 36), Number(body.y ?? 36), Number(body.size ?? 12));
      filename = 'edited.pdf';
      break;
    case 'page-numbers':
      if (body.position && !['top', 'bottom'].includes(body.position)) throw new AppError('Position must be top or bottom.', 400);
      output = await addPageNumbers(data!, body.format ?? 'Page {n}', body.position === 'top' ? 'top' : 'bottom', Number(body.size ?? 10));
      filename = 'numbered.pdf';
      break;
    case 'watermark':
      output = await addWatermark(data!, body.text ?? '');
      filename = 'watermarked.pdf';
      break;
    default:
      throw new AppError('This tool is not available.', 404);
  }

  return { output, filename, mimeType };
}

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'PaperPilot API healthy', timestamp: new Date().toISOString() });
});
router.get('/health/live', (_req, res) => res.json({ status: 'live' }));
router.get('/health/ready', (_req, res) => res.json({ status: 'ready' }));

function reserveProcessingSlot(req: Request, res: Response, next: NextFunction) {
  const toolParam = req.params.toolId;
  const toolId = Array.isArray(toolParam) ? toolParam[0] : toolParam;
  if (!toolId) return next(new AppError('A tool identifier is required.', 404));
  if (!acceptedTools.has(toolId)) return next(new AppError('This tool is not available.', 404));
  const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const clientActive = activeByIp.get(clientIp) ?? 0;
  if (activeProcessing >= concurrentLimit || clientActive >= perIpConcurrentLimit) {
    return next(new AppError('The service is busy. Please try again shortly.', 503));
  }
  activeProcessing += 1;
  activeByIp.set(clientIp, clientActive + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeProcessing -= 1;
    if (clientActive) activeByIp.set(clientIp, clientActive);
    else activeByIp.delete(clientIp);
  };
  releaseSlots.set(res, release);
  res.once('finish', release);
  res.once('close', release);
  next();
}

function enforceRequestSize(req: Request, _res: Response, next: NextFunction) {
  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > maxTotalUploadBytes + 1_048_576) {
    next(new AppError('The combined upload exceeds the configured total size limit.', 413));
    return;
  }
  next();
}

router.post('/tools/:toolId', reserveProcessingSlot, enforceRequestSize, upload.any(), async (req, res, next) => {
  const toolParam = req.params.toolId;
  const toolId = Array.isArray(toolParam) ? toolParam[0] : toolParam;
  if (!toolId) return next(new AppError('A tool identifier is required.', 404));
  const startedAt = Date.now();
  try {
    const result = await processTool(req);
    if (result.output.length > maxBytes * 2) {
      throw new AppError('The processed output exceeds the configured size limit.', 413);
    }
    if (result.mimeType === 'application/pdf' && !result.output.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new AppError('The processing engine returned an invalid PDF.', 500);
    }
    const job = await createDownloadJob(result.output, result.filename, result.mimeType);
    logger.info({ operation: toolId, durationMs: Date.now() - startedAt, success: true }, 'PDF operation completed');
    res.status(202).json({ success: true, ...job });
  } catch (error) {
    logger.warn({ operation: toolId, durationMs: Date.now() - startedAt, success: false, errorName: error instanceof Error ? error.name : 'UnknownError' }, 'PDF operation failed');
    next(error);
  } finally {
    releaseSlots.get(res)?.();
  }
});

router.get('/download/:jobId/:token', async (req, res, next) => {
  try {
    const download = await readDownloadJob(req.params.jobId, req.params.token);
    res.setHeader('Content-Type', download.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(download.bytes);
  } catch (error) {
    next(error);
  }
});

export default router;
