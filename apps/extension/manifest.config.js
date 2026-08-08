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
        'alarms'
    ],
    action: {
        default_popup: 'index.html'
    },
    options_page: 'dashboard.html'
})
