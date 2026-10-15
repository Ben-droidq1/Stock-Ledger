import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Public site URL used for absolute asset links in link previews (Open Graph / X).
// Edit this single line if the domain changes. An env var (SITE_URL) overrides it
// so the same build can target a preview domain without touching source.
const SITE_URL = (process.env.SITE_URL || 'https://stock-ledger-nu.vercel.app').replace(/\/+$/, '')

// Replaces the %SITE_URL% placeholder in index.html at build and dev time. The meta
// tags stay static in index.html (link crawlers do not run JavaScript), while the
// domain lives in exactly one place.
function siteUrlPlaceholder() {
  return {
    name: 'stock-ledger-site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrlPlaceholder()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
})
