/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_BASE_URL?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
