import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startSplash, wakeOnResume } from './lib/splash'

// Before React renders: start waking the server (the splash then plays once the app has rendered).
startSplash()
wakeOnResume()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
