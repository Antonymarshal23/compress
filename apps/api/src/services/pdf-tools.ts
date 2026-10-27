import { PDFDict, PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
import sharp from 'sharp';
import JSZip from 'jszip';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { AppError } from '../utils/errors.js';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type PageRange = { start: number; end: number };
const maxPageCount = Number(process.env.MAX_PDF_PAGES ?? 500);

function runExternal(binary: string, args: string[], timeoutMs: number, dependencyMessage: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: os.tmpdir(),
        TMPDIR: os.tmpdir(),
        TMP: os.tmpdir(),
        TEMP: os.tmpdir(),
      },
    });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new AppError('Document processing timed out. Try a smaller file.', 504));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timeout);
      if ('code' in error && error.code === 'ENOENT') reject(new AppError(dependencyMessage, 503));
      else reject(new AppError('The local processing engine could not start.', 503));
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new AppError('The local processing engine could not process this document.', 422));
    });
  });
}

async function loadPdf(data: Uint8Array) {
  try {
    const document = await PDFDocument.load(data, { updateMetadata: false });
    if (document.getPageCount() > maxPageCount) {
      throw new AppError(`This PDF exceeds the ${maxPageCount}-page processing limit.`, 413);
    }
    return document;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : '';
    if (/encrypt|password/i.test(message)) {
      throw new AppError('This PDF is encrypted. Provide an authorized password or unlock it first.', 422);
    }
    throw new AppError('The uploaded file is not a readable PDF. It may be damaged or unsupported.', 422);
  }
}

function validatePages(pages: number[], total: number) {
  if (!pages.length || pages.some((page) => !Number.isInteger(page) || page < 1 || page > total)) {
    throw new AppError(`Select page numbers between 1 and ${total}.`, 400);
  }
  if (new Set(pages).size !== pages.length) {
    throw new AppError('Page selections must not contain duplicates.', 400);
  }
}

function parsePageList(value: unknown, total: number) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('Enter page numbers, for example 1,3-5.', 400);
  }
  const pages: number[] = [];
  for (const part of value.split(',')) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim());
    if (!match) throw new AppError('Page selection format is invalid. Use values such as 1,3-5.', 400);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start > end || end > total) throw new AppError(`Page ranges must be within 1-${total}.`, 400);
    for (let page = start; page <= end; page += 1) pages.push(page);
  }
  validatePages(pages, total);
  return pages;
}

export async function mergePdfBuffers(files: Uint8Array[]) {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const source = await loadPdf(file);
    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }
  return Buffer.from(await merged.save({ useObjectStreams: true }));
}

export async function splitPdfBuffer(data: Uint8Array, ranges: PageRange[]) {
  const source = await loadPdf(data);
  if (!ranges.length) throw new AppError('Add at least one page range to split.', 400);
  const zip = new JSZip();
  for (const [index, range] of ranges.entries()) {
    const pages = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
    validatePages(pages, source.getPageCount());
    const output = await PDFDocument.create();
    const copied = await output.copyPages(source, pages.map((page) => page - 1));
    copied.forEach((page) => output.addPage(page));
    zip.file(`part-${index + 1}-pages-${range.start}-${range.end}.pdf`, await output.save());
    if (index > 100) throw new AppError('A maximum of 100 ranges can be split at once.', 400);
  }
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

export async function extractPdfPages(data: Uint8Array, pageNumbers: number[]) {
  const source = await loadPdf(data);
  validatePages(pageNumbers, source.getPageCount());
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, pageNumbers.map((page) => page - 1));
  copied.forEach((page) => output.addPage(page));
  return Buffer.from(await output.save({ useObjectStreams: true }));
}

export async function removePdfPages(data: Uint8Array, pageNumbers: number[]) {
  const source = await loadPdf(data);
  validatePages(pageNumbers, source.getPageCount());
  if (pageNumbers.length === source.getPageCount()) {
    throw new AppError('A PDF must contain at least one page after removal.', 400);
  }
  const output = await PDFDocument.create();
  const keep = source.getPageIndices().filter((index) => !pageNumbers.includes(index + 1));
  const copied = await output.copyPages(source, keep);
  copied.forEach((page) => output.addPage(page));
  return Buffer.from(await output.save({ useObjectStreams: true }));
}

