import { toDirectImageUrl } from '../lib/driveUtils'
import { DEFAULT_LAYOUT } from './IDEditor'

export const ID_SIZES = {
  cr80: { label: 'CR80 Portrait (Standard)', width: '53.98mm', height: '76.36mm' },
  a6:   { label: 'A6 Portrait',              width: '74.25mm', height: '105mm'   },
  a5:   { label: 'A5 Portrait',              width: '105mm',   height: '148.5mm' },
}

export default function IDCard({ employee, size = 'cr80', qrDataUrl, layout }) {
  const L = layout || DEFAULT_LAYOUT
  const cfg = ID_SIZES[size]
  const photo = employee?.photo_url ? toDirectImageUrl(employee.photo_url) : null

  const nameParts = [
    employee?.first_name,
    employee?.middle_initial ? employee.middle_initial.replace('.','') + '.' : '',
    employee?.last_name,
  ].filter(Boolean)
  const fullName = nameParts.join(' ').toUpperCase()

  // fontSize in layout is % of card width — convert to vw-like using % of container
  const pct = (v) => `${v}%`

  return (
    <div style={{
      width: cfg.width,
      height: cfg.height,
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      display: 'inline-block',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
    }}>
      {/* Canva template background */}
      <img src="/id-template-blank.png" alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
      />

      {/* PHOTO */}
      <div style={{ position: 'absolute', left: pct(L.photo.x), top: pct(L.photo.y), width: pct(L.photo.w), height: pct(L.photo.h), overflow: 'hidden' }}>
        {photo
          ? <img src={photo} alt="Employee" crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', background: '#e8eaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '8px', fontFamily: 'Arial' }}>NO PHOTO</div>
        }
      </div>

      {/* NAME */}
      <div style={{ position: 'absolute', left: pct(L.name.x), top: pct(L.name.y), width: pct(L.name.w) }}>
        <div style={{ fontSize: `${L.name.fontSize}cqw`, fontWeight: L.name.bold ? 900 : 400, color: L.name.color, textAlign: L.name.align, fontFamily: "'Arial Black',Arial,sans-serif", textTransform: 'uppercase', lineHeight: 1.2 }}>
          {fullName || 'EMPLOYEE NAME'}
        </div>
      </div>

      {/* POSITION */}
      <div style={{ position: 'absolute', left: pct(L.position.x), top: pct(L.position.y), width: pct(L.position.w) }}>
        <div style={{ fontSize: `${L.position.fontSize}cqw`, fontWeight: L.position.bold ? 700 : 400, color: L.position.color, textAlign: L.position.align, fontFamily: 'Arial,sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1.3 }}>
          {employee?.position || ''}
        </div>
      </div>

      {/* DEPARTMENT */}
      <div style={{ position: 'absolute', left: pct(L.department.x), top: pct(L.department.y), width: pct(L.department.w) }}>
        <div style={{ fontSize: `${L.department.fontSize}cqw`, fontWeight: L.department.bold ? 900 : 400, color: L.department.color, textAlign: L.department.align, fontFamily: "'Arial Black',Arial,sans-serif", textTransform: 'uppercase', lineHeight: 1.2 }}>
          {employee?.department || ''}
        </div>
      </div>

      {/* QR CODE */}
      {qrDataUrl && (
        <div style={{ position: 'absolute', left: pct(L.qr.x), top: pct(L.qr.y), width: pct(L.qr.w) }}>
          <img src={qrDataUrl} alt="QR"
            style={{ width: '100%', height: 'auto', imageRendering: 'pixelated', display: 'block' }} />
        </div>
      )}

      {/* QR LABEL */}
      <div style={{ position: 'absolute', left: pct(L.qrLabel.x), top: pct(L.qrLabel.y), width: pct(L.qrLabel.w) }}>
        <div style={{ fontSize: `${L.qrLabel.fontSize}cqw`, fontWeight: L.qrLabel.bold ? 700 : 400, color: L.qrLabel.color, textAlign: L.qrLabel.align, fontFamily: 'Arial,sans-serif', letterSpacing: '0.06em' }}>
          {employee?.employee_id || ''}
        </div>
      </div>
    </div>
  )
}
