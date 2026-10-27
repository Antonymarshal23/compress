# VPS deployment

This guide describes a single modest Linux VPS deployment. Processing untrusted PDFs and Office files on a shared VPS is inherently risky: native parsers can have vulnerabilities, input can exhaust RAM/CPU/disk, and this service does not provide a hardened per-job container sandbox. Use an isolated, patched host, an unprivileged service account, strict resource limits, a reverse proxy, and conservative upload limits. Do not process highly sensitive documents unless your deployment and jurisdictional privacy requirements have been independently reviewed.

## Requirements

- Ubuntu 22.04/24.04 or another supported Linux distribution
- Node.js 22 LTS and npm
- Nginx (or another TLS-terminating reverse proxy)
- No database is required by the current application

Install Node.js using your distribution's approved repository/package source:

```sh
sudo apt update
sudo apt install -y nginx
```

The current UI intentionally omits OCR, PDF-to-image, and Office-to-PDF because those require external executables not included in the basic deployment. Backend routes remain for future use and may return a dependency setup error if called directly; do not rely on them until Poppler/Tesseract or LibreOffice are installed and validated. Confirm the base runtime with `node --version` and `npm --version`.

## Install and configure

```sh
sudo useradd --system --create-home --home-dir /opt/paperpilot --shell /usr/sbin/nologin paperpilot
sudo install -d -o paperpilot -g paperpilot -m 0700 /var/lib/paperpilot/jobs
sudo -u paperpilot git clone YOUR_REPOSITORY_URL /opt/paperpilot/app
cd /opt/paperpilot/app
npm ci
cp .env.example .env
```

Edit `.env` and set at minimum:

- `NODE_ENV=production`
- `PORT=5000`
- `CORS_ORIGIN=https://your-domain.example`
- `UPLOAD_LIMIT_MB` and `MAX_PDF_PAGES` appropriate to host memory
- `MAX_CONCURRENT_JOBS=1` or `2` for a small VPS
- `TRUST_PROXY_HOPS=1` when requests arrive through the single configured Nginx proxy; otherwise keep it at `0`
- `TEMP_JOB_DIRECTORY=/var/lib/paperpilot/jobs`
- `TEMP_RETENTION_MINUTES` to the shortest useful period
- `SITE_BASE_URL=https://your-domain.example` (or `VITE_PUBLIC_BASE_URL` for the frontend build)

For frontend build-time settings, configure `VITE_PUBLIC_BASE_URL`, `VITE_ADSENSE_CLIENT`, and `VITE_ADSENSE_SLOT` in the build environment. Do not set ad IDs until supplied by the actual publisher account. Ad slots are disabled if IDs are absent. Review the privacy/cookie disclosures and obtain any required consent before enabling advertising.

Build and run:

```sh
npm run build
npm run start
```

The API serves built frontend assets when `NODE_ENV=production`. Confirm `https://your-domain.example/api/health/live` and `/api/health/ready`.

## systemd

Create `/etc/systemd/system/paperpilot.service`:

```ini
[Unit]
Description=PaperPilot document tools
After=network.target

[Service]
Type=simple
User=paperpilot
Group=paperpilot
WorkingDirectory=/opt/paperpilot/app/apps/api
EnvironmentFile=/opt/paperpilot/app/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start --workspace apps/api
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/paperpilot/jobs
MemoryMax=1G
CPUQuota=150%
TasksMax=128

[Install]
WantedBy=multi-user.target
```

Adjust the Node/npm executable path and limits for the VPS. Activate with `sudo systemctl daemon-reload && sudo systemctl enable --now paperpilot`.

## Nginx and HTTPS

Example site configuration:

```nginx
server {
    listen 80;
    server_name your-domain.example www.your-domain.example;
    client_max_body_size 51m;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 130s;
    }
}
```

Use Certbot (or your hosting provider's equivalent) to obtain and renew TLS certificates. Only expose ports 80/443 publicly; keep port 5000 bound behind the proxy/firewall. The application does not itself configure TLS.

## Operations

- Logs: `sudo journalctl -u paperpilot -f`; do not log document contents or passwords.
- Temporary files: jobs are stored outside the web root, are served only through a random one-time token, and are deleted after successful download or expiry. Expired directories are recovered at startup; keep the directory on a dedicated volume with disk monitoring.
- Backups: no PostgreSQL database exists currently. Back up deployment configuration and environment secrets securely; do not back up temporary uploads as application data.
- Firewall: allow SSH from trusted networks and HTTP/HTTPS; deny direct public access to the API port.
- Monitor free disk and memory. Lower upload/page/concurrency limits if the service approaches resource limits.
- Rate limiting and concurrency controls are in-process and reset on restart; use an external reverse proxy firewall or a distributed limiter if running multiple replicas.

## Troubleshooting

- Out of memory / timeouts: lower `UPLOAD_LIMIT_MB`, `MAX_PDF_PAGES`, and `MAX_CONCURRENT_JOBS`; use a larger host for complex files.
- Failed or password-protected PDFs: this app does not crack passwords; supply an authorized unlocked PDF. Damaged/encrypted files may fail with a clear processing error.
- Insufficient disk: inspect the configured temporary directory and filesystem quota; remove expired job files only while the service is stopped or via its cleanup process.
- CORS errors: set `CORS_ORIGIN` to the exact public origin and restart.
- Frontend routes fail on refresh: ensure production mode is serving the Vite build through the API or configure the web server to fall back to `index.html`.

## Docker

`docker compose up --build` serves the current production frontend and API on port 5000. Supply a real `.env` first. The image does not install optional document engines; OCR, PDF-to-image, and Office-to-PDF are hidden from the UI. The compose file uses a read-only container filesystem with a temporary filesystem for job data. For persistence across container restarts, configure a dedicated writable job volume with restrictive permissions and a quota.
