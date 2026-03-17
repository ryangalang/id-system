import { useState, useRef, useCallback } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { toDirectImageUrl } from '../lib/driveUtils'

export const DEFAULT_LAYOUT = {
  photo:      { x: 10,  y: 17.5, w: 80,  h: 38   },
  name:       { x: 2,   y: 57,   w: 96,  fontSize: 3.6,  bold: true,  color: '#1a1a2e', align: 'center' },
  position:   { x: 2,   y: 67,   w: 96,  fontSize: 2.6,  bold: false, color: '#333333', align: 'center' },
  department: { x: 2,   y: 71.5, w: 96,  fontSize: 3.0,  bold: true,  color: '#1a1a1a', align: 'center' },
  qr:         { x: 34,  y: 77,   w: 32  },
  qrLabel:    { x: 2,   y: 90,   w: 96,  fontSize: 2.2,  bold: false, color: '#444444', align: 'center' },
}

const HANDLE = 9
// Editor card renders at this fixed pixel width for drag math
const EDITOR_PX = 320
const EDITOR_H  = Math.round(EDITOR_PX * (2000 / 1414))

function fsPx(pct) { return Math.max(1, (pct / 100) * EDITOR_PX) }

function DragElement({ id, layout, selected, onSelect, onChange, children }) {
  const ref = useRef()
  const drag = useRef(null)

  const down = useCallback((e, type) => {
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
    const up = () => { drag.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [id, layout, onSelect, onChange])

  return (
    <div ref={ref} onMouseDown={(e) => down(e, 'move')} style={{
      position: 'absolute',
      left: `${layout.x}%`, top: `${layout.y}%`,
      width: `${layout.w}%`,
      height: layout.h !== undefined ? `${layout.h}%` : 'auto',
      cursor: 'move',
      outline: selected ? '1.5px dashed #1a56db' : '1px dashed transparent',
      boxSizing: 'border-box', userSelect: 'none',
    }}>
      {children}
      {selected && (
        <div onMouseDown={(e) => down(e, 'se')} style={{
          position: 'absolute', bottom: -HANDLE/2, right: -HANDLE/2,
          width: HANDLE, height: HANDLE,
          background: '#1a56db', borderRadius: 2, cursor: 'se-resize', zIndex: 10,
        }} />
      )}
    </div>
  )
}

export default function IDEditor({ employee, qrDataUrl, layout, onChange, onSave }) {
  const [selected, setSelected] = useState(null)

  const emp = employee || { first_name: 'JUAN', last_name: 'DELA CRUZ', middle_initial: 'S', position: 'Administrative Assistant I', department: 'Human Resource Management Office', employee_id: 'HRMO-24-0001' }
  const photo = emp.photo_url ? toDirectImageUrl(emp.photo_url) : null

  const nameParts = [emp.first_name, emp.middle_initial ? emp.middle_initial.replace('.','')+'.' : '', emp.last_name].filter(Boolean)
  const fullName = nameParts.join(' ').toUpperCase()

  const upd = useCallback((id, vals) => onChange({ ...layout, [id]: { ...layout[id], ...vals } }), [layout, onChange])
  const p = v => `${v}%`

  const sel = selected ? layout[selected] : null

  const ELEMENTS = [
    { id: 'photo',      label: 'Photo',             icon: '🖼️' },
    { id: 'name',       label: 'Name',              icon: '✏️' },
    { id: 'position',   label: 'Position',          icon: '📋' },
    { id: 'department', label: 'Department',        icon: '🏢' },
    { id: 'qr',         label: 'QR Code',           icon: '⬛' },
    { id: 'qrLabel',    label: 'Employee ID Label', icon: '🔖' },
  ]

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* Card Canvas */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: 6, textAlign: 'center' }}>
          Click to select · Drag to move · Drag ■ corner to resize
        </div>
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null) }} style={{
          width: EDITOR_PX, height: EDITOR_H,
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,.18)', cursor: 'default', userSelect: 'none', flexShrink: 0,
        }}>
          <img src="/id-template-blank.png" alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }} />

          {/* PHOTO */}
          <DragElement id="photo" layout={layout.photo} selected={selected==='photo'} onSelect={setSelected} onChange={upd}>
            {photo
              ? <img src={photo} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block', pointerEvents: 'none' }} />
              : <div style={{ width: '100%', height: '100%', background: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 10, fontFamily: 'Arial', pointerEvents: 'none' }}>NO PHOTO</div>
            }
          </DragElement>

          {/* NAME */}
          <DragElement id="name" layout={layout.name} selected={selected==='name'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize: fsPx(layout.name.fontSize), fontWeight: layout.name.bold?900:400, color: layout.name.color, textAlign: layout.name.align, fontFamily: "'Arial Black',Arial,sans-serif", textTransform: 'uppercase', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
              {fullName}
            </div>
          </DragElement>

          {/* POSITION */}
          <DragElement id="position" layout={layout.position} selected={selected==='position'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize: fsPx(layout.position.fontSize), fontWeight: layout.position.bold?700:400, color: layout.position.color, textAlign: layout.position.align, fontFamily: 'Arial,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
              {emp.position}
            </div>
          </DragElement>

          {/* DEPARTMENT */}
          <DragElement id="department" layout={layout.department} selected={selected==='department'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize: fsPx(layout.department.fontSize), fontWeight: layout.department.bold?900:400, color: layout.department.color, textAlign: layout.department.align, fontFamily: "'Arial Black',Arial,sans-serif", textTransform: 'uppercase', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
              {emp.department}
            </div>
          </DragElement>

          {/* QR */}
          {qrDataUrl && (
            <DragElement id="qr" layout={layout.qr} selected={selected==='qr'} onSelect={setSelected} onChange={upd}>
              <img src={qrDataUrl} draggable={false} style={{ width: '100%', height: 'auto', imageRendering: 'pixelated', display: 'block', pointerEvents: 'none' }} />
            </DragElement>
          )}

          {/* QR LABEL */}
          <DragElement id="qrLabel" layout={layout.qrLabel} selected={selected==='qrLabel'} onSelect={setSelected} onChange={upd}>
            <div style={{ fontSize: fsPx(layout.qrLabel.fontSize), fontWeight: layout.qrLabel.bold?700:400, color: layout.qrLabel.color, textAlign: layout.qrLabel.align, fontFamily: 'Arial,sans-serif', letterSpacing: '0.06em', pointerEvents: 'none' }}>
              {emp.employee_id || 'HRMO-24-0001'}
            </div>
          </DragElement>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Element list */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Elements</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {ELEMENTS.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setSelected(selected===id?null:id)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', border: selected===id ? '1.5px solid var(--primary)' : '1px solid var(--gray-200)',
                borderRadius: 6, background: selected===id ? 'var(--primary-light)' : 'white',
                cursor: 'pointer', fontSize: '0.8125rem',
                color: selected===id ? 'var(--primary)' : 'var(--gray-700)',
                fontWeight: selected===id ? 600 : 400,
              }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Properties */}
        {sel && (
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Properties — {ELEMENTS.find(e=>e.id===selected)?.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[['X (%)', 'x'], ['Y (%)', 'y'], ['Width (%)', 'w'], ...(sel.h !== undefined ? [['Height (%)', 'h']] : [])].map(([lbl, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--gray-500)', display: 'block', marginBottom: 2 }}>{lbl}</label>
                    <input type="number" step="0.5" className="form-input" style={{ padding: '5px 7px', fontSize: '0.8rem' }}
                      value={Math.round(sel[key] * 10) / 10}
                      onChange={e => upd(selected, { [key]: parseFloat(e.target.value) || 0 })} />
                  </div>
                ))}
              </div>

              {sel.fontSize !== undefined && (
                <>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--gray-500)', display: 'block', marginBottom: 2 }}>Font Size (% of card width)</label>
                    <input type="number" step="0.1" className="form-input" style={{ padding: '5px 7px', fontSize: '0.8rem' }}
                      value={Math.round(sel.fontSize * 10) / 10}
                      onChange={e => upd(selected, { fontSize: parseFloat(e.target.value) || 1 })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--gray-500)', display: 'block', marginBottom: 2 }}>Text Color</label>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <input type="color" value={sel.color} onChange={e => upd(selected, { color: e.target.value })}
                          style={{ width: 34, height: 28, border: '1px solid var(--gray-200)', borderRadius: 4, cursor: 'pointer', padding: 2 }} />
                        <input className="form-input" value={sel.color} onChange={e => upd(selected, { color: e.target.value })}
                          style={{ padding: '5px 7px', fontSize: '0.78rem', flex: 1 }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--gray-500)', display: 'block', marginBottom: 2 }}>Align</label>
                      <select className="form-select" style={{ padding: '5px 7px', fontSize: '0.8rem' }}
                        value={sel.align} onChange={e => upd(selected, { align: e.target.value })}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input type="checkbox" checked={sel.bold} onChange={e => upd(selected, { bold: e.target.checked })} />
                    Bold
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <button className="btn btn-primary btn-sm" onClick={onSave} style={{ width: '100%' }}>
            <Save size={13} /> Save Layout
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { onChange(DEFAULT_LAYOUT); setSelected(null) }} style={{ width: '100%' }}>
            <RotateCcw size={13} /> Reset to Default
          </button>
        </div>
      </div>
    </div>
  )
}
