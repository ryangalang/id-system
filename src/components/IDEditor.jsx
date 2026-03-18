import { useState, useRef, useCallback } from 'react'
import { RotateCcw, Save, Sparkles, Loader2 } from 'lucide-react'
import { toDirectImageUrl } from '../lib/driveUtils'

// ── Layout defaults ──────────────────────────────────────────────
export const DEFAULT_LAYOUT = {
  photo:      { x: 8,   y: 16.5, w: 84,  h: 39.5 },
  name:       { x: 2,   y: 56.5, w: 96,  fontSize: 3.2,  bold: true,  color: '#1a1a2e', align: 'center', font: 'canva-sans' },
  position:   { x: 2,   y: 67.0, w: 96,  fontSize: 3.8,  bold: false, color: '#333333', align: 'center', font: 'montserrat' },
  department: { x: 2,   y: 71.5, w: 96,  fontSize: 3.65, bold: true,  color: '#1a1a1a', align: 'center', font: 'montserrat' },
  qr:         { x: 33,  y: 76.5, w: 34  },
  qrLabel:    { x: 2,   y: 90.0, w: 96,  fontSize: 2.8,  bold: false, color: '#444444', align: 'center', font: 'montserrat' },
}

const HANDLE    = 9
const EDITOR_PX = 320
const EDITOR_H  = Math.round(EDITOR_PX * (2000 / 1414))

function fsPx(pct) {
  return Math.max(1, (pct / 100) * EDITOR_PX)
}

// ── Canva font sizes converted to % of card width ────────────────
// Card width in Canva = 53.98mm = ~204px at 96dpi
// Canva font px → % of card width = (px / 204) * 100
// Canva Sans 12pt   → ~16px → 7.8% of 204px
// Montserrat 28.1pt → ~37.5px → 18.4% — but these are CARD sizes, not mm
// For our system, fontSize is % of card WIDTH in mm (53.98mm)
// Montserrat 28.1pt on 53.98mm wide card ≈ 3.8% of card width
// Montserrat 27.2pt ≈ 3.65% of card width
// Montserrat 20.7pt ≈ 2.8% of card width
// Canva Sans 12pt   ≈ 3.2% of card width (name is bigger visually)

// ── AI Auto-Adjust ───────────────────────────────────────────────
// Uses the Anthropic API via artifact proxy (avoids CORS)
async function aiAnalyzeTemplate() {
  // Fetch blank template as base64
  const res  = await fetch('/id-template-blank.png')
  if (!res.ok) throw new Error('Could not load template image')
  const blob = await res.blob()
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror  = reject
    reader.readAsDataURL(blob)
  })

  const prompt = `You are analyzing an ID card template image for the City Government of Dagupan, Philippines.
The template is 1414px wide × 2000px tall (portrait orientation).

Look carefully and identify the EXACT pixel zones for each element, then convert to percentages.
Return ONLY valid JSON, no markdown, no explanation:
{
  "photo":      {"x":<left%>,"y":<top%>,"w":<width%>,"h":<height%>},
  "name":       {"x":<left%>,"y":<top%>,"w":<width%>,"fontSize":3.2,"bold":true,"color":"#1a1a2e","align":"center"},
  "position":   {"x":<left%>,"y":<top%>,"w":<width%>,"fontSize":3.8,"bold":false,"color":"#333333","align":"center"},
  "department": {"x":<left%>,"y":<top%>,"w":<width%>,"fontSize":3.65,"bold":true,"color":"#1a1a1a","align":"center"},
  "qr":         {"x":<left%>,"y":<top%>,"w":<width%>},
  "qrLabel":    {"x":<left%>,"y":<top%>,"w":<width%>,"fontSize":2.8,"bold":false,"color":"#444444","align":"center"}
}
Rules:
- All x,y,w,h are PERCENTAGES of card width/height (0-100)
- photo = large white/blank area for employee photo
- name = dark navy blue band (the text band below the photo)
- position = first text line in the beige/cream bottom section
- department = bold text line below position in beige section
- qr = QR code area, centered in bottom section
- qrLabel = employee ID number below QR code`

  // Use Anthropic API — must be called from server-side or with proper CORS headers
  // In production (Vercel), this works. In local dev, you may need a proxy.
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
        { type: 'text',  text: prompt }
      ]}]
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data  = await response.json()
  const text  = data.content?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI returned no valid JSON')
  const parsed = JSON.parse(match[0])
  for (const key of ['photo','name','position','department','qr','qrLabel']) {
    if (!parsed[key]) throw new Error(`Missing key: ${key}`)
  }
  return parsed
}

