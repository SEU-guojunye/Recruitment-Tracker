import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { WebApp } from './WebApp.jsx'
import { CloudBaseAuthService } from './cloudbase/auth-service.js'
import { CloudBaseSnapshotReader } from './cloudbase/snapshot-reader.js'

const developmentServices = import.meta.env.DEV
  ? window.__RECRUITMENT_TRACKER_TEST_SERVICES__
  : null
const authService = developmentServices?.authService || new CloudBaseAuthService()
const snapshotReader = developmentServices?.snapshotReader
  || new CloudBaseSnapshotReader(authService)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WebApp authService={authService} snapshotReader={snapshotReader} />
  </StrictMode>,
)
