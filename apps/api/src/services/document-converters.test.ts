import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { convertOfficeToPdf, pdfToOffice } from './document-converters.js';
import { extractPdfText } from './pdf-tools.js';

async function textPdf() {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText('PaperPilot sample text for conversion.', { x: 30, y: 700, font, size: 12 });
  return Buffer.from(await document.save());
}

describe('document converters', () => {
  it('extracts embedded PDF text and creates real DOCX, XLSX, and PPTX archives', async () => {
    const pdf = await textPdf();
    expect((await extractPdfText(pdf)).toString()).toContain('PaperPilot');

    for (const format of ['docx', 'xlsx', 'pptx'] as const) {
      const output = await pdfToOffice(pdf, format);
      const archive = await JSZip.loadAsync(output, { checkCRC32: true });
      expect(Object.keys(archive.files).length).toBeGreaterThan(1);
      if (format === 'docx') expect(archive.file('word/document.xml')).not.toBeNull();
      if (format === 'xlsx') expect(archive.file('xl/workbook.xml')).not.toBeNull();
      if (format === 'pptx') expect(archive.file('ppt/presentation.xml')).not.toBeNull();
    }
  });

  it('returns a clear dependency error when LibreOffice is unavailable', async () => {
    const previous = process.env.LIBREOFFICE_BIN;
    process.env.LIBREOFFICE_BIN = 'paperpilot-soffice-not-installed';
    try {
      await expect(convertOfficeToPdf(Buffer.from('not a document'), 'docx')).rejects.toMatchObject({ statusCode: 503 });
    } finally {
      if (previous === undefined) delete process.env.LIBREOFFICE_BIN;
      else process.env.LIBREOFFICE_BIN = previous;
    }
  });
});
