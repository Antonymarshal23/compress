# PaperPilot

PaperPilot is an original PDF-processing application with a React/Vite frontend and an Express API. It supports anonymous processing and does not require PostgreSQL or account registration. See [the tool support matrix](./docs/TOOL_SUPPORT.md) for precise implementation status; features not listed as implemented should not be treated as available.

## Requirements

- Node.js 22+
- npm 10+

## Local development

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The web development server runs on http://localhost:5173 and proxies `/api` requests to http://localhost:5000.

The homepage automatically adds a small seasonal theme for Diwali (India dates currently listed through 2035), Christmas, and New Year. It uses India Standard Time and returns to the regular homepage outside those date windows.

## Build, test, run

```powershell
npm run build
npm test
npm run start
```

In production, the API serves the built frontend. Use a reverse proxy for HTTPS and set `NODE_ENV=production`, `CORS_ORIGIN`, and `VITE_PUBLIC_BASE_URL` before building. `VITE_PUBLIC_BASE_URL` is used at Vite build time for canonical URLs and generated `sitemap.xml`/`robots.txt`.

## Implemented processing

The published UI currently includes PDF merge, split, extract/remove/rotate/reorder pages, add PDF pages, image-to-PDF, lossless optimization, metadata removal, supported form flattening, basic text/page-number/text-watermark tools, plain-text/Markdown/restricted-HTML to PDF, embedded PDF text extraction, and PDF-to-DOCX/XLSX/PPTX text conversion. The directory lists only workflows that do not depend on optional system executables. Office-to-PDF, OCR, and PDF-to-JPG/PNG are intentionally omitted until their external engines are provisioned and validated for a deployment. See [the tool support matrix](./docs/TOOL_SUPPORT.md) for precise implementation status.

Many requested operations remain unimplemented, including redaction, password tools, PDF/A, interactive thumbnails/editing, table detection, and optional AI document intelligence. Do not treat this repository as having completed every feature in the original product brief.

### Upload and output handling

- Uploads are held in memory during synchronous processing, with configurable size/page/concurrency limits.
- Output files are placed in private per-job temporary directories outside the public web root.
- Downloads use cryptographically random job IDs and one-time bearer tokens, expire after `TEMP_RETENTION_MINUTES`, and are removed after download.
- Expired job directories are cleaned at startup and by a periodic worker.
- Rate limiting and concurrency controls are in-process and are not distributed across multiple replicas.
- Files are not stored in PostgreSQL; no PostgreSQL layer or account system is currently included.

## Configuration

Copy `.env.example` to `.env`. Important settings include `UPLOAD_LIMIT_MB`, `MAX_PDF_PAGES`, `MAX_CONCURRENT_JOBS`, `MAX_CONCURRENT_JOBS_PER_IP`, `TEMP_JOB_DIRECTORY`, `TEMP_RETENTION_MINUTES`, `TRUST_PROXY_HOPS`, `CORS_ORIGIN`, `VITE_PUBLIC_BASE_URL`, and AdSense build-time IDs. Advertising remains disabled unless the actual `VITE_ADSENSE_CLIENT` and a configured global or placement-specific slot ID are set.

## Docker

Set up `.env`, then run:

```sh
docker compose up --build
```

The image serves the production frontend and API on port 5000. For a public service, place it behind HTTPS and configure the firewall and upload limits.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Linux VPS setup, Nginx, TLS, systemd, resource limits, cleanup, and troubleshooting.

## Known limitations

Arbitrary PDFs and Office documents are complex, untrusted inputs; processing on a shared VPS is not a hardened isolation boundary. Review the security and privacy implications in the deployment guide. PDF text-to-office exports reconstruct text and do not promise faithful layout conversion. Password workflows, redaction, PDF/A, OCR, PDF-to-image rendering, Office-to-PDF, table recognition, and many interactive tools are not in the currently published release.
