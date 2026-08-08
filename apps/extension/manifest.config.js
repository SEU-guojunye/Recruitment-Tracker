import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
    manifest_version: 3,
    name: 'Recruitment Tracker',
    version: '0.1.0',
    description: '管理公司招聘信息和求职投递进度',
    permissions: [
        'storage',
        'activeTab',
        'scripting',
        'alarms',
        'offscreen'
    ],
    host_permissions: [
        'http://localhost:5173/*'
    ],
    background: {
        service_worker: 'src/background/service-worker.js',
        type: 'module'
    },
    action: {
        default_popup: 'index.html'
    },
    options_page: 'dashboard.html',
    web_accessible_resources: [
        {
            resources: ['offscreen.html'],
            matches: ['<all_urls>']
        }
    ],
    content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'; frame-src http://localhost:5173"
    }
})
