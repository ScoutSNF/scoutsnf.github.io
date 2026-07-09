/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_PLACES_KEY?: string
  readonly VITE_CMS_PROXY_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
