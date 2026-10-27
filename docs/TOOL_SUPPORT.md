# Tool support matrix

Status describes the current implementation in this repository, not a planned product roadmap.

| Feature | Backend implementation | Automated test | External dependency | Current limitation |
|---|---|---:|---|---|
| Merge PDF | Yes | Yes | None | 2-10 PDFs; page count and size limits apply |
| Split PDF | Yes | Yes | None | User supplies ranges or selects all pages; ZIP output |
| Extract pages | Yes | Yes | None | Explicit page selection required |
| Remove pages | Yes | Yes | None | Explicit page selection required; cannot remove every page |
| Rotate pages | Yes | Yes | None | 90-degree increments |
| Reorder pages | Yes | Partial | None | Comma-separated page order; no visual thumbnail drag-and-drop yet |
| Add PDF pages | Yes | No | None | Frontend accepts a source PDF, an insert PDF, and an insertion position |
| Image to PDF (scan/JPG/PNG/WEBP/TIFF) | Yes | PNG path only | Sharp | Multiple images, orientation and margins; TIFF multipage handling is not provided; no OCR |
| OCR PDF | API only; hidden from UI | No | Poppler `pdftoppm`, Tesseract `eng` | Not published until deployment dependencies are installed and validated; synchronous, limited to 5 pages |
| PDF to JPG/PNG | API only; hidden from UI | No | Poppler `pdftoppm` | Not published until deployment dependency is installed and validated; ZIP export limited to 50 pages |
| Lossless PDF optimization | Yes | Yes | None | Uses pdf-lib object streams; size reduction is not guaranteed and output may be rejected if larger |
| Flatten form fields | Yes | No | None | Published; annotation flattening is not supported |
| Remove PDF metadata | Yes | No | None | Published; standard document information dictionary fields |
| Add text / page numbers / text watermark | Yes | No | None | Published basic fixed-position operations; no interactive preview |
| Plain text to PDF | Yes | No | None | Published; text-only, simple wrapping |
| HTML to PDF | Yes | No | None | Published; restricted HTML is flattened to text; no browser rendering or external assets |
| Office to PDF | API only; hidden from UI | Dependency detection only | LibreOffice | Not published until LibreOffice is installed and validated on the deployment host |
| PDF text extraction | Yes | DOCX conversion test covers extraction | pdfjs-dist | Embedded text only; scanned documents need OCR |
| PDF to DOCX/XLSX/PPTX | Yes | Yes | pdfjs-dist, docx, ExcelJS, PptxGenJS | Produces real Office archives from text; does not preserve complex layout or infer tables reliably |
| PDF to HTML / Markdown / TXT | Yes | No | pdfjs-dist | Published; extracts embedded text, not scanned-page OCR |

## Not implemented or not published

The following requested functions are not currently available as complete user-facing features: Office-to-PDF, OCR, PDF-to-image, damaged-file repair, PDF/A, visual thumbnail editing, interactive annotation placement, image watermarks, form filling, drawn signatures, visual PDF comparison, password protect/unlock, redaction, permissions inspection, table detection, AI summarization, translation, and document Q&A. Tools that rely on missing external executables are intentionally omitted from the published UI until those dependencies are installed and tested.

No PDF password cracking or unauthorized access bypass is implemented. No uploaded files are persisted to PostgreSQL; PostgreSQL/account functionality has not been added.
