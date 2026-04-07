import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const style = document.createElement('style')
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', 'Segoe UI', sans-serif;
    background: #FDFCF9;
    color: #1C1917;
    -webkit-font-smoothing: antialiased;
  }
html, body, #root {
    overflow-x: hidden;
    max-width: 100vw;
  }

  table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    width: 100%;
  }

  img, video, iframe {
    max-width: 100%;
  }
  a { text-decoration: none; }
  button { font-family: inherit; }
  input, textarea, select { font-family: inherit; }

  .splash {
    display: flex; align-items: center; justify-content: center;
    height: 100vh; font-size: 14px; color: #A8917A;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #DDD5C8; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #C4B8A8; }
`
document.head.appendChild(style)

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)