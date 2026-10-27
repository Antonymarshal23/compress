export type PdfToolMode = 'balanced' | 'strong' | 'maximum';

export type PdfOperationResult = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type PdfPageSelection = {
  pageNumbers: number[];
};
