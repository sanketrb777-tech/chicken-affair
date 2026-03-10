return (
  <div style={{ 
    minHeight: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20,
    position: 'relative',
    overflow: 'hidden'
  }}>

    {/* Background image with blur */}
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: 'url(/bg-login.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(6px)',
      transform: 'scale(1.05)',
    }} />

    {/* Dark overlay */}
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />

    {/* Card */}
    <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img src="/icons/icon-192x192.png" alt="Bambini Cafe" style={{ width: 80, height: 80, borderRadius: 16, margin: '0 auto 16px', display: 'block' }} />
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0 }}>Bambini Cafe</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 }}>Sign in to your account</p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} style={{ 
        background: 'rgba(255,255,255,0.1)', 
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 16, padding: 32, 
        display: 'flex', flexDirection: 'column', gap: 16 
      }}>

        {error && (
          <div style={{ background: 'rgba(254,226,226,0.9)', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="you@bambini.com"
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ background: loading ? 'rgba(255,255,255,0.2)' : '#1a3c3e', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 20 }}>
        Access is by invite only. Contact your manager if you need an account.
      </p>
    </div>
  </div>
)