// ── Draggable / Resizable element ────────────────────────────────
function DragElement({ id, layout, selected, onSelect, onChange, children }) {
  const ref  = useRef()
  const drag = useRef(null)

  const onMouseDown = useCallback((e, type) => {
    e.stopPropagation(); e.preventDefault()
    onSelect(id)
    const pr = ref.current.parentElement.getBoundingClientRect()
    drag.current = { type, sx: e.clientX, sy: e.clientY, sl: { ...layout }, pw: pr.width, ph: pr.height }

    const move = (e) => {
      if (!drag.current) return
      const { type, sx, sy, sl, pw, ph } = drag.current
      const dx = ((e.clientX - sx) / pw) * 100
      const dy = ((e.clientY - sy) / ph) * 100
      if (type === 'move') {
        onChange(id, {
          x: Math.max(0, Math.min(100 - sl.w, sl.x + dx)),
          y: Math.max(0, Math.min(95, sl.y + dy)),
        })
      } else if (type === 'se') {
        onChange(id, {
          w: Math.max(8, sl.w + dx),
          ...(sl.h !== undefined ? { h: Math.max(5, sl.h + dy) } : {}),
        })
      }
    }
    const up = () => {
      drag.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [id, layout, onSelect, onChange])

  return (
    <div
      ref={ref}
      onMouseDown={e => onMouseDown(e, 'move')}
      style={{
        position: 'absolute',
        left: `${layout.x}%`, top: `${layout.y}%`,
        width: `${layout.w}%`,
        height: layout.h !== undefined ? `${layout.h}%` : 'auto',
        cursor: 'move',
        outline: selected ? '1.5px dashed #1a56db' : '1px dashed transparent',
        boxSizing: 'border-box', userSelect: 'none',
      }}
    >
      {children}
      {selected && (
        <div
          onMouseDown={e => onMouseDown(e, 'se')}
          style={{
            position: 'absolute', bottom: -HANDLE/2, right: -HANDLE/2,
            width: HANDLE, height: HANDLE,
            background: '#1a56db', borderRadius: 2, cursor: 'se-resize', zIndex: 10,
          }}
        />
      )}
    </div>
  )
}

const ELEMENTS = [
  { id: 'photo',      label: 'Photo',               icon: '🖼️' },
  { id: 'name',       label: 'Name',                icon: '✏️' },
  { id: 'position',   label: 'Position',            icon: '📋' },
  { id: 'department', label: 'Department',          icon: '🏢' },
  { id: 'qr',         label: 'QR Code',             icon: '⬛' },
  { id: 'qrLabel',    label: 'Employee ID (HRMO#)', icon: '🔖' },
]

// ── Main Editor Component ─────────────────────────────────────────
export default function IDEditor({ employee, qrDataUrl, layout, onChange, onSave }) {
  const [selected,  setSelected]  = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  const emp = employee || {
    first_name: 'JUAN', last_name: 'DELA CRUZ', middle_initial: 'S',
    position: 'Administrative Assistant I',
    department: 'Human Resource Management Office',
    employee_id: 'HRMO-2026-0001',
  }

  const photo    = emp.photo_url ? toDirectImageUrl(emp.photo_url) : null
  const fullName = [emp.first_name, emp.middle_initial ? emp.middle_initial.replace('.','')+'.' : '', emp.last_name]
    .filter(Boolean).join(' ').toUpperCase()

  const upd = useCallback((id, vals) => {
    onChange({ ...layout, [id]: { ...layout[id], ...vals } })
  }, [layout, onChange])

  const sel = selected ? layout[selected] : null

  const handleAiAdjust = async () => {
    setAiLoading(true)
    try {
      const newLayout = await aiAnalyzeTemplate()
      onChange(newLayout)
      setSelected(null)
      onSave(newLayout)
      toast('✅ AI layout applied and saved!')
    } catch (err) {
      console.error('AI adjust error:', err)
      alert('AI adjust failed: ' + err.message)
    } finally {
      setAiLoading(false)
    }
  }

  // Simple toast fallback if react-hot-toast not in scope
  function toast(msg) {
    const el = document.createElement('div')
    el.textContent = msg
    Object.assign(el.style, {
      position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
      background:'#1a3a8f', color:'white', padding:'10px 20px', borderRadius:'8px',
      fontSize:'14px', fontWeight:'600', zIndex:'9999', boxShadow:'0 4px 12px rgba(0,0,0,.2)',
    })
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3000)
  }

  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>

      {/* ── CARD CANVAS ── */}
      <div style={{ flexShrink:0 }}>
        <div style={{ fontSize:'0.72rem', color:'var(--gray-400)', marginBottom:6, textAlign:'center' }}>
          Click → select &nbsp;·&nbsp; Drag → move &nbsp;·&nbsp; ■ corner → resize
        </div>
        <div
          onMouseDown={() => setSelected(null)}
          style={{
            width:EDITOR_PX, height:EDITOR_H,
            position:'relative', overflow:'hidden',
            boxShadow:'0 4px 20px rgba(0,0,0,.18)',
            cursor:'default', userSelect:'none', flexShrink:0,
          }}
        >
          <img src="/id-template-blank.png" alt="" draggable={false}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill', pointerEvents:'none' }} />

          <DragElement id="photo" layout={layout.photo} selected={selected==='photo'} onSelect={setSelected} onChange={upd}>
            {photo
              ? <img src={photo} draggable={false} style={{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'top center',display:'block',pointerEvents:'none' }} />
              : <div style={{ width:'100%',height:'100%',background:'rgba(200,210,230,0.35)',display:'flex',alignItems:'center',justifyContent:'center',color:'#aaa',fontSize:10,fontFamily:'Arial',pointerEvents:'none' }}>NO PHOTO</div>
            }
          </DragElement>

          <DragElement id="name" layout={layout.name} selected={selected==='name'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize:fsPx(layout.name.fontSize), fontWeight:layout.name.bold?900:400, color:layout.name.color, textAlign:layout.name.align, fontFamily:"'Arial Black',Arial,sans-serif", textTransform:'uppercase', lineHeight:1.15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', pointerEvents:'none' }}>
              {fullName}
            </div>
          </DragElement>

          <DragElement id="position" layout={layout.position} selected={selected==='position'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize:fsPx(layout.position.fontSize), fontWeight:layout.position.bold?700:400, color:layout.position.color, textAlign:layout.position.align, fontFamily:'Arial,sans-serif', textTransform:'uppercase', letterSpacing:'0.06em', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', pointerEvents:'none' }}>
              {emp.position}
            </div>
          </DragElement>

          <DragElement id="department" layout={layout.department} selected={selected==='department'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize:fsPx(layout.department.fontSize), fontWeight:layout.department.bold?900:400, color:layout.department.color, textAlign:layout.department.align, fontFamily:"'Arial Black',Arial,sans-serif", textTransform:'uppercase', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', pointerEvents:'none' }}>
              {emp.department}
            </div>
          </DragElement>

          {qrDataUrl && (
            <DragElement id="qr" layout={layout.qr} selected={selected==='qr'} onSelect={setSelected} onChange={upd}>
              <img src={qrDataUrl} draggable={false} style={{ width:'100%',height:'auto',imageRendering:'pixelated',display:'block',pointerEvents:'none' }} />
            </DragElement>
          )}

          <DragElement id="qrLabel" layout={layout.qrLabel} selected={selected==='qrLabel'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize:fsPx(layout.qrLabel.fontSize), fontWeight:layout.qrLabel.bold?700:400, color:layout.qrLabel.color, textAlign:layout.qrLabel.align, fontFamily:'Arial,sans-serif', letterSpacing:'0.06em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', pointerEvents:'none' }}>
              {emp.employee_id || 'HRMO-2026-0001'}
            </div>
          </DragElement>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex:1, minWidth:220, display:'flex', flexDirection:'column', gap:14 }}>

        {/* AI Auto-Adjust */}
        <div style={{ background:'linear-gradient(135deg,#1a3a8f,#2d52b5)', borderRadius:'var(--r)', padding:'14px 16px', color:'white' }}>
          <div style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
            <Sparkles size={15}/> AI Auto-Adjust Layout
          </div>
          <div style={{ fontSize:'0.78rem', opacity:0.8, marginBottom:12, lineHeight:1.5 }}>
            I-analyze ng AI ang template at auto-set ang exact positions. I-click lang.
          </div>
          <button
            onClick={handleAiAdjust}
            disabled={aiLoading}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              width:'100%', padding:'10px 16px',
              background: aiLoading ? 'rgba(255,255,255,0.1)' : 'white',
              color: aiLoading ? 'rgba(255,255,255,0.5)' : '#1a3a8f',
              border:'none', borderRadius:8, fontSize:'0.875rem', fontWeight:700,
              cursor: aiLoading ? 'wait' : 'pointer', fontFamily:'var(--font)',
            }}
          >
            {aiLoading
              ? <><Loader2 size={15} style={{ animation:'spin 0.8s linear infinite' }}/> Analyzing...</>
              : <><Sparkles size={15}/> Auto-Adjust with AI</>
            }
          </button>
        </div>

        {/* Element list */}
        <div>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
            Manual Adjust
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {ELEMENTS.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setSelected(selected===id ? null : id)} style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'7px 10px',
                border: selected===id ? '1.5px solid var(--primary)' : '1px solid var(--gray-200)',
                borderRadius:6,
                background: selected===id ? 'var(--primary-light)' : 'white',
                cursor:'pointer', fontSize:'0.8rem',
                color: selected===id ? 'var(--primary)' : 'var(--gray-700)',
                fontWeight: selected===id ? 600 : 400,
                fontFamily:'var(--font)', transition:'all .12s',
              }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Properties */}
        {sel && (
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
              Properties
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[['x','X (%)'],['y','Y (%)'],['w','Width (%)'], ...(sel.h!==undefined ? [['h','Height (%)']] : [])].map(([k,lbl]) => (
                  <div key={k}>
                    <label style={{ fontSize:'0.7rem', color:'var(--gray-500)', display:'block', marginBottom:2 }}>{lbl}</label>
                    <input type="number" step="0.5" className="form-input" style={{ padding:'5px 8px', fontSize:'0.8rem' }}
                      value={Math.round(sel[k]*10)/10}
                      onChange={e => upd(selected, { [k]: parseFloat(e.target.value)||0 })} />
                  </div>
                ))}
              </div>
              {sel.fontSize !== undefined && (
                <>
                  <div>
                    <label style={{ fontSize:'0.7rem', color:'var(--gray-500)', display:'block', marginBottom:2 }}>Font Size (%)</label>
                    <input type="number" step="0.1" className="form-input" style={{ padding:'5px 8px', fontSize:'0.8rem' }}
                      value={Math.round(sel.fontSize*10)/10}
                      onChange={e => upd(selected, { fontSize: parseFloat(e.target.value)||1 })} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:6, alignItems:'center' }}>
                    <input type="color" value={sel.color}
                      onChange={e => upd(selected, { color: e.target.value })}
                      style={{ width:32, height:28, border:'1px solid var(--gray-200)', borderRadius:4, cursor:'pointer', padding:2 }} />
                    <input className="form-input" value={sel.color}
                      onChange={e => upd(selected, { color: e.target.value })}
                      style={{ padding:'5px 8px', fontSize:'0.8rem' }} />
                  </div>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <select className="form-select" style={{ padding:'5px 8px', fontSize:'0.8rem', flex:1 }}
                      value={sel.align} onChange={e => upd(selected, { align: e.target.value })}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                    <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', color:'var(--gray-700)', cursor:'pointer', whiteSpace:'nowrap' }}>
                      <input type="checkbox" checked={!!sel.bold} onChange={e => upd(selected, { bold: e.target.checked })} />
                      Bold
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Save / Reset */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => onSave()} style={{ width:'100%' }}>
            <Save size={13}/> Save Layout
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { onChange(DEFAULT_LAYOUT); setSelected(null) }} style={{ width:'100%' }}>
            <RotateCcw size={13}/> Reset to Default
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
