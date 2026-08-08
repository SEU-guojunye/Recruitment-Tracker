import {
  PRODUCTION_BRIDGE_URL,
  createExtensionManifest,
} from '../../apps/extension/manifest.config.js'
import { describe, expect, it } from 'vitest'

describe('production extension manifest', () => {
  it('uses one fixed hosted bridge origin and only the required permissions', () => {
    const manifest = createExtensionManifest({ mode: 'production' })
    const origin = new URL(PRODUCTION_BRIDGE_URL).origin
    expect(manifest.host_permissions).toEqual([`${origin}/*`])
    expect(manifest.content_security_policy.extension_pages).toContain(`frame-src ${origin}`)
    expect(manifest.permissions).toEqual([
      'storage',
      'activeTab',
      'scripting',
      'alarms',
      'offscreen',
    ])
    expect(manifest).not.toHaveProperty('content_scripts')
    expect(manifest).not.toHaveProperty('web_accessible_resources')
    expect(manifest.key).toBeTruthy()
  })

  it('keeps localhost isolated to development builds', () => {
    const manifest = createExtensionManifest({ mode: 'development' })
    expect(manifest.host_permissions).toEqual(['http://localhost:5173/*'])
    expect(createExtensionManifest({ mode: 'production' }).host_permissions[0])
      .not.toContain('localhost')
  })
})
