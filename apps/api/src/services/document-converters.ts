import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { extractPdfText } from './pdf-tools.js';
import { AppError } from '../utils/errors.js';

function wrapText(text: string, maxChars = 95) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line && `${line} ${word}`.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function textToPdf(text: string) {
  if (!text.trim() || text.length > 1_000_000) throw new AppError('Text must contain 1 to 1,000,000 characters.', 400);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([612, 792]);
  let y = 756;
  for (const line of wrapText(text)) {
    if (y < 36) {
      page = pdf.addPage([612, 792]);
      y = 756;
    }
    page.drawText(line.slice(0, 160), { x: 36, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  }
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

export async function htmlToPdf(html: string) {
  if (!html.trim() || html.length > 1_000_000) throw new AppError('HTML must contain 1 to 1,000,000 characters.', 400);
  if (/<(?:script|iframe|object|embed|link|style)\b|\b(?:src|href)\s*=\s*["']\s*(?:https?:|file:|\/\/)/i.test(html)) {
    throw new AppError('HTML containing scripts, embedded resources, or external URLs is not accepted.', 400);
  }
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return textToPdf(text);
}

export async function pdfToOffice(data: Uint8Array, format: 'docx' | 'xlsx' | 'pptx') {
  const text = (await extractPdfText(data)).toString('utf8');
  if (format === 'docx') {
    const paragraphs = text.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line)] }));
    return Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children: paragraphs }] })));
  }
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Extracted text');
    for (const line of text.split(/\r?\n/)) {
      sheet.addRow(line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/));
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  const PptxGenJS = createRequire(import.meta.url)('pptxgenjs') as new () => {
    layout: string;
    addSlide: () => {
      addText: (text: string, options: Record<string, unknown>) => void;
    };
    write: (options: { outputType: 'nodebuffer' }) => Promise<Buffer>;
  };
  const presentation = new PptxGenJS();
  presentation.layout = 'LAYOUT_WIDE';
  const pageText = text.split(/\n{2,}/);
  for (const content of pageText.length ? pageText : ['']) {
    const slide = presentation.addSlide();
    slide.addText(content.slice(0, 5000), { x: 0.5, y: 0.5, w: 12.2, h: 6.4, fontSize: 14, breakLine: false, valign: 'top', fit: 'shrink' });
  }
  return Buffer.from(await presentation.write({ outputType: 'nodebuffer' }) as Uint8Array);
}

export async function convertOfficeToPdf(file: Uint8Array, extension: 'docx' | 'xlsx' | 'pptx') {
  const binary = process.env.LIBREOFFICE_BIN ?? (process.platform === 'win32' ? 'soffice.exe' : 'soffice');
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'paperpilot-convert-'));
  const inputPath = path.join(tempRoot, `${randomUUID()}.${extension}`);
  const outputPath = path.join(tempRoot, `${path.basename(inputPath, `.${extension}`)}.pdf`);
  try {
    await writeFile(inputPath, file, { flag: 'wx', mode: 0o600 });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(binary, ['--headless', '--nologo', '--nodefault', '--nolockcheck', '--convert-to', 'pdf', '--outdir', tempRoot, inputPath], {
        stdio: 'ignore',
        windowsHide: true,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: tempRoot,
          TMPDIR: tempRoot,
          TMP: tempRoot,
          TEMP: tempRoot,
          SAL_USE_VCLPLUGIN: 'svp',
        },
      });
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new AppError('Document conversion timed out. Try a smaller file.', 504));
      }, Number(process.env.CONVERSION_TIMEOUT_MS ?? 60_000));
      child.once('error', (error) => {
        clearTimeout(timeout);
        if ('code' in error && error.code === 'ENOENT') {
          reject(new AppError('LibreOffice is not installed. Install LibreOffice and configure LIBREOFFICE_BIN.', 503));
        } else {
          reject(new AppError('LibreOffice could not start for this conversion.', 503));
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new AppError(`LibreOffice conversion failed with exit code ${code ?? 'unknown'}.`, 422));
      });
    });
    return await readFile(outputPath);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('LibreOffice did not produce a readable PDF. Check that the input document is supported.', 422);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function inspectOfficeArchive(data: Uint8Array, extension: string) {
  if (data[0] !== 0x50 || data[1] !== 0x4b) throw new AppError('The uploaded Office file is not a valid ZIP-based document.', 415);
  const { default: JSZip } = await import('jszip');
  let archive;
  try {
    archive = await JSZip.loadAsync(data, { checkCRC32: false, createFolders: false });
  } catch {
    throw new AppError('The Office file is damaged or has an invalid archive structure.', 422);
  }
  const required: Record<string, string> = {
    docx: 'word/document.xml',
    xlsx: 'xl/workbook.xml',
    pptx: 'ppt/presentation.xml',
  };
  if (!required[extension] || !archive.file(required[extension])) throw new AppError('The file content does not match the selected Office format.', 415);
}
