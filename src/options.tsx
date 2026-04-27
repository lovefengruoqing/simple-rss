import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

console.log('Options script loaded')

const container = document.getElementById('root')
console.log('Root container:', container)

if (container) {
  console.log('Creating React root and rendering App')
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  console.error('Root container not found!')
}