export async function rotatePdfPages(data: Uint8Array, rotation: number, pageNumbers?: number[]) {
  const source = await loadPdf(data);
  if (![90, 180, 270, -90, -180, -270].includes(rotation)) {
    throw new AppError('Rotation must be 90, 180, or 270 degrees clockwise or counter-clockwise.', 400);
  }
  if (pageNumbers) validatePages(pageNumbers, source.getPageCount());
  source.getPages().forEach((page, index) => {
    if (!pageNumbers || pageNumbers.includes(index + 1)) {
      page.setRotation(degrees((page.getRotation().angle + rotation + 360) % 360));
    }
  });
  return Buffer.from(await source.save({ useObjectStreams: true }));
}

export async function organizePdf(data: Uint8Array, order: number[]) {
  const source = await loadPdf(data);
  if (order.length !== source.getPageCount()) {
    throw new AppError('The page order must include every page exactly once.', 400);
  }
  validatePages(order, source.getPageCount());
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, order.map((page) => page - 1));
  copied.forEach((page) => output.addPage(page));
  return Buffer.from(await output.save({ useObjectStreams: true }));
}

export async function addPdfPages(sourceData: Uint8Array, insertData: Uint8Array, afterPage: number) {
  const source = await loadPdf(sourceData);
  const insert = await loadPdf(insertData);
  if (!Number.isInteger(afterPage) || afterPage < 0 || afterPage > source.getPageCount()) {
    throw new AppError(`Insert position must be between 0 and ${source.getPageCount()}.`, 400);
  }
  const output = await PDFDocument.create();
  const front = await output.copyPages(source, source.getPageIndices().slice(0, afterPage));
  const middle = await output.copyPages(insert, insert.getPageIndices());
  const back = await output.copyPages(source, source.getPageIndices().slice(afterPage));
  [...front, ...middle, ...back].forEach((page) => output.addPage(page));
  return Buffer.from(await output.save({ useObjectStreams: true }));
}

