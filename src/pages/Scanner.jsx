import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { toDirectImageUrl } from '../lib/driveUtils'
import { Camera, Usb, Settings, ScanLine, Users, Wifi, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'

function isOnTime(cutoff) {
  const now = new Date()
  const [h, m] = cutoff.split(':').map(Number)
  return (now.getHours() * 60 + now.getMinutes()) <= (h * 60 + m)
}

function todayDate() { return new Date().toISOString().slice(0, 10) }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }

function parseQR(raw) {
  try { const o = JSON.parse(raw); return o.id || o.employee_id || raw.trim() }
  catch { return raw.trim() }
}

const STATUS_COLOR = { on_time: '#0d9488', late: '#d97706', duplicate: '#6366f1', error: '#dc2626' }
const STATUS_LABEL = { on_time: '✅ ON TIME', late: '⏰ LATE', duplicate: '🔄 Already Logged', error: '❌ Not Found' }

export default function Scanner() {
  const [mode, setMode]             = useState('usb')
  const [cutoff, setCutoff]         = useState('07:30')
  const [showSettings, setShowSettings] = useState(false)
  const [lastScan, setLastScan]     = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [totalToday, setTotalToday] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [camError, setCamError]     = useState('')
  const [online, setOnline]         = useState(navigator.onLine)
  const [clock, setClock]           = useState(new Date())

  // ── TEST MODE ─────────────────────────────────────────────────
  const [testMode, setTestMode]     = useState(false)
  const [testDate, setTestDate]     = useState(new Date().toISOString().slice(0,10))
  const [testTime, setTestTime]     = useState('07:25') // default: on time

  // Helper — get effective date/time (real or test override)
  const getEffectiveDate = () => testMode ? testDate : new Date().toISOString().slice(0,10)
  const getEffectiveTime = () => {
    if (!testMode) return new Date().toTimeString().slice(0,5)
    return testTime
  }
  const isEffectiveOnTime = () => {
    const [ch, cm] = cutoff.split(':').map(Number)
    const [th, tm] = getEffectiveTime().split(':').map(Number)
    return (th * 60 + tm) <= (ch * 60 + cm)
  }

  const videoRef   = useRef()
  const canvasRef  = useRef()
  const usbBuf     = useRef('')
  const usbTimer   = useRef()
  const animRef    = useRef()
  const streamRef  = useRef()
  const lockRef    = useRef(false)

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    supabase.from('attendance_settings').select('value').eq('key','cutoff_time').single()
      .then(({ data }) => { if (data?.value) setCutoff(data.value) })
  }, [])

  const loadStats = useCallback(async () => {
    const today = getEffectiveDate()
    const { data, count } = await supabase
      .from('attendance')
      .select('*, employees(first_name,last_name,department,photo_url)', { count: 'exact' })
      .eq('event_date', today)
      .order('scanned_at', { ascending: false })
      .limit(10)
    setRecentLogs(data || [])
    setTotalToday(count || 0)
  }, [testMode, testDate])

  useEffect(() => { loadStats() }, [loadStats])

  // ── PROCESS SCAN ──────────────────────────────────────────────
  const processScan = useCallback(async (raw) => {
    if (lockRef.current) return
    const empId = parseQR(raw)
    if (!empId || empId.length < 2) return
    lockRef.current = true
    setProcessing(true)

    try {
      const today = getEffectiveDate()
      const { data: emp } = await supabase.from('employees').select('*')
        .or(`employee_id.eq.${empId},id.eq.${empId}`).single()

      if (!emp) {
        setLastScan({ error: true, message: `Unknown ID: ${empId}` })
        return
      }

      const { data: dup } = await supabase.from('attendance').select('id,scanned_at')
        .eq('employee_id', emp.id).eq('event_date', today).maybeSingle()

      if (dup) {
        setLastScan({ employee: emp, status: 'duplicate', time: dup.scanned_at, message: 'Already scanned today' })
        return
      }

      const status = isEffectiveOnTime() ? 'on_time' : 'late'
      // Build scan timestamp — if test mode, combine testDate + testTime
      const scanTs = testMode
        ? new Date(`${testDate}T${testTime}:00`).toISOString()
        : new Date().toISOString()

      await supabase.from('attendance').insert({
        employee_id: emp.id,
        event_date: today,
        event_type: 'flag_raising',
        status,
        scanned_at: scanTs,
      })
      setLastScan({ employee: emp, status, time: scanTs, isTest: testMode })
      loadStats()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
      // USB scanner: release lock fast (800ms) so next person can scan quickly
      // Camera: slightly longer (1.5s) to avoid double-scan same QR
      setTimeout(() => { lockRef.current = false }, mode === 'usb' ? 800 : 1500)
    }
  }, [cutoff, loadStats, testMode, testDate, testTime, mode])

  // ── USB MODE ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'usb') return
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' && e.target !== document.getElementById('usb-hidden')) return
      if (e.key === 'Enter') {
        const val = usbBuf.current.trim()
        usbBuf.current = ''
        clearTimeout(usbTimer.current)
        if (val.length > 2) processScan(val)
      } else if (e.key.length === 1) {
        usbBuf.current += e.key
        clearTimeout(usbTimer.current)
        usbTimer.current = setTimeout(() => { usbBuf.current = '' }, 100)
      }
    }
    window.addEventListener('keydown', onKey)
    document.getElementById('usb-hidden')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, processScan])

  // ── CAMERA MODE ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera') { stopCam(); return }
    startCam()
    return stopCam
  }, [mode])

  const startCam = async () => {
    setCamError('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },   // smaller res = faster jsQR decode
          height: { ideal: 480 },
        }
      })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.play()
        tick()
      }
    } catch { setCamError('Camera access denied — switch to USB mode.') }
  }

  const stopCam = () => {
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // Throttle camera scan — run jsQR every 150ms max (not every 16ms frame)
  const lastScanAttempt = useRef(0)

  const tick = () => {
    const v = videoRef.current, c = canvasRef.current
    if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
      const now = Date.now()
      // Only attempt decode every 150ms — jsQR is CPU-heavy
      if (!lockRef.current && now - lastScanAttempt.current > 150) {
        lastScanAttempt.current = now
        // Downscale canvas for faster decode — 320x240 is enough for QR
        const W = 320, H = Math.round(v.videoHeight * (320 / v.videoWidth))
        c.width = W; c.height = H
        c.getContext('2d').drawImage(v, 0, 0, W, H)
        if (window.jsQR) {
          const imgData = c.getContext('2d').getImageData(0, 0, W, H)
          const code = window.jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'dontInvert', // faster — skip inverted QR check
          })
          if (code?.data) processScan(code.data)
        }
      }
    }
    animRef.current = requestAnimationFrame(tick)
  }

  const saveCutoff = async () => {
    await supabase.from('attendance_settings').update({ value: cutoff }).eq('key', 'cutoff_time')
    toast.success('Cutoff saved!'); setShowSettings(false)
  }

  const timeStr = clock.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = testMode
    ? `🧪 TEST: ${new Date(testDate+'T00:00:00').toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric' })} ${testTime}`
    : clock.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const isMonday = testMode ? new Date(testDate+'T00:00:00').getDay() === 1 : clock.getDay() === 1
  const scanStatus = lastScan?.error ? 'error' : lastScan?.status

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0f172a', color:'white', overflow:'hidden', fontFamily:'var(--font)' }}>
      {/* jsQR CDN */}
      <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js" async />

      {/* ── LEFT: SCANNER ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:28, gap:18, overflow:'hidden' }}>

        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--font-title)', fontSize:'1.125rem', fontWeight:800 }}>
              🏛️ Flag Raising Attendance Scanner
            </div>
            <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.45)', marginTop:3 }}>
              {dateStr}
              {!isMonday && !testMode && <span style={{ marginLeft:10, color:'#f59e0b', fontSize:'0.72rem', fontWeight:600 }}>⚠️ Today is not Monday</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:'0.72rem', color: online?'#0d9488':'#dc2626', display:'flex', alignItems:'center', gap:4 }}>
              {online ? <Wifi size={12}/> : <WifiOff size={12}/>} {online?'Online':'Offline'}
            </span>
            {/* Test Mode toggle */}
            <button
              onClick={() => setTestMode(m => !m)}
              style={{
                background: testMode ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                border: testMode ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.12)',
                borderRadius:8, padding:'6px 12px',
                color: testMode ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                cursor:'pointer', fontSize:'0.8rem', fontWeight: testMode ? 700 : 400,
                fontFamily:'var(--font)',
              }}
            >
              🧪 {testMode ? 'Test Mode ON' : 'Test Mode'}
            </button>
            <button onClick={() => setShowSettings(s => !s)} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'6px 12px', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem' }}>
              <Settings size={13}/> Settings
            </button>
          </div>
        </div>

        {/* Test Mode Banner */}
        {testMode && (
          <div style={{
            background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)',
            borderRadius:10, padding:'12px 16px',
            display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
          }}>
            <span style={{ fontSize:'0.875rem', fontWeight:700, color:'#fbbf24' }}>🧪 Test Mode — scans will be logged with test date/time</span>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <label style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)' }}>Date:</label>
                <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'4px 8px', color:'white', fontSize:'0.8rem', fontFamily:'var(--font)' }} />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <label style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)' }}>Time:</label>
                <input type="time" value={testTime} onChange={e => setTestTime(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'4px 8px', color:'white', fontSize:'0.8rem', fontFamily:'var(--font)' }} />
              </div>
              <span style={{ fontSize:'0.75rem', color: isEffectiveOnTime() ? '#0d9488' : '#dc2626', fontWeight:700 }}>
                {isEffectiveOnTime() ? '✅ ON TIME' : '⏰ LATE'} (cutoff {cutoff})
              </span>
              <button
                onClick={async () => {
                  const { error } = await supabase.from('attendance')
                    .delete().eq('event_date', testDate).eq('event_type', 'flag_raising')
                  if (!error) { toast.success('Test logs cleared!'); loadStats() }
                }}
                style={{ background:'rgba(220,38,38,0.2)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:6, padding:'4px 10px', color:'#f87171', cursor:'pointer', fontSize:'0.75rem', fontFamily:'var(--font)' }}
              >
                🗑️ Clear Test Logs
              </button>
            </div>
          </div>
        )}

        {/* Clock */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-title)', fontSize:'4rem', fontWeight:900, letterSpacing:'-0.03em', lineHeight:1, color:'#fff' }}>
            {timeStr}
          </div>
          <div style={{ marginTop:6, fontSize:'0.875rem', fontWeight:600, color: isOnTime(cutoff)?'#0d9488':'#f59e0b' }}>
            Cutoff: {cutoff} &nbsp;·&nbsp; {isOnTime(cutoff) ? '🟢 Still on time' : '🔴 Now late'}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:6, background:'rgba(255,255,255,0.06)', padding:4, borderRadius:10, width:'fit-content', margin:'0 auto' }}>
          {[['usb', <Usb size={14}/>, 'USB / Barcode Scanner'], ['camera', <Camera size={14}/>, 'Camera']].map(([m, icon, lbl]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:7,
              border:'none', cursor:'pointer', fontSize:'0.8125rem', fontWeight:600, fontFamily:'var(--font)',
              background: mode===m ? 'white' : 'transparent',
              color: mode===m ? '#1a3a8f' : 'rgba(255,255,255,0.45)',
              transition:'all 0.15s',
            }}>
              {icon} {lbl}
            </button>
          ))}
        </div>

        {/* Scanner area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
          {mode === 'usb' ? (
            <div style={{ textAlign:'center' }}>
              <div style={{
                width:160, height:160, borderRadius:20, margin:'0 auto 16px',
                background: processing ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.04)',
                border: `2px ${processing ? 'solid #0d9488' : 'dashed rgba(255,255,255,0.15)'}`,
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10,
                transition:'all 0.3s',
              }}>
                <ScanLine size={44} color={processing ? '#0d9488' : 'rgba(255,255,255,0.3)'} />
                <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.3)', lineHeight:1.5 }}>
                  {processing ? 'Processing...' : 'Waiting for scan'}
                </div>
              </div>
              <div style={{ fontSize:'0.875rem', color:'rgba(255,255,255,0.4)', marginBottom:6 }}>
                Point USB QR scanner at employee's ID card
              </div>
              <input id="usb-hidden" style={{ opacity:0, position:'absolute', pointerEvents:'none', width:1, height:1 }} autoFocus readOnly />
            </div>
          ) : (
            <div style={{ position:'relative', width:'100%', maxWidth:380 }}>
              {camError
                ? <div style={{ textAlign:'center', color:'#f87171', padding:24, fontSize:'0.875rem' }}>{camError}</div>
                : <>
                    <video ref={videoRef} muted playsInline style={{ width:'100%', borderRadius:14, background:'#000', display:'block' }} />
                    <canvas ref={canvasRef} style={{ display:'none' }} />
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                      <div style={{ width:200, height:200, border:'2px solid rgba(99,102,241,0.8)', borderRadius:12 }} />
                    </div>
                  </>
              }
            </div>
          )}

          {/* Last scan result card — BIG, clear, kiosk-style */}
          {lastScan && (
            <div style={{
              width:'100%', maxWidth:480,
              borderRadius:20,
              padding:'24px 28px',
              background: lastScan.error ? 'rgba(220,38,38,0.15)'
                : scanStatus === 'on_time' ? 'rgba(13,148,136,0.18)'
                : scanStatus === 'late' ? 'rgba(245,158,11,0.18)'
                : scanStatus === 'duplicate' ? 'rgba(99,102,241,0.18)'
                : 'rgba(220,38,38,0.15)',
              border: `2px solid ${
                lastScan.error ? '#dc2626'
                : scanStatus === 'on_time' ? '#0d9488'
                : scanStatus === 'late' ? '#f59e0b'
                : scanStatus === 'duplicate' ? '#6366f1'
                : '#dc2626'
              }`,
              animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: `0 0 40px ${
                scanStatus === 'on_time' ? 'rgba(13,148,136,0.3)'
                : scanStatus === 'late' ? 'rgba(245,158,11,0.3)'
                : 'rgba(220,38,38,0.2)'
              }`,
            }}>
              {lastScan.error ? (
                /* Error state */
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'3rem', marginBottom:8 }}>❌</div>
                  <div style={{ fontWeight:800, fontSize:'1.25rem', color:'#f87171' }}>Employee Not Found</div>
                  <div style={{ fontSize:'0.875rem', color:'rgba(255,255,255,0.4)', marginTop:4 }}>{lastScan.message}</div>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  {/* Photo */}
                  <div style={{
                    width:90, height:90,
                    borderRadius:'50%',
                    overflow:'hidden',
                    flexShrink:0,
                    border: `3px solid ${scanStatus === 'on_time' ? '#0d9488' : scanStatus === 'late' ? '#f59e0b' : '#6366f1'}`,
                    background:'rgba(255,255,255,0.1)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:900, fontSize:'2rem', color:'white',
                  }}>
                    {lastScan.employee?.photo_url
                      ? <img src={toDirectImageUrl(lastScan.employee.photo_url)} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top' }} />
                      : (lastScan.employee?.first_name?.[0]||'') + (lastScan.employee?.last_name?.[0]||'?')
                    }
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Status badge */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      padding:'4px 12px', borderRadius:999, marginBottom:8,
                      background: scanStatus==='on_time' ? '#0d9488'
                        : scanStatus==='late' ? '#d97706'
                        : scanStatus==='duplicate' ? '#6366f1'
                        : '#dc2626',
                      fontSize:'0.8rem', fontWeight:800, letterSpacing:'0.05em',
                    }}>
                      {scanStatus==='on_time' ? '✅ ON TIME'
                        : scanStatus==='late' ? '⏰ LATE'
                        : scanStatus==='duplicate' ? '🔄 ALREADY LOGGED'
                        : '❌ ERROR'}
                    </div>

                    {/* Name — BIG */}
                    <div style={{
                      fontFamily:'var(--font-title)',
                      fontWeight:900,
                      fontSize:'1.375rem',
                      color:'#fff',
                      lineHeight:1.2,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {lastScan.employee?.first_name} {lastScan.employee?.last_name}
                    </div>

                    {/* Department */}
                    <div style={{
                      fontSize:'0.8125rem',
                      color:'rgba(255,255,255,0.55)',
                      marginTop:3,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {lastScan.employee?.department}
                    </div>

                    {/* Time */}
                    <div style={{
                      marginTop:6,
                      fontFamily:'monospace',
                      fontSize:'1.1rem',
                      fontWeight:700,
                      color: scanStatus==='on_time' ? '#2dd4bf'
                        : scanStatus==='late' ? '#fbbf24'
                        : 'rgba(255,255,255,0.3)',
                    }}>
                      🕐 {lastScan.time ? fmtTime(lastScan.time) : '—'}
                      {lastScan.isTest && <span style={{ fontSize:'0.7rem', color:'#fbbf24', marginLeft:8, fontFamily:'var(--font)' }}>🧪 TEST</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:10, padding:16, border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', gap:12 }}>
            <label style={{ fontSize:'0.8125rem', color:'rgba(255,255,255,0.7)', whiteSpace:'nowrap' }}>On-time cutoff:</label>
            <input type="time" value={cutoff} onChange={e => setCutoff(e.target.value)}
              style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'7px 10px', color:'white', fontSize:'0.875rem', colorScheme:'dark', fontFamily:'var(--font)' }} />
            <button onClick={saveCutoff} className="btn btn-primary btn-sm">Save</button>
            <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.35)' }}>Current time: {timeStr}</span>
          </div>
        )}
      </div>

      {/* ── RIGHT: LIVE LOGS ── */}
      <div style={{ width:300, background:'rgba(255,255,255,0.03)', borderLeft:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 14px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:'0.875rem' }}>Today's Logs</div>
          <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(13,148,136,0.2)', padding:'3px 10px', borderRadius:999, fontSize:'0.75rem', fontWeight:700, color:'#0d9488' }}>
            <Users size={11}/> {totalToday}
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {recentLogs.length === 0
            ? <div style={{ textAlign:'center', padding:'32px 16px', color:'rgba(255,255,255,0.25)', fontSize:'0.8125rem' }}>No scans yet</div>
            : recentLogs.map(log => {
                const e = log.employees
                return (
                  <div key={log.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 14px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.68rem', fontWeight:700, flexShrink:0, overflow:'hidden' }}>
                      {e?.photo_url ? <img src={toDirectImageUrl(e.photo_url)} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (e?.first_name?.[0]||'') + (e?.last_name?.[0]||'')}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {e ? `${e.first_name} ${e.last_name}` : '—'}
                      </div>
                      <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.35)' }}>{fmtTime(log.scanned_at)}</div>
                    </div>
                    <span style={{ fontSize:'0.8rem', flexShrink:0 }}>{log.status==='on_time'?'✅':'⏰'}</span>
                  </div>
                )
              })
          }
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes popIn  { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}