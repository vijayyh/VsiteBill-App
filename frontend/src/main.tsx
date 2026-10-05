import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runSplash, wakeOnResume } from './lib/splash'

// Before React renders: start waking the server and play the opening splash over the app.
runSplash()
wakeOnResume()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
