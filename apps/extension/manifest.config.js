import { defineManifest } from '@crxjs/vite-plugin'

export const PRODUCTION_BRIDGE_URL = 'https://recruitment-tracker-recuriment-tracker-d4cx9a1dc6d69.webapps.tcloudbase.com/extension-bridge.html'
export const EXTENSION_PUBLIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqLxaovClx/SOtos2IfQ4pItMW49SeMaavBDQ5IidIHHqR0r4KHpVkcYgyH5yX/d9eCl/7Q7cmAZb1XpmXfQpWQyK8SYf7o/qCUpg+Cw/CxHa57zsTUaHZQorRtnfO+0+B4sPGQmZ16rKaKeNioReP7+qAC8Mp4rgz3qt33T1eEBFY5eEaqebeLy5mTvcM5sX0xarjWO1Liraqcrmgl96xSWswX5tHPpbdXo00qNFgNqOypP89pnT1pDwDGaQ8lGXLDUJ+CcnUMWVnwrKdhh+K3kjyyUODXkp2E3HC+8VcD6UNKuQaB1O3mpVXu/+0TghTfj9nFSd2h392z937cjr9QIDAQAB'

export function createExtensionManifest({ mode = 'production' } = {}) {
  const bridgeUrl = process.env.VITE_CLOUDBASE_BRIDGE_URL
    || (mode === 'production'
      ? PRODUCTION_BRIDGE_URL
      : 'http://localhost:5173/extension-bridge.html')
  const bridgeOrigin = new URL(bridgeUrl).origin
  return {
    manifest_version: 3,
    key: EXTENSION_PUBLIC_KEY,
    name: 'Recruitment Tracker',
    version: '0.1.0',
    description: '管理公司招聘信息和求职投递进度',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'alarms',
      'offscreen',
    ],
    host_permissions: [`${bridgeOrigin}/*`],
    background: {
      service_worker: 'src/background/service-worker.js',
      type: 'module',
    },
    action: {
      default_popup: 'index.html',
    },
    options_page: 'dashboard.html',
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'self'; frame-src ${bridgeOrigin}`,
    },
  }
}

export default defineManifest(({ mode }) => createExtensionManifest({ mode }))