export async function imagesToPdf(
  images: Uint8Array[],
  orientation: 'portrait' | 'landscape' = 'portrait',
  margin = 24,
  expectedFormat?: 'jpeg' | 'png' | 'webp' | 'tiff',
) {
  const output = await PDFDocument.create();
  const safeMargin = Math.min(Math.max(margin, 0), 144);
  for (const image of images) {
    let normalized: Buffer;
    let inputFormat: string | undefined;
    try {
      const pipeline = sharp(image, { limitInputPixels: 40_000_000 });
      const metadata = await pipeline.metadata();
      inputFormat = metadata.format;
      if (expectedFormat && inputFormat !== expectedFormat) {
        throw new AppError(`This tool accepts ${expectedFormat.toUpperCase()} image files only.`, 415);
      }
      if (inputFormat === 'jpeg') normalized = await pipeline.jpeg().toBuffer();
      else normalized = await pipeline.png().toBuffer();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('One of the images is invalid or uses an unsupported format.', 422);
    }
    const embedded = inputFormat === 'jpeg' ? await output.embedJpg(normalized) : await output.embedPng(normalized);
    const sourceWidth = embedded.width;
    const sourceHeight = embedded.height;
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const pageHeight = orientation === 'landscape' ? 612 : 792;
    const scale = Math.min((pageWidth - safeMargin * 2) / sourceWidth, (pageHeight - safeMargin * 2) / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const page = output.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
  }
  if (!images.length) throw new AppError('Upload at least one image.', 400);
  return Buffer.from(await output.save({ useObjectStreams: true }));
}

export async function flattenPdf(data: Uint8Array) {
  const pdf = await loadPdf(data);
  try {
    if (pdf.getForm().getFields().length) pdf.getForm().flatten();
  } catch {
    throw new AppError('This PDF contains form fields that cannot be flattened safely.', 422);
  }
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

export async function removeMetadata(data: Uint8Array) {
  const pdf = await loadPdf(data);
  const infoReference = pdf.context.trailerInfo.Info;
  if (infoReference) {
    const info = pdf.context.lookupMaybe(infoReference, PDFDict);
    if (info) {
      for (const key of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped']) {
        info.delete(PDFName.of(key));
      }
    }
  }
  pdf.catalog.delete(PDFName.of('Metadata'));
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

export async function addText(data: Uint8Array, text: string, pageNumber: number, x: number, y: number, size: number) {
  const pdf = await loadPdf(data);
  validatePages([pageNumber], pdf.getPageCount());
  if (!text.trim() || text.length > 2000) throw new AppError('Text must contain 1-2000 characters.', 400);
  if (![x, y, size].every(Number.isFinite)) throw new AppError('Text position and size must be valid numbers.', 400);
  const page = pdf.getPage(pageNumber - 1);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: Math.max(0, Math.min(x, page.getWidth() - 12)), y: Math.max(0, Math.min(y, page.getHeight() - 12)), size: Math.max(6, Math.min(size, 72)), font, color: rgb(0.08, 0.12, 0.25), maxWidth: page.getWidth() - 24 });
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

export async function addPageNumbers(data: Uint8Array, format = 'Page {n}', position: 'bottom' | 'top' = 'bottom', size = 10) {
  const pdf = await loadPdf(data);
  if (!Number.isFinite(size)) throw new AppError('Font size must be a valid number.', 400);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.getPages().forEach((page, index) => {
    const label = format.replaceAll('{n}', String(index + 1)).slice(0, 80);
    const y = position === 'top' ? page.getHeight() - 24 : 16;
    page.drawText(label, { x: 24, y, size: Math.max(6, Math.min(size, 36)), font, color: rgb(0.2, 0.2, 0.2) });
  });
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

export async function addWatermark(data: Uint8Array, text: string) {
  const pdf = await loadPdf(data);
  if (!text.trim() || text.length > 100) throw new AppError('Watermark text must contain 1-100 characters.', 400);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.getPages().forEach((page) => {
    page.drawText(text, { x: page.getWidth() * 0.15, y: page.getHeight() * 0.5, size: 32, font, color: rgb(0.55, 0.58, 0.65), opacity: 0.35, rotate: degrees(35) });
  });
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

export async function compressPdfBuffer(data: Uint8Array) {
  const pdf = await loadPdf(data);
  const output = Buffer.from(await pdf.save({ useObjectStreams: true, objectsPerTick: 50 }));
  if (output.length > data.length * 1.05) {
    throw new AppError('This PDF cannot be reduced with the available lossless optimizer; no larger replacement was produced.', 422);
  }
  return output;
}

export async function extractPdfText(data: Uint8Array) {
  await loadPdf(data);
  let document;
  try {
    document = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
  } catch {
    throw new AppError('Text could not be extracted. The PDF may be encrypted, damaged, or image-only.', 422);
  }
  const texts: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  await document.destroy();
  const text = texts.join('\n\n').trim();
  if (!text) throw new AppError('No embedded text was found. This may be a scanned PDF; OCR is required.', 422);
  return Buffer.from(text, 'utf8');
}

export async function parsePages(value: unknown, pageCount: number) {
  return parsePageList(value, pageCount);
}

export async function parseRanges(value: unknown, pageCount: number): Promise<PageRange[]> {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('Enter page ranges separated by commas, for example 1-3,5-6.', 400);
  }
  const ranges = value.split(',').map((part) => {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim());
    if (!match) throw new AppError('Range format is invalid. Use values such as 1-3,5-6.', 400);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start > end || start < 1 || end > pageCount) {
      throw new AppError(`Page ranges must be within 1-${pageCount}.`, 400);
    }
    return { start, end };
  });
  if (ranges.length > 100) throw new AppError('A maximum of 100 page ranges can be split at once.', 400);
  return ranges;
}

export async function getPdfPageCount(data: Uint8Array) {
  return (await loadPdf(data)).getPageCount();
}

export async function renderPdfPages(data: Uint8Array, format: 'jpg' | 'png') {
  const pageCount = await getPdfPageCount(data);
  if (pageCount > 50) throw new AppError('Image export is limited to 50 pages per request.', 413);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'paperpilot-render-'));
  const inputPath = path.join(directory, 'source.pdf');
  const outputPrefix = path.join(directory, 'page');
  const binary = process.env.PDFTOPPM_BIN ?? (process.platform === 'win32' ? 'pdftoppm.exe' : 'pdftoppm');
  try {
    await writeFile(inputPath, data, { flag: 'wx', mode: 0o600 });
    const formatArgs = format === 'jpg' ? ['-jpeg'] : ['-png'];
    await runExternal(binary, [...formatArgs, '-scale-to', '2048', '-f', '1', '-l', String(pageCount), inputPath, outputPrefix], 60_000, 'Poppler pdftoppm is not installed. Install poppler-utils to export PDF pages as images.');
    const extension = format === 'jpg' ? '.jpg' : '.png';
    const outputs = (await readdir(directory)).filter((name) => name.startsWith('page-') && name.endsWith(extension)).sort((left, right) => {
      const leftPage = Number(left.slice(5, -extension.length));
      const rightPage = Number(right.slice(5, -extension.length));
      return leftPage - rightPage;
    });
    if (outputs.length !== pageCount) throw new AppError('The PDF renderer did not produce every expected page image.', 500);
    const archive = new JSZip();
    for (const [index, name] of outputs.entries()) archive.file(`page-${index + 1}.${format}`, await readFile(path.join(directory, name)));
    return Buffer.from(await archive.generateAsync({ type: 'nodebuffer' }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function ocrPdf(data: Uint8Array) {
  const pageCount = await getPdfPageCount(data);
  if (pageCount > 5) throw new AppError('Synchronous OCR is limited to 5 pages per request.', 413);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'paperpilot-ocr-'));
  const inputPath = path.join(directory, 'source.pdf');
  const imagePrefix = path.join(directory, 'page');
  const poppler = process.env.PDFTOPPM_BIN ?? (process.platform === 'win32' ? 'pdftoppm.exe' : 'pdftoppm');
  const tesseract = process.env.TESSERACT_BIN ?? (process.platform === 'win32' ? 'tesseract.exe' : 'tesseract');
  try {
    await writeFile(inputPath, data, { flag: 'wx', mode: 0o600 });
    await runExternal(poppler, ['-png', '-scale-to', '2048', '-f', '1', '-l', String(pageCount), inputPath, imagePrefix], 60_000, 'Poppler pdftoppm is not installed. Install poppler-utils to enable OCR.');
    const images = (await readdir(directory)).filter((name) => name.startsWith('page-') && name.endsWith('.png')).sort((left, right) => Number(left.slice(5, -4)) - Number(right.slice(5, -4)));
    if (images.length !== pageCount) throw new AppError('The PDF renderer did not produce every page image for OCR.', 500);
    const result = await PDFDocument.create();
    for (const imageName of images) {
      const inputImage = path.join(directory, imageName);
      const outputPrefix = path.join(directory, `ocr-${path.basename(imageName, '.png')}`);
      await runExternal(tesseract, [inputImage, outputPrefix, 'pdf', '-l', 'eng'], 20_000, 'Tesseract OCR is not installed. Install tesseract-ocr and the English language pack to enable OCR.');
      const ocrPdf = await PDFDocument.load(await readFile(`${outputPrefix}.pdf`));
      const copied = await result.copyPages(ocrPdf, ocrPdf.getPageIndices());
      copied.forEach((page) => result.addPage(page));
    }
    if (result.getPageCount() !== pageCount) throw new AppError('OCR did not produce the expected page count.', 500);
    return Buffer.from(await result.save({ useObjectStreams: true }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
