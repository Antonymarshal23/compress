import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import JSZip from 'jszip';
import {
  compressPdfBuffer,
  addPageNumbers,
  addPdfPages,
  addText,
  addWatermark,
  extractPdfPages,
  flattenPdf,
  getPdfPageCount,
  imagesToPdf,
  mergePdfBuffers,
  removeMetadata,
  organizePdf,
  removePdfPages,
  rotatePdfPages,
  splitPdfBuffer,
} from './pdf-tools.js';

async function fixture(pageCount: number) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) document.addPage([612, 792]);
  return Buffer.from(await document.save());
}

describe('PDF processing', () => {
  it('merges files in upload order', async () => {
    const merged = await PDFDocument.load(await mergePdfBuffers([await fixture(2), await fixture(1)]));
    expect(merged.getPageCount()).toBe(3);
  });

  it('splits selected page ranges into a zip', async () => {
    const result = await splitPdfBuffer(await fixture(4), [{ start: 1, end: 2 }, { start: 4, end: 4 }]);
    const archive = await JSZip.loadAsync(result);
    const first = await PDFDocument.load(await archive.file('part-1-pages-1-2.pdf')!.async('uint8array'));
    const second = await PDFDocument.load(await archive.file('part-2-pages-4-4.pdf')!.async('uint8array'));
    expect(first.getPageCount()).toBe(2);
    expect(second.getPageCount()).toBe(1);
  });

  it('extracts and removes only selected pages', async () => {
    const source = await fixture(4);
    expect((await PDFDocument.load(await extractPdfPages(source, [2, 4]))).getPageCount()).toBe(2);
    expect((await PDFDocument.load(await removePdfPages(source, [2]))).getPageCount()).toBe(3);
  });

  it('rotates selected pages and preserves the remaining orientation', async () => {
    const result = await PDFDocument.load(await rotatePdfPages(await fixture(2), 90, [2]));
    expect(result.getPage(0).getRotation().angle).toBe(0);
    expect(result.getPage(1).getRotation().angle).toBe(90);
  });

  it('reorders pages and losslessly optimizes without adding content', async () => {
    const source = await fixture(3);
    expect((await PDFDocument.load(await organizePdf(source, [3, 1, 2]))).getPageCount()).toBe(3);
    const compressed = await compressPdfBuffer(source);
    expect((await PDFDocument.load(compressed)).getPageCount()).toBe(3);
  });

  it('converts real PNG image bytes into a PDF', async () => {
    const image = await sharp({ create: { width: 20, height: 12, channels: 3, background: '#336699' } }).png().toBuffer();
    const pdf = await PDFDocument.load(await imagesToPdf([image]));
    expect(pdf.getPageCount()).toBe(1);
    await expect(imagesToPdf([image], 'portrait', 24, 'jpeg')).rejects.toMatchObject({ statusCode: 415 });
  });

  it('inserts pages, flattens supported forms, removes metadata, and applies basic edits', async () => {
    const source = await fixture(2);
    const inserted = await addPdfPages(source, await fixture(1), 1);
    expect(await getPdfPageCount(inserted)).toBe(3);
    expect(await getPdfPageCount(await flattenPdf(source))).toBe(2);

    const document = await PDFDocument.load(source);
    document.setTitle('private-title');
    const stripped = await PDFDocument.load(await removeMetadata(Buffer.from(await document.save())));
    expect(stripped.getTitle()).toBeUndefined();
    expect(await getPdfPageCount(await addText(source, 'hello', 1, 30, 40, 12))).toBe(2);
    expect(await getPdfPageCount(await addPageNumbers(source))).toBe(2);
    expect(await getPdfPageCount(await addWatermark(source, 'DRAFT'))).toBe(2);
  });
});
