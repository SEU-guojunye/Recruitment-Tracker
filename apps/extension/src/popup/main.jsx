import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/base.css'
import './popup.css'
import { PopupApp } from './PopupApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
)
