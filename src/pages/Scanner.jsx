import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { toDirectImageUrl } from '../lib/driveUtils'
import { Camera, Usb, Settings, Users, Wifi, WifiOff, X } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────
const todayStr  = () => new Date().toISOString().slice(0, 10)
const fmtTime   = ts => new Date(ts).toLocaleTimeString('en-PH',{ hour:'2-digit', minute:'2-digit', second:'2-digit' })
const fmtClock  = d  => d.toLocaleTimeString('en-PH',{ hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true })

// Parse QR — supports both JSON payload and plain employee_id string
function parseQR(raw) {
  if (!raw) return null
  const s = raw.trim()
  try {
    const obj = JSON.parse(s)
    // Our QR payload: { id: "HRMO-2026-0001", name: "...", dept: "..." }
    return String(obj.id || obj.employee_id || '').trim() || null
  } catch {
    return s || null
  }
}

// ── Scanner component ────────────────────────────────────────────
export default function Scanner() {
  const [mode,        setMode]        = useState('usb')
  const [cutoff,      setCutoff]      = useState('07:30')
  const [showSettings,setShowSettings]= useState(false)
  const [lastScan,    setLastScan]    = useState(null)
  const [logs,        setLogs]        = useState([])
  const [presentCount,setPresentCount]= useState(0)
  const [clock,       setClock]       = useState(new Date())
  const [online,      setOnline]      = useState(navigator.onLine)
  const [camErr,      setCamErr]      = useState('')
  const [busy,        setBusy]        = useState(false)

  // test mode
  const [testMode, setTestMode] = useState(false)
  const [testDate, setTestDate] = useState(todayStr())
  const [testTime, setTestTime] = useState('07:25')

  const videoRef  = useRef()
  const canvasRef = useRef()
  const rafRef    = useRef()
  const streamRef = useRef()
  const busyRef   = useRef(false)   // sync lock — avoids stale closure
  const lastQRRef = useRef('')      // debounce same QR
  const lastQRTs  = useRef(0)
  const usbBuf    = useRef('')
  const usbTimer  = useRef()

  // ── clock ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 500)
    return () => clearInterval(t)
  }, [])

  // ── online ─────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ── load cutoff from DB ────────────────────────────────────────
  useEffect(() => {
    supabase.from('attendance_settings').select('value').eq('key','cutoff_time').maybeSingle()
      .then(({ data }) => { if (data?.value) setCutoff(data.value) })
  }, [])

  // ── load today's logs ──────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    const date = testMode ? testDate : todayStr()
    const { data, count } = await supabase
      .from('attendance')
      .select('id,scanned_at,status,employees(first_name,last_name,photo_url,department)', { count:'exact' })
      .eq('event_date', date)
      .order('scanned_at', { ascending: false })
      .limit(20)
    setLogs(data || [])
    setPresentCount(count || 0)
  }, [testMode, testDate])

  useEffect(() => { loadLogs() }, [loadLogs])

  // ── CORE SCAN HANDLER ──────────────────────────────────────────
  const handleScan = useCallback(async (raw) => {
    // debounce — ignore same QR within 2s
    const now = Date.now()
    if (raw === lastQRRef.current && now - lastQRTs.current < 2000) return
    // lock — prevent overlapping requests
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    lastQRRef.current = raw
    lastQRTs.current  = now

    const empId = parseQR(raw)
    if (!empId) {
      setLastScan({ type:'error', msg:'Invalid QR code' })
      busyRef.current = false; setBusy(false)
      return
    }

    try {
      const scanDate = testMode ? testDate : todayStr()

      // ── Look up employee ──────────────────────────────────────
      // Two separate queries — avoids .or() breaking on dashes in employee_id
      let emp = null

      const { data: r1 } = await supabase
        .from('employees').select('*')
        .eq('employee_id', empId).maybeSingle()
      emp = r1

      // Fallback: try as UUID
      if (!emp) {
        const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (uuidRx.test(empId)) {
          const { data: r2 } = await supabase
            .from('employees').select('*')
            .eq('id', empId).maybeSingle()
          emp = r2
        }
      }

      if (!emp) {
        setLastScan({ type:'error', msg:`Not found: ${empId}` })
        return
      }

      // ── Duplicate check ───────────────────────────────────────
      const { data: dup } = await supabase
        .from('attendance').select('id,scanned_at')
        .eq('employee_id', emp.id).eq('event_date', scanDate).maybeSingle()

      if (dup) {
        setLastScan({ type:'duplicate', emp, time: dup.scanned_at })
        return
      }

      // ── Determine status ──────────────────────────────────────
      const [ch, cm] = cutoff.split(':').map(Number)
      let th, tm
      if (testMode) {
        [th, tm] = testTime.split(':').map(Number)
      } else {
        const n = new Date(); th = n.getHours(); tm = n.getMinutes()
      }
      const status   = (th * 60 + tm) <= (ch * 60 + cm) ? 'on_time' : 'late'
      const scanTs   = testMode
        ? new Date(`${testDate}T${testTime}:00`).toISOString()
        : new Date().toISOString()

      // ── Insert attendance ─────────────────────────────────────
      const { error: insErr } = await supabase.from('attendance').insert({
        employee_id: emp.id,
        event_date:  scanDate,
        event_type:  'flag_raising',
        status,
        scanned_at:  scanTs,
      })

      if (insErr) {
        // 23505 = unique violation = already logged (race condition)
        if (insErr.code === '23505') {
          setLastScan({ type:'duplicate', emp, time: scanTs })
        } else {
          setLastScan({ type:'error', msg: insErr.message })
        }
        return
      }

      setLastScan({ type: status, emp, time: scanTs, isTest: testMode })
      loadLogs()

    } catch (err) {
      setLastScan({ type:'error', msg: err.message })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [cutoff, testMode, testDate, testTime, loadLogs])

  // ── USB / keyboard scanner ─────────────────────────────────────
  useEffect(() => {
    if (mode !== 'usb') return
    const onKey = (e) => {
      // ignore keystrokes into inputs (except our hidden one)
      if (document.activeElement?.tagName === 'INPUT' &&
          document.activeElement.id !== 'qr-hidden-input') return

      if (e.key === 'Enter') {
        clearTimeout(usbTimer.current)
        const val = usbBuf.current.trim()
        usbBuf.current = ''
        if (val.length > 1) handleScan(val)
      } else if (e.key.length === 1) {
        usbBuf.current += e.key
        clearTimeout(usbTimer.current)
        usbTimer.current = setTimeout(() => { usbBuf.current = '' }, 150)
      }
    }
    window.addEventListener('keydown', onKey)
    // focus hidden input so USB scanner types here
    document.getElementById('qr-hidden-input')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, handleScan])

  // ── Camera scanner ─────────────────────────────────────────────
  const stopCam = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCam = useCallback(async () => {
    setCamErr('')
    // Load jsQR from CDN if not loaded
    if (!window.jsQR) {
      await new Promise((res, rej) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
        s.onload = res; s.onerror = rej
        document.head.appendChild(s)
      })
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:'environment', width:{ideal:640}, height:{ideal:480} }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanFrame()
      }
    } catch (err) {
      setCamErr('Camera error: ' + err.message)
    }
  }, [])

  const lastFrameTs = useRef(0)
  const scanFrame = useCallback(() => {
    rafRef.current = requestAnimationFrame(scanFrame)
    const now = Date.now()
    if (now - lastFrameTs.current < 200) return  // scan every 200ms max
    lastFrameTs.current = now

    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || v.readyState < 2 || busyRef.current) return

    const W = 320, H = Math.round(v.videoHeight * (320 / (v.videoWidth || 320)))
    if (c.width !== W) { c.width = W; c.height = H }
    c.getContext('2d').drawImage(v, 0, 0, W, H)

    if (!window.jsQR) return
    const img  = c.getContext('2d').getImageData(0, 0, W, H)
    const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts:'dontInvert' })
    if (code?.data) handleScan(code.data)
  }, [handleScan])

  useEffect(() => {
    if (mode === 'camera') startCam()
    else stopCam()
    return stopCam
  }, [mode])

  // ── save cutoff ────────────────────────────────────────────────
  const saveCutoff = async () => {
    await supabase.from('attendance_settings').update({ value: cutoff }).eq('key','cutoff_time')
    setShowSettings(false)
  }

  // ── computed ───────────────────────────────────────────────────
  const clockStr  = fmtClock(clock)
  const nowMins   = clock.getHours() * 60 + clock.getMinutes()
  const [ch, cm]  = cutoff.split(':').map(Number)
  const cutoffMin = ch * 60 + cm
  const onTimeNow = nowMins <= cutoffMin

  const scanBg = !lastScan ? 'transparent'
    : lastScan.type === 'on_time'   ? 'rgba(13,148,136,0.2)'
    : lastScan.type === 'late'      ? 'rgba(245,158,11,0.2)'
    : lastScan.type === 'duplicate' ? 'rgba(99,102,241,0.2)'
    : 'rgba(220,38,38,0.2)'

  const scanBorder = !lastScan ? 'transparent'
    : lastScan.type === 'on_time'   ? '#0d9488'
    : lastScan.type === 'late'      ? '#f59e0b'
    : lastScan.type === 'duplicate' ? '#6366f1'
    : '#dc2626'

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0a0f1e', color:'white', fontFamily:'var(--font)', overflow:'hidden' }}>

      {/* ── LEFT: MAIN SCANNER ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'20px 24px', gap:14, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'var(--font-title)', fontSize:'1.1rem', fontWeight:800, display:'flex', alignItems:'center', gap:8 }}>
              🏛️ Flag Raising Attendance
            </div>
            <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.35)', marginTop:2 }}>
              City Government of Dagupan
              {!testMode && new Date().getDay() !== 1 &&
                <span style={{ color:'#f59e0b', marginLeft:8 }}>⚠️ Not Monday</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:'0.7rem', color: online?'#0d9488':'#dc2626', display:'flex', alignItems:'center', gap:3 }}>
              {online ? <Wifi size={11}/> : <WifiOff size={11}/>}
              {online ? 'Online' : 'Offline'}
            </span>
            <button onClick={() => setTestMode(m=>!m)} style={{
              background: testMode ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${testMode ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem',
              color: testMode ? '#fbbf24' : 'rgba(255,255,255,0.4)', fontFamily:'var(--font)',
            }}>🧪 {testMode ? 'Test ON' : 'Test'}</button>
            <button onClick={() => setShowSettings(s=>!s)} style={{
              background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:7, padding:'5px 10px', cursor:'pointer', fontSize:'0.75rem', color:'rgba(255,255,255,0.6)',
              display:'flex', alignItems:'center', gap:4, fontFamily:'var(--font)',
            }}><Settings size={12}/> Settings</button>
          </div>
        </div>

        {/* Test mode bar */}
        {testMode && (
          <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, padding:'8px 14px', display:'flex', gap:14, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
            <span style={{ fontWeight:700, fontSize:'0.8rem', color:'#fbbf24' }}>🧪 TEST MODE</span>
            <label style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:5 }}>
              Date: <input type="date" value={testDate} onChange={e=>setTestDate(e.target.value)}
                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:5, padding:'3px 7px', color:'white', fontSize:'0.75rem' }}/>
            </label>
            <label style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:5 }}>
              Time: <input type="time" value={testTime} onChange={e=>setTestTime(e.target.value)}
                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:5, padding:'3px 7px', color:'white', fontSize:'0.75rem' }}/>
            </label>
            <button onClick={async()=>{ await supabase.from('attendance').delete().eq('event_date',testDate); loadLogs() }}
              style={{ background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:5, padding:'3px 8px', color:'#f87171', cursor:'pointer', fontSize:'0.72rem', fontFamily:'var(--font)' }}>
              🗑 Clear test logs
            </button>
          </div>
        )}

        {/* Clock */}
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ fontSize:'3.5rem', fontWeight:900, letterSpacing:'-0.03em', lineHeight:1, fontFamily:'monospace' }}>
            {clockStr}
          </div>
          <div style={{ marginTop:5, fontSize:'0.85rem', fontWeight:600, color: onTimeNow ? '#2dd4bf' : '#fb923c' }}>
            Cutoff {cutoff} &nbsp;·&nbsp; {onTimeNow ? '🟢 On Time' : '🔴 Late'}
          </div>
        </div>

        {/* Mode switcher */}
        <div style={{ display:'flex', gap:5, background:'rgba(255,255,255,0.05)', padding:4, borderRadius:10, width:'fit-content', margin:'0 auto', flexShrink:0 }}>
          {[['usb', <Usb size={13}/>, 'USB Scanner'], ['camera', <Camera size={13}/>, 'Camera']].map(([m,icon,lbl]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              display:'flex', alignItems:'center', gap:5, padding:'7px 16px', borderRadius:7,
              border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:600, fontFamily:'var(--font)',
              background: mode===m ? 'white' : 'transparent',
              color: mode===m ? '#1a3a8f' : 'rgba(255,255,255,0.4)',
              transition:'all 0.15s',
            }}>{icon}{lbl}</button>
          ))}
        </div>

        {/* Scanner area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minHeight:0 }}>

          {mode === 'usb' ? (
            <div style={{
              width:'100%', maxWidth:400, padding:'32px 24px',
              background:'rgba(255,255,255,0.03)', border: busy ? '2px solid #1a56db' : '2px dashed rgba(255,255,255,0.1)',
              borderRadius:16, textAlign:'center', cursor:'pointer',
              transition:'all 0.2s',
            }} onClick={() => document.getElementById('qr-hidden-input')?.focus()}>
              <div style={{ fontSize:'3rem', marginBottom:10 }}>{busy ? '⏳' : '📡'}</div>
              <div style={{ fontWeight:700, fontSize:'1rem', color:'white', marginBottom:6 }}>
                {busy ? 'Processing...' : 'Ready to Scan'}
              </div>
              <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.35)' }}>
                Point USB scanner at employee QR code
              </div>
              {/* Manual input for testing */}
              <input type="text" placeholder="Or type Employee ID + Enter"
                onKeyDown={e => { if(e.key==='Enter' && e.target.value.trim()){ handleScan(e.target.value.trim()); e.target.value='' }}}
                style={{ marginTop:14, width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:7, padding:'9px 12px', color:'white', fontSize:'0.85rem', fontFamily:'var(--font)', outline:'none', textAlign:'center' }}
                onClick={e => e.stopPropagation()}
              />
              {/* Hidden keyboard capture for USB scanner */}
              <input id="qr-hidden-input" style={{ position:'absolute', opacity:0, pointerEvents:'none', width:1, height:1 }} autoFocus />
            </div>
          ) : (
            <div style={{ position:'relative', width:'100%', maxWidth:480, borderRadius:14, overflow:'hidden', background:'#000', aspectRatio:'4/3' }}>
              <video ref={videoRef} muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
              <canvas ref={canvasRef} style={{ display:'none' }}/>
              {/* Scan overlay */}
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <div style={{ width:200, height:200, border:'3px solid rgba(96,165,250,0.9)', borderRadius:14, boxShadow:'0 0 0 9999px rgba(0,0,0,0.45)' }}/>
              </div>
              {/* Animated scan line */}
              <div style={{ position:'absolute', left:'calc(50% - 100px)', top:'calc(50% - 100px)', width:200, pointerEvents:'none' }}>
                <div style={{ height:2, background:'rgba(96,165,250,0.8)', animation:'scanLine 1.5s ease-in-out infinite', boxShadow:'0 0 8px rgba(96,165,250,0.8)' }}/>
              </div>
              {camErr && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', color:'#f87171', textAlign:'center', padding:20, fontSize:'0.875rem' }}>
                  {camErr}
                </div>
              )}
              <div style={{ position:'absolute', bottom:10, left:0, right:0, textAlign:'center' }}>
                <span style={{ background:'rgba(0,0,0,0.6)', color:'rgba(255,255,255,0.7)', fontSize:'0.75rem', padding:'3px 12px', borderRadius:999 }}>
                  {busy ? '⏳ Processing...' : 'Align QR inside the box'}
                </span>
              </div>
            </div>
          )}

          {/* ── SCAN RESULT — BIG & CLEAR ── */}
          {lastScan && (
            <div key={lastScan.time || lastScan.msg} style={{
              width:'100%', maxWidth:460, borderRadius:18, padding:'20px 24px',
              background: scanBg,
              border: `2px solid ${scanBorder}`,
              animation:'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: `0 0 30px ${scanBorder}44`,
            }}>
              {lastScan.type === 'error' ? (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'2.5rem' }}>❌</div>
                  <div style={{ fontWeight:800, fontSize:'1.1rem', color:'#f87171', marginTop:8 }}>Employee Not Found</div>
                  <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.4)', marginTop:4, fontFamily:'monospace' }}>{lastScan.msg}</div>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:18 }}>
                  {/* Photo */}
                  <div style={{
                    width:80, height:80, borderRadius:'50%', flexShrink:0, overflow:'hidden',
                    border: `3px solid ${scanBorder}`,
                    background:'rgba(255,255,255,0.1)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'1.8rem', fontWeight:900, color:'white',
                  }}>
                    {lastScan.emp?.photo_url
                      ? <img src={toDirectImageUrl(lastScan.emp.photo_url)} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top' }}/>
                      : (lastScan.emp?.first_name?.[0]||'')+(lastScan.emp?.last_name?.[0]||'?')
                    }
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      display:'inline-block', padding:'3px 10px', borderRadius:999, marginBottom:6,
                      background: scanBorder, fontSize:'0.75rem', fontWeight:800, letterSpacing:'0.04em',
                    }}>
                      {lastScan.type==='on_time' ? '✅ ON TIME'
                        : lastScan.type==='late' ? '⏰ LATE'
                        : '🔄 ALREADY LOGGED'}
                    </div>
                    <div style={{ fontFamily:'var(--font-title)', fontSize:'1.3rem', fontWeight:900, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {lastScan.emp?.first_name} {lastScan.emp?.last_name}
                    </div>
                    <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.5)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {lastScan.emp?.department}
                    </div>
                    <div style={{ marginTop:5, fontFamily:'monospace', fontSize:'1rem', fontWeight:700, color: scanBorder }}>
                      🕐 {fmtTime(lastScan.time)}
                      {lastScan.isTest && <span style={{ fontSize:'0.65rem', color:'#fbbf24', marginLeft:8, fontFamily:'var(--font)' }}>🧪 TEST</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:10, padding:'12px 16px', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <label style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.7)', whiteSpace:'nowrap' }}>On-time cutoff:</label>
            <input type="time" value={cutoff} onChange={e=>setCutoff(e.target.value)}
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'7px 10px', color:'white', fontSize:'0.875rem', colorScheme:'dark', fontFamily:'var(--font)' }}/>
            <button onClick={saveCutoff} style={{ background:'#1a3a8f', border:'none', borderRadius:6, padding:'8px 16px', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'var(--font)', fontSize:'0.8rem' }}>
              Save
            </button>
            <button onClick={() => setShowSettings(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
              <X size={16}/>
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: LIVE LOG ── */}
      <div style={{ width:260, background:'rgba(255,255,255,0.02)', borderLeft:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px 14px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontWeight:700, fontSize:'0.875rem' }}>Today's Log</span>
          <span style={{ background:'rgba(13,148,136,0.2)', color:'#2dd4bf', padding:'2px 10px', borderRadius:999, fontSize:'0.75rem', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
            <Users size={10}/> {presentCount}
          </span>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {logs.length === 0
            ? <div style={{ textAlign:'center', padding:'28px 14px', color:'rgba(255,255,255,0.2)', fontSize:'0.8rem' }}>No scans yet today</div>
            : logs.map(log => {
                const e = log.employees
                return (
                  <div key={log.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.07)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:700, flexShrink:0 }}>
                      {e?.photo_url
                        ? <img src={toDirectImageUrl(e.photo_url)} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : (e?.first_name?.[0]||'')+(e?.last_name?.[0]||'')
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.78rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {e ? `${e.first_name} ${e.last_name}` : '—'}
                      </div>
                      <div style={{ fontSize:'0.67rem', color:'rgba(255,255,255,0.3)' }}>{fmtTime(log.scanned_at)}</div>
                    </div>
                    <span style={{ fontSize:'0.85rem' }}>{log.status==='on_time'?'✅':'⏰'}</span>
                  </div>
                )
              })
          }
        </div>
      </div>

      <style>{`
        @keyframes popIn    { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
        @keyframes scanLine { 0%{transform:translateY(0)} 50%{transform:translateY(194px)} 100%{transform:translateY(0)} }
      `}</style>
    </div>
  )
}