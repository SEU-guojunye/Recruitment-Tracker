import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/base.css'
import { DashboardApp } from './DashboardApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DashboardApp />
  </StrictMode>,
)
