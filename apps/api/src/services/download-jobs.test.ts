import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const directory = await mkdtemp(path.join(os.tmpdir(), 'paperpilot-tests-'));
process.env.TEMP_JOB_DIRECTORY = directory;
process.env.TEMP_RETENTION_MINUTES = '0.01';
const jobs = await import('./download-jobs.js');

describe('temporary authorized downloads', () => {
  beforeAll(async () => {
    await jobs.initializeDownloadJobs();
  });

  afterAll(async () => {
    jobs.stopDownloadJobCleanup();
    await rm(directory, { recursive: true, force: true });
  });

  it('creates a one-time tokenized download and deletes output after use', async () => {
    const result = await jobs.createDownloadJob(Buffer.from('test output'), '../safe.txt', 'text/plain');
    const download = await jobs.readDownloadJob(result.jobId, result.downloadUrl.split('/').pop()!);
    expect(download.bytes.toString()).toBe('test output');
    expect(download.filename).toBe('safe.txt');
    await expect(jobs.readDownloadJob(result.jobId, result.downloadUrl.split('/').pop()!)).rejects.toMatchObject({ statusCode: 404 });
    expect((await readdir(directory))).toHaveLength(0);
  });

  it('rejects invalid and expired-looking job identifiers', async () => {
    await expect(jobs.readDownloadJob('../bad', 'invalid')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('removes expired results and cleans up failed job creation', async () => {
    const result = await jobs.createDownloadJob(Buffer.from('expires'), 'temporary.pdf', 'application/pdf');
    const token = result.downloadUrl.split('/').pop()!;
    await new Promise((resolve) => setTimeout(resolve, 700));
    await expect(jobs.readDownloadJob(result.jobId, token)).rejects.toMatchObject({ statusCode: 404 });
    await expect(jobs.createDownloadJob(Buffer.alloc(0), 'empty.pdf', 'application/pdf')).rejects.toMatchObject({ statusCode: 500 });
  });
});
