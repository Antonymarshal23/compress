import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { mergePdfBuffers, splitPdfBuffer, extractPdfPages, rotatePdfPages, removePdfPages, compressPdfBuffer } from '../services/pdf-tools.js';

export async function mergePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length < 2) {
      throw new AppError('Please upload at least two PDF files.', 400);
    }

    const pdfs = files.map((file) => new Uint8Array(file.buffer));
    const output = await mergePdfBuffers(pdfs);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="merged.pdf"');
    res.send(output);
  } catch (error) {
    next(error);
  }
}

export async function splitPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('Please upload a PDF file.', 400);
    }

    const ranges = [{ start: 1, end: 2 }, { start: 3, end: 4 }];
    const output = await splitPdfBuffer(new Uint8Array(file.buffer), ranges);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="split.zip"');
    res.send(output);
  } catch (error) {
    next(error);
  }
}

export async function extractPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('Please upload a PDF file.', 400);
    }

    const pages = req.body.pages ? String(req.body.pages).split(',').map((value) => Number(value.trim())).filter(Boolean) : [1, 2];
    const output = await extractPdfPages(new Uint8Array(file.buffer), pages);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="extracted.pdf"');
    res.send(output);
  } catch (error) {
    next(error);
  }
}

export async function rotatePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('Please upload a PDF file.', 400);
    }

    const output = await rotatePdfPages(new Uint8Array(file.buffer), 90, [1, 2]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rotated.pdf"');
    res.send(output);
  } catch (error) {
    next(error);
  }
}

export async function removePages(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('Please upload a PDF file.', 400);
    }

    const output = await removePdfPages(new Uint8Array(file.buffer), [1, 2]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pages-removed.pdf"');
    res.send(output);
  } catch (error) {
    next(error);
  }
}

export async function compressPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('Please upload a PDF file.', 400);
    }

    const output = await compressPdfBuffer(new Uint8Array(file.buffer));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
    res.send(output);
  } catch (error) {
    next(error);
  }
}
