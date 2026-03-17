import { toDirectImageUrl } from '../lib/driveUtils'
import { DEFAULT_LAYOUT } from './IDEditor'

export const ID_SIZES = {
  cr80: { label: 'CR80 Portrait (Standard)', width: '53.98mm', height: '76.36mm', pxW: 204, pxH: 289 },
  a6:   { label: 'A6 Portrait',              width: '74.25mm', height: '105mm',   pxW: 281, pxH: 397 },
  a5:   { label: 'A5 Portrait',              width: '105mm',   height: '148.5mm', pxW: 397, pxH: 561 },
}

export default function IDCard({ employee, size = 'cr80', qrDataUrl, layout }) {
  const L = layout || DEFAULT_LAYOUT
  const cfg = ID_SIZES[size]
  const photo = employee?.photo_url ? toDirectImageUrl(employee.photo_url) : null

  const fullName = [
    employee?.first_name,
    employee?.middle_initial ? employee.middle_initial.replace('.', '') + '.' : '',
    employee?.last_name,
  ].filter(Boolean).join(' ').toUpperCase()

  const p = v => `${v}%`

  // Convert layout fontSize (% of card width) → px for this card size
  const fpx = (pct) => `${Math.max(1, (pct / 100) * cfg.pxW).toFixed(1)}px`

  return (
    <div style={{
      width: cfg.width,
      height: cfg.height,
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      display: 'inline-block',
      verticalAlign: 'top',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
    }}>
      {/* Canva template background */}
      <img src="/id-template-blank.png" alt="" style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        objectFit: 'fill', display: 'block',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }} />

      {/* PHOTO */}
      <div style={{ position:'absolute', left:p(L.photo.x), top:p(L.photo.y), width:p(L.photo.w), height:p(L.photo.h), overflow:'hidden' }}>
        {photo
          ? <img src={photo} alt="" crossOrigin="anonymous" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', display:'block' }} />
          : <div style={{ width:'100%', height:'100%', background:'#e8eaf0' }} />
        }
      </div>

      {/* NAME */}
      <div style={{ position:'absolute', left:p(L.name.x), top:p(L.name.y), width:p(L.name.w), overflow:'hidden' }}>
        <div style={{ fontSize:fpx(L.name.fontSize), fontWeight:L.name.bold?900:400, color:L.name.color, textAlign:L.name.align, fontFamily:"'Arial Black',Arial,sans-serif", textTransform:'uppercase', lineHeight:1.15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {fullName || 'EMPLOYEE NAME'}
        </div>
      </div>

      {/* POSITION */}
      <div style={{ position:'absolute', left:p(L.position.x), top:p(L.position.y), width:p(L.position.w), overflow:'hidden' }}>
        <div style={{ fontSize:fpx(L.position.fontSize), fontWeight:L.position.bold?700:400, color:L.position.color, textAlign:L.position.align, fontFamily:'Arial,sans-serif', textTransform:'uppercase', letterSpacing:'0.06em', lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {employee?.position || ''}
        </div>
      </div>

      {/* DEPARTMENT */}
      <div style={{ position:'absolute', left:p(L.department.x), top:p(L.department.y), width:p(L.department.w), overflow:'hidden' }}>
        <div style={{ fontSize:fpx(L.department.fontSize), fontWeight:L.department.bold?900:400, color:L.department.color, textAlign:L.department.align, fontFamily:"'Arial Black',Arial,sans-serif", textTransform:'uppercase', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {employee?.department || ''}
        </div>
      </div>

      {/* QR */}
      {qrDataUrl && (
        <div style={{ position:'absolute', left:p(L.qr.x), top:p(L.qr.y), width:p(L.qr.w) }}>
          <img src={qrDataUrl} alt="QR" style={{ width:'100%', height:'auto', imageRendering:'pixelated', display:'block' }} />
        </div>
      )}

      {/* QR LABEL / EMPLOYEE ID */}
      <div style={{ position:'absolute', left:p(L.qrLabel.x), top:p(L.qrLabel.y), width:p(L.qrLabel.w), overflow:'hidden' }}>
        <div style={{ fontSize:fpx(L.qrLabel.fontSize), fontWeight:L.qrLabel.bold?700:400, color:L.qrLabel.color, textAlign:L.qrLabel.align, fontFamily:'Arial,sans-serif', letterSpacing:'0.06em' }}>
          {employee?.employee_id || ''}
        </div>
      </div>
    </div>
  )
}
