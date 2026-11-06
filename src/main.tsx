// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { matchRoutes } from 'react-router-dom'
import { appRoutes } from './appRoutes'
import { config } from './config'
import { queryClient } from './lib/queryClient'
import { readPublicDocsBootstrap, seedPublicDocsBootstrap } from './lib/publicDocsBootstrap'
import { preloadRoute } from './components/routes/preloadRoute'

function start() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

const initialDocs = readPublicDocsBootstrap(document, window.location.pathname, config.basePath)
const readingPath = document.querySelector<HTMLMetaElement>('meta[name="sw-public-reading-path"]')?.content
if (initialDocs || readingPath === window.location.pathname) {
  // Keep the generated HTML visible until the matching route can render.
  const matches = matchRoutes(appRoutes, window.location, config.basePath) ?? []
  void Promise.all(matches.map(match => preloadRoute(match.route.element))).then(() => {
    if (initialDocs) seedPublicDocsBootstrap(queryClient, initialDocs)
    start()
  })
} else {
  start()
}
