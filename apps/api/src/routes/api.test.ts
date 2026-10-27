import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import request from 'supertest';

const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'paperpilot-api-test-'));
process.env.TEMP_JOB_DIRECTORY = tempDirectory;
process.env.UPLOAD_LIMIT_MB = '1';

const [{ default: app }, jobs] = await Promise.all([
  import('../app.js'),
  import('../services/download-jobs.js'),
]);

async function pdfFixture(pageCount = 1) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([612, 792]).drawText(`PaperPilot API test page ${index + 1}`, { x: 30, y: 700, font, size: 12 });
  }
  return Buffer.from(await document.save());
}

describe('PDF upload API', () => {
  beforeAll(async () => {
    await jobs.initializeDownloadJobs();
  });

  afterAll(async () => {
    jobs.stopDownloadJobCleanup();
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('rejects uploads without a real PDF signature', async () => {
    const response = await request(app)
      .post('/api/tools/merge-pdf')
      .attach('files', Buffer.from('not a PDF'), 'one.pdf')
      .attach('files', Buffer.from('not a PDF'), 'two.pdf');
    expect(response.status).toBe(415);
  });

  it('returns a one-time authorized link for a valid merge', async () => {
    const response = await request(app)
      .post('/api/tools/merge-pdf')
      .attach('files', await pdfFixture(1), 'one.pdf')
      .attach('files', await pdfFixture(2), 'two.pdf');
    expect(response.status).toBe(202);
    expect(response.body.jobId).toMatch(/^[a-f0-9]{32}$/);
    const result = await request(app).get(response.body.downloadUrl);
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toContain('application/pdf');
    expect((await PDFDocument.load(result.body)).getPageCount()).toBe(3);
    expect((await request(app).get(response.body.downloadUrl)).status).toBe(404);
  });

  it('converts an uploaded PDF to a downloadable Word document', async () => {
    const response = await request(app)
      .post('/api/tools/pdf-to-word')
      .attach('file', await pdfFixture(), 'document.pdf');
    expect(response.status).toBe(202);

    const download = await request(app).get(response.body.downloadUrl);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('wordprocessingml.document');
    expect(download.headers['content-disposition']).toContain('.docx');
  });

  it('converts a single uploaded PNG into a downloadable PDF', async () => {
    const image = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#336699' } }).png().toBuffer();
    const response = await request(app)
      .post('/api/tools/png-to-pdf')
      .attach('files', image, 'page.png');
    expect(response.status).toBe(202);

    const download = await request(app).get(response.body.downloadUrl);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect((await PDFDocument.load(download.body)).getPageCount()).toBe(1);
  });

  it('enforces upload limits and reports malformed PDFs safely', async () => {
    const oversized = await request(app)
      .post('/api/tools/merge-pdf')
      .attach('files', Buffer.alloc(1024 * 1024 + 1), 'large.pdf');
    expect(oversized.status).toBe(413);

    const malformed = await request(app)
      .post('/api/tools/merge-pdf')
      .attach('files', Buffer.from('%PDF-not-valid'), 'one.pdf')
      .attach('files', Buffer.from('%PDF-not-valid'), 'two.pdf');
    expect(malformed.status).toBe(422);
    expect(malformed.body.message).not.toContain('stack');
  });

  it('returns a clear setup error when Poppler is unavailable for image export or OCR', async () => {
    const previous = process.env.PDFTOPPM_BIN;
    process.env.PDFTOPPM_BIN = 'paperpilot-pdftoppm-not-installed';
    try {
      for (const tool of ['pdf-to-png', 'ocr-pdf']) {
        const response = await request(app)
          .post(`/api/tools/${tool}`)
          .attach('file', await pdfFixture(), 'document.pdf');
        expect(response.status).toBe(503);
        expect(response.body.message).toContain('poppler-utils');
      }
    } finally {
      if (previous === undefined) delete process.env.PDFTOPPM_BIN;
      else process.env.PDFTOPPM_BIN = previous;
    }
  });
});
