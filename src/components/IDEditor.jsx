import { useState, useRef, useCallback, useEffect } from 'react'
import { Move, ZoomIn, ZoomOut, RotateCcw, Save, X, Type, Image, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'

// Default layout — all values are % of card width/height
export const DEFAULT_LAYOUT = {
  photo: { x: 10, y: 17.5, w: 80, h: 39 },
  name: { x: 2, y: 57, w: 96, fontSize: 3.5, bold: true, color: '#1a1a2e', align: 'center' },
  position: { x: 2, y: 66.5, w: 96, fontSize: 2.7, bold: false, color: '#333333', align: 'center' },
  department: { x: 2, y: 70.5, w: 96, fontSize: 3.0, bold: true, color: '#1a1a1a', align: 'center' },
  qr: { x: 32, y: 76, w: 36 },
  qrLabel: { x: 2, y: 89, w: 96, fontSize: 2.3, bold: false, color: '#444444', align: 'center' },
}

const HANDLE_SIZE = 10

function ResizableElement({ id, layout, selected, onSelect, onChange, children, style = {} }) {
  const elRef = useRef()
  const dragRef = useRef(null)

  const startDrag = useCallback((e, type) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(id)
    const rect = elRef.current.parentElement.getBoundingClientRect()
    const parentW = rect.width
    const parentH = rect.height

    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startLayout: { ...layout },
      parentW,
      parentH,
    }

    const onMove = (e) => {
      if (!dragRef.current) return
      const { type, startX, startY, startLayout, parentW, parentH } = dragRef.current
      const dx = ((e.clientX - startX) / parentW) * 100
      const dy = ((e.clientY - startY) / parentH) * 100

      if (type === 'move') {
        onChange(id, {
          x: Math.max(0, Math.min(100 - startLayout.w, startLayout.x + dx)),
          y: Math.max(0, Math.min(100 - (startLayout.h || 5), startLayout.y + dy)),
        })
      } else if (type === 'resize-se') {
        onChange(id, {
          w: Math.max(10, startLayout.w + dx),
          h: startLayout.h !== undefined ? Math.max(5, startLayout.h + dy) : undefined,
        })
      } else if (type === 'resize-e') {
        onChange(id, { w: Math.max(10, startLayout.w + dx) })
      }
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [id, layout, onSelect, onChange])

  const h = layout.h !== undefined ? `${layout.h}%` : 'auto'

  return (
    <div
      ref={elRef}
      onMouseDown={(e) => startDrag(e, 'move')}
      style={{
        position: 'absolute',
        left: `${layout.x}%`,
        top: `${layout.y}%`,
        width: `${layout.w}%`,
        height: h,
        cursor: 'move',
        boxSizing: 'border-box',
        outline: selected ? '1.5px dashed #1a56db' : '1px dashed transparent',
        userSelect: 'none',
        ...style,
      }}
    >
      {children}

      {selected && (
        <>
          {/* SE resize handle */}
          <div
            onMouseDown={(e) => startDrag(e, 'resize-se')}
            style={{
              position: 'absolute', bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2,
              width: HANDLE_SIZE, height: HANDLE_SIZE,
              background: '#1a56db', borderRadius: 2,
              cursor: 'se-resize', zIndex: 10,
            }}
          />
          {/* E resize handle */}
          <div
            onMouseDown={(e) => startDrag(e, 'resize-e')}
            style={{
              position: 'absolute', top: '50%', right: -HANDLE_SIZE/2,
              transform: 'translateY(-50%)',
              width: HANDLE_SIZE, height: HANDLE_SIZE,
              background: '#1a56db', borderRadius: 2,
              cursor: 'e-resize', zIndex: 10,
            }}
          />
        </>
      )}
    </div>
  )
}

export default function IDEditor({ employee, qrDataUrl, layout, onChange, onSave }) {
  const [selected, setSelected] = useState(null)
  const cardRef = useRef()

  // Card preview width in px (displayed at fixed width for editing)
  const CARD_PX = 320
  const CARD_RATIO = 2000 / 1414
  const CARD_H = Math.round(CARD_PX * CARD_RATIO)

  const nameParts = [
    employee?.first_name,
    employee?.middle_initial ? employee.middle_initial.replace('.', '') + '.' : '',
    employee?.last_name,
  ].filter(Boolean)
  const fullName = nameParts.join(' ').toUpperCase()

  const handleChange = useCallback((id, updates) => {
    onChange({ ...layout, [id]: { ...layout[id], ...updates } })
  }, [layout, onChange])

  const handleDeselect = (e) => {
    if (e.target === cardRef.current || e.target.tagName === 'IMG') {
      setSelected(null)
    }
  }

  // Convert % fontSize to px for display
  const pct2px = (pct) => (pct / 100) * CARD_PX

  const sel = selected ? layout[selected] : null

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

      {/* ── CARD CANVAS ── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          fontSize: '0.75rem', color: 'var(--gray-400)',
          marginBottom: 6, textAlign: 'center', fontWeight: 500
        }}>
          Click element to select · Drag to move · Drag corner to resize
        </div>
        <div
          ref={cardRef}
          onMouseDown={handleDeselect}
          style={{
            width: CARD_PX,
            height: CARD_H,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            cursor: 'default',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {/* Template background */}
          <img
            src="/id-template-blank.png"
            alt=""
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />

          {/* PHOTO */}
          <ResizableElement id="photo" layout={layout.photo} selected={selected === 'photo'}
            onSelect={setSelected} onChange={handleChange}>
            {employee?.photo_url ? (
              <img
                src={employee.photo_url}
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block', pointerEvents: 'none' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 11, fontFamily: 'Arial' }}>
                NO PHOTO
              </div>
            )}
          </ResizableElement>

          {/* NAME */}
          <ResizableElement id="name" layout={layout.name} selected={selected === 'name'}
            onSelect={setSelected} onChange={handleChange}>
            <div style={{
              fontSize: pct2px(layout.name.fontSize),
              fontWeight: layout.name.bold ? 900 : 400,
              color: layout.name.color,
              textAlign: layout.name.align,
              fontFamily: "'Arial Black', Arial, sans-serif",
              textTransform: 'uppercase',
              lineHeight: 1.2,
              width: '100%',
              pointerEvents: 'none',
            }}>
              {fullName || 'EMPLOYEE NAME'}
            </div>
          </ResizableElement>

          {/* POSITION */}
          <ResizableElement id="position" layout={layout.position} selected={selected === 'position'}
            onSelect={setSelected} onChange={handleChange}>
            <div style={{
              fontSize: pct2px(layout.position.fontSize),
              fontWeight: layout.position.bold ? 700 : 400,
              color: layout.position.color,
              textAlign: layout.position.align,
              fontFamily: 'Arial, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              lineHeight: 1.3,
              width: '100%',
              pointerEvents: 'none',
            }}>
              {employee?.position || 'POSITION TITLE'}
            </div>
          </ResizableElement>

          {/* DEPARTMENT */}
          <ResizableElement id="department" layout={layout.department} selected={selected === 'department'}
            onSelect={setSelected} onChange={handleChange}>
            <div style={{
              fontSize: pct2px(layout.department.fontSize),
              fontWeight: layout.department.bold ? 900 : 400,
              color: layout.department.color,
              textAlign: layout.department.align,
              fontFamily: "'Arial Black', Arial, sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              lineHeight: 1.2,
              width: '100%',
              pointerEvents: 'none',
            }}>
              {employee?.department || 'DEPARTMENT / OFFICE'}
            </div>
          </ResizableElement>

          {/* QR CODE */}
          {qrDataUrl && (
            <ResizableElement id="qr" layout={layout.qr} selected={selected === 'qr'}
              onSelect={setSelected} onChange={handleChange}>
              <img
                src={qrDataUrl}
                draggable={false}
                style={{ width: '100%', height: 'auto', imageRendering: 'pixelated', display: 'block', pointerEvents: 'none' }}
              />
            </ResizableElement>
          )}

          {/* QR LABEL */}
          <ResizableElement id="qrLabel" layout={layout.qrLabel} selected={selected === 'qrLabel'}
            onSelect={setSelected} onChange={handleChange}>
            <div style={{
              fontSize: pct2px(layout.qrLabel.fontSize),
              fontWeight: layout.qrLabel.bold ? 700 : 400,
              color: layout.qrLabel.color,
              textAlign: layout.qrLabel.align,
              fontFamily: 'Arial, sans-serif',
              letterSpacing: '0.06em',
              width: '100%',
              pointerEvents: 'none',
            }}>
              {employee?.employee_id || 'EMPLOYEE-ID'}
            </div>
          </ResizableElement>
        </div>
      </div>

      {/* ── PROPERTIES PANEL ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Element list */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Elements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { id: 'photo', label: 'Photo', icon: '🖼️' },
              { id: 'name', label: 'Name', icon: '✏️' },
              { id: 'position', label: 'Position', icon: '📋' },
              { id: 'department', label: 'Department', icon: '🏢' },
              { id: 'qr', label: 'QR Code', icon: '⬛' },
              { id: 'qrLabel', label: 'Employee ID Label', icon: '🔖' },
            ].map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setSelected(selected === id ? null : id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px',
                  border: selected === id ? '1.5px solid var(--primary)' : '1px solid var(--gray-200)',
                  borderRadius: 6,
                  background: selected === id ? 'var(--primary-light)' : 'white',
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: '0.8125rem',
                  color: selected === id ? 'var(--primary)' : 'var(--gray-700)',
                  fontWeight: selected === id ? 600 : 400,
                  transition: 'all 0.12s',
                }}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Properties for selected element */}
        {sel && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Properties
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Position controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)', display: 'block', marginBottom: 3 }}>X (%)</label>
                  <input type="number" className="form-input" style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                    value={Math.round(sel.x * 10) / 10}
                    onChange={e => handleChange(selected, { x: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)', display: 'block', marginBottom: 3 }}>Y (%)</label>
                  <input type="number" className="form-input" style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                    value={Math.round(sel.y * 10) / 10}
                    onChange={e => handleChange(selected, { y: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)', display: 'block', marginBottom: 3 }}>Width (%)</label>
                  <input type="number" className="form-input" style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                    value={Math.round(sel.w * 10) / 10}
                    onChange={e => handleChange(selected, { w: parseFloat(e.target.value) || 10 })}
                  />
                </div>
                {sel.h !== undefined && (
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)', display: 'block', marginBottom: 3 }}>Height (%)</label>
                    <input type="number" className="form-input" style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                      value={Math.round(sel.h * 10) / 10}
                      onChange={e => handleChange(selected, { h: parseFloat(e.target.value) || 5 })}
                    />
                  </div>
                )}
              </div>

              {/* Text controls */}
              {sel.fontSize !== undefined && (
                <>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)', display: 'block', marginBottom: 3 }}>Font Size (%)</label>
                    <input type="number" step="0.1" className="form-input" style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                      value={Math.round(sel.fontSize * 10) / 10}
                      onChange={e => handleChange(selected, { fontSize: parseFloat(e.target.value) || 2 })}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)', display: 'block', marginBottom: 3 }}>Color</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="color" value={sel.color}
                          onChange={e => handleChange(selected, { color: e.target.value })}
                          style={{ width: 36, height: 30, border: '1px solid var(--gray-200)', borderRadius: 4, cursor: 'pointer', padding: 2 }}
                        />
                        <input className="form-input" value={sel.color}
                          onChange={e => handleChange(selected, { color: e.target.value })}
                          style={{ padding: '5px 8px', fontSize: '0.8rem', flex: 1 }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)', display: 'block', marginBottom: 3 }}>Align</label>
                      <select className="form-select" style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                        value={sel.align}
                        onChange={e => handleChange(selected, { align: e.target.value })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="bold-check" checked={sel.bold}
                      onChange={e => handleChange(selected, { bold: e.target.checked })}
                    />
                    <label htmlFor="bold-check" style={{ fontSize: '0.8rem', color: 'var(--gray-700)', cursor: 'pointer' }}>Bold</label>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={onSave} style={{ width: '100%' }}>
            <Save size={13} /> Save Layout
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onChange(DEFAULT_LAYOUT)} style={{ width: '100%' }}>
            <RotateCcw size={13} /> Reset to Default
          </button>
        </div>
      </div>
    </div>
  )
}
