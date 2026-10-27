// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ToolPage from './ToolPage';
import { PublicToolsPage } from './PublicPages';
import { tools } from '../data/tools';

function renderTool(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/tools/${slug}`]}>
      <Routes>
        <Route path="/tools/:slug" element={<ToolPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('tool workflows', () => {
  it('keeps every available tool slug unique so published links resolve to the right workflow', () => {
    const availableSlugs = tools.filter((tool) => tool.status === 'available').map((tool) => tool.slug);
    expect(new Set(availableSlugs).size).toBe(availableSlugs.length);
    expect(tools.find((tool) => tool.slug === 'scan-pdf')?.status).toBe('available');
    expect(tools.find((tool) => tool.slug === 'organize-pdf')?.status).toBe('available');
  });

  it('lists only conversions that do not need missing system tools', () => {
    render(
      <MemoryRouter initialEntries={['/tools']}>
        <PublicToolsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Convert to PDF' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Convert from PDF' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Text to PDF' }).getAttribute('href')).toBe('/tools/txt-to-pdf');
    expect(screen.getByRole('link', { name: 'PDF to Word' }).getAttribute('href')).toBe('/tools/pdf-to-word');
    expect(screen.queryByRole('link', { name: 'Word to PDF' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'OCR PDF' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'PDF to JPG' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'PDF to PNG' })).toBeNull();
    expect(tools.some((tool) => ['word-to-pdf', 'excel-to-pdf', 'powerpoint-to-pdf', 'ocr-pdf', 'pdf-to-jpg', 'pdf-to-png'].includes(tool.slug))).toBe(false);
  });

  it('accepts files, submits a real merge request, and exposes the authorized download', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: '0123456789abcdef0123456789abcdef', downloadUrl: '/api/download/job/token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderTool('merge-pdf');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const first = new File(['%PDF-1.7'], 'first.pdf', { type: 'application/pdf' });
    const second = new File(['%PDF-1.7'], 'second.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [first, second] } });
    expect(await screen.findByText('first.pdf')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /start processing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/tools/merge-pdf');
    expect((await screen.findByRole('link', { name: /download result/i })).getAttribute('href')).toBe('/api/download/job/token');
    expect(screen.getByRole('status').textContent).toContain('Your file is ready to download.');
    expect(screen.getByRole('link', { name: /download result/i }).className).toContain('sparkle-download');
  });

  it('gives file removal a clear interactive affordance', async () => {
    const { container } = renderTool('merge-pdf');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['%PDF-1.7'], 'first.pdf', { type: 'application/pdf' }),
          new File(['%PDF-1.7'], 'second.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    expect(await screen.findByText('first.pdf')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(screen.queryByText('first.pdf')).toBeNull();
    expect(screen.getByText('second.pdf')).toBeTruthy();
  });

  it('shows page-range options and surfaces API validation errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Page ranges must be within 1-3.' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderTool('split-pdf');
    fireEvent.change(screen.getByLabelText(/Page ranges/), { target: { value: '1-8' } });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.7'], 'document.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('document.pdf')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /start processing/i }));

    expect(await screen.findByText('Page ranges must be within 1-3.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows a single image in the image-to-PDF workflow', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ downloadUrl: '/api/download/image-job/token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderTool('png-to-pdf');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['png'], 'page.png', { type: 'image/png' })] } });
    expect(await screen.findByText('page.png')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /start processing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const submitted = fetchMock.mock.calls[0][1].body as FormData;
    expect(submitted.getAll('files')).toHaveLength(1);
    expect(await screen.findByRole('link', { name: /download result/i })).toBeTruthy();
  });
});
