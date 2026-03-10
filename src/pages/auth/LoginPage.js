import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { signIn }  = useAuth()
  const navigate    = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#b9f5ff', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <img src="/icons/icon-192x192.png" alt="Bambini Cafe" style={{ width:80, height:80, borderRadius:16, margin:'0 auto 16px', display:'block' }} />
          <h1 style={{ color:'#1d5f5f', fontSize:28, fontWeight:800, margin:0 }}>Bambini Cafe</h1>
          <p style={{ color:'#648b8b', fontSize:14, marginTop:6 }}>Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ background:'#1E293B', borderRadius:16, padding:32, display:'flex', flexDirection:'column', gap:16 }}>

          {error && (
            <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#B91C1C' }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94A3B8', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@bambini.com"
              style={{ width:'100%', background:'#0F172A', border:'1px solid #334155', borderRadius:8, padding:'10px 14px', fontSize:14, color:'#fff', outline:'none', boxSizing:'border-box' }}
            />
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94A3B8', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ width:'100%', background:'#0F172A', border:'1px solid #334155', borderRadius:8, padding:'10px 14px', fontSize:14, color:'#fff', outline:'none', boxSizing:'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ background: loading ? '#334155' : '#1a3c3e', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', marginTop:4 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign:'center', color:'#334155', fontSize:12, marginTop:20 }}>
          Access is by invite only. Contact your manager if you need an account.
        </p>
      </div>
    </div>
  )
}
