import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { CreditCard, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
        } else {
          toast.success('Account created! Please check your email to confirm.')
          setMode('signin')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <CreditCard size={26} color="white" />
          </div>
          <h1 className="login-title">Dagupan ID System</h1>
          <p className="login-sub">City Government of Dagupan · HR Module</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px',
              marginBottom: 18, fontSize: '0.8125rem', color: 'var(--danger)'
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="email"
                className="form-input"
                placeholder="you@dagupan.gov.ph"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ paddingLeft: 34, paddingRight: 40 }}
              />
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px 18px', fontSize: '0.9375rem' }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : null}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
            style={{ color: 'var(--primary)', fontSize: '0.8125rem' }}
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--gray-100)',
          textAlign: 'center', fontSize: '0.75rem', color: 'var(--gray-400)'
        }}>
          Republic of the Philippines · City Government of Dagupan
        </div>
      </div>
    </div>
  )
}
