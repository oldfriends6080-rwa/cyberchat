// MUST be first: polyfills for XMTP/tsyringe (SES-compatible)
import 'reflect-metadata'
import 'buffer'
import 'process'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Debug: verify polyfills loaded
if (typeof Reflect === 'undefined') {
  console.error('❌ Reflect is not available')
} else if (typeof Reflect.metadata !== 'function') {
  console.warn('⚠️ Reflect.metadata not defined - XMTP may fail')
} else {
  console.log('✅ reflect-metadata loaded successfully')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
