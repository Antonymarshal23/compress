import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

type DownloadJob = {
  directory: string;
  tokenHash: Buffer;
  filename: string;
  mimeType: string;
  expiresAt: number;
};

const rootDirectory = process.env.TEMP_JOB_DIRECTORY ?? path.join(os.tmpdir(), 'paperpilot-jobs');
const retentionMs = Number(process.env.TEMP_RETENTION_MINUTES ?? 30) * 60_000;
const activeJobs = new Map<string, DownloadJob>();
let cleanupTimer: NodeJS.Timeout | undefined;

function randomToken() {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest();
}

function safeFilename(filename: string) {
  const cleaned = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  return cleaned && cleaned !== '.' ? cleaned : 'download.bin';
}

export async function initializeDownloadJobs() {
  await mkdir(rootDirectory, { recursive: true, mode: 0o700 });
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^job-[a-f0-9]{32}$/.test(entry.name)) continue;
    const directory = path.join(rootDirectory, entry.name);
    const info = await stat(directory);
    if (now - info.mtimeMs > retentionMs) await rm(directory, { recursive: true, force: true });
  }
  cleanupTimer = setInterval(() => void cleanupExpiredJobs(), 60_000);
  cleanupTimer.unref();
}

export async function createDownloadJob(data: Uint8Array, filename: string, mimeType: string) {
  const id = randomBytes(16).toString('hex');
  const token = randomToken();
  const directory = path.join(rootDirectory, `job-${id}`);
  await mkdir(directory, { recursive: false, mode: 0o700 });
  const outputPath = path.join(directory, 'output');
  try {
    await writeFile(outputPath, data, { flag: 'wx', mode: 0o600 });
    const output = await readFile(outputPath);
    if (output.length === 0) throw new AppError('The processing result was empty.', 500);
    activeJobs.set(id, {
      directory,
      tokenHash: hashToken(token),
      filename: safeFilename(filename),
      mimeType,
      expiresAt: Date.now() + retentionMs,
    });
    return { jobId: id, downloadUrl: `/api/download/${id}/${token}`, expiresInSeconds: Math.floor(retentionMs / 1000) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function readDownloadJob(id: string, token: string) {
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new AppError('This download link is invalid or has expired.', 404);
  }
  const job = activeJobs.get(id);
  if (!job || job.expiresAt <= Date.now()) {
    if (job) await removeDownloadJob(id);
    throw new AppError('This download link is invalid or has expired.', 404);
  }
  const incoming = hashToken(token);
  if (incoming.length !== job.tokenHash.length || !timingSafeEqual(incoming, job.tokenHash)) {
    throw new AppError('This download link is invalid or has expired.', 404);
  }
  const bytes = await readFile(path.join(job.directory, 'output'));
  await removeDownloadJob(id);
  return { bytes, filename: job.filename, mimeType: job.mimeType };
}

async function removeDownloadJob(id: string) {
  const job = activeJobs.get(id);
  if (!job) return;
  activeJobs.delete(id);
  await rm(job.directory, { recursive: true, force: true });
}

async function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of activeJobs) {
    if (job.expiresAt <= now) {
      try {
        await removeDownloadJob(id);
      } catch (error) {
        logger.error({ error, operation: 'cleanup' }, 'Failed to remove expired download job');
      }
    }
  }
}

export function stopDownloadJobCleanup() {
  if (cleanupTimer) clearInterval(cleanupTimer);
}
