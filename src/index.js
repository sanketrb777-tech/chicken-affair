import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Global reset
const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', 'Segoe UI', sans-serif; background: #F1F5F9; }
  a { text-decoration: none; }
  button { font-family: inherit; }
  input, textarea, select { font-family: inherit; }
  .splash { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 14px; color: #64748B; }
`
document.head.appendChild(style)

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)
