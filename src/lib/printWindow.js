import { toDirectImageUrl } from './driveUtils'
import { DEFAULT_LAYOUT } from '../components/IDEditor'

const CARD_SIZES = {
  cr80: { w: 53.98, h: 76.36,  perPage: 8  },
  a6:   { w: 74.25, h: 105,    perPage: 4  },
  a5:   { w: 105,   h: 148.5,  perPage: 2  },
}

// % of card width → mm (exact physical size)
const mm = (pct, base) => `${((pct / 100) * base).toFixed(3)}mm`
// % font size → mm
const fsmm = (pct, base) => `${Math.max(0.5, (pct / 100) * base).toFixed(3)}mm`

function buildCard(emp, size, qrUrl, L, tplUrl) {
  const { w, h } = CARD_SIZES[size]
  const photo = emp.photo_url ? toDirectImageUrl(emp.photo_url) : null
  const name = [emp.first_name, emp.middle_initial ? emp.middle_initial.replace('.','')+'.' : '', emp.last_name]
    .filter(Boolean).join(' ').toUpperCase()

  const p = v => `${v}%`   // positions stay as % of container
  const f = pct => fsmm(pct, w)  // font sizes in mm

  const fontFor = (fontKey) => {
    if (fontKey === 'montserrat') return "'Montserrat',Arial,sans-serif"
    if (fontKey === 'canva-sans') return "'DM Sans','Plus Jakarta Sans',Arial,sans-serif"
    return "Arial,sans-serif"
  }

  const textStyle = (el) =>
    `font-size:${f(el.fontSize)};font-weight:${el.bold?800:400};color:${el.color};text-align:${el.align};line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;width:100%;font-family:${fontFor(el.font)};`

  return `
<div style="width:${w}mm;height:${h}mm;position:relative;overflow:hidden;display:inline-block;vertical-align:top;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <img src="${tplUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;-webkit-print-color-adjust:exact;print-color-adjust:exact;" />

  <div style="position:absolute;left:${p(L.photo.x)};top:${p(L.photo.y)};width:${p(L.photo.w)};height:${p(L.photo.h)};overflow:hidden;">
    ${photo
      ? `<img src="${photo}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;-webkit-print-color-adjust:exact;" />`
      : `<div style="width:100%;height:100%;background:#e8eaf0;"></div>`
    }
  </div>

  <div style="position:absolute;left:${p(L.name.x)};top:${p(L.name.y)};width:${p(L.name.w)};overflow:hidden;">
    <span style="${textStyle(L.name)}font-family:'Arial Black',Arial,sans-serif;text-transform:uppercase;">${name}</span>
  </div>

  <div style="position:absolute;left:${p(L.position.x)};top:${p(L.position.y)};width:${p(L.position.w)};overflow:hidden;">
    <span style="${textStyle(L.position)}font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.06em;">${emp.position||''}</span>
  </div>

  <div style="position:absolute;left:${p(L.department.x)};top:${p(L.department.y)};width:${p(L.department.w)};overflow:hidden;">
    <span style="${textStyle(L.department)}font-family:'Arial Black',Arial,sans-serif;text-transform:uppercase;">${emp.department||''}</span>
  </div>

  ${qrUrl ? `
  <div style="position:absolute;left:${p(L.qr.x)};top:${p(L.qr.y)};width:${p(L.qr.w)};">
    <img src="${qrUrl}" style="width:100%;height:auto;image-rendering:pixelated;display:block;" />
  </div>
  <div style="position:absolute;left:${p(L.qrLabel.x)};top:${p(L.qrLabel.y)};width:${p(L.qrLabel.w)};overflow:hidden;">
    <span style="${textStyle(L.qrLabel)}font-family:Arial,sans-serif;letter-spacing:0.06em;">${emp.employee_id||''}</span>
  </div>` : ''}
</div>`
}

export function openPrintWindow(queue, size, qrMap, layout) {
  if (!queue.length) return

  const L = layout || DEFAULT_LAYOUT
  const { perPage } = CARD_SIZES[size]
  const tplUrl = window.location.origin + '/id-template-blank.png'

  // Build pages
  const pages = []
  for (let i = 0; i < queue.length; i += perPage) pages.push(queue.slice(i, i + perPage))

  const pagesHTML = pages.map((emps, idx) => `
<div style="display:flex;flex-wrap:wrap;gap:3mm;align-content:flex-start;${idx < pages.length-1 ? 'page-break-after:always;' : ''}">
  ${emps.map(e => buildCard(e, size, qrMap[e.id], L, tplUrl)).join('\n')}
</div>`).join('\n')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Dagupan ID Cards · ${queue.length} employees</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}
body{background:#dde3f0;font-family:'Plus Jakarta Sans',Arial,sans-serif;}
@page{size:A4 portrait;margin:8mm;}
@media print{
  body{background:white;}
  .toolbar{display:none!important;}
  .wrap{margin-top:0!important;padding:0!important;}
  .page-block{box-shadow:none!important;padding:0!important;border-radius:0!important;}
}
.toolbar{
  position:fixed;top:0;left:0;right:0;
  background:linear-gradient(135deg,#122a6a,#1a3a8f);
  color:white;padding:14px 24px;
  display:flex;align-items:center;justify-content:space-between;
  z-index:999;box-shadow:0 2px 12px rgba(0,0,0,.25);
}
.info-title{font-weight:800;font-size:15px;letter-spacing:.01em;}
.info-sub{font-size:12px;opacity:.7;margin-top:2px;}
.print-btn{
  background:white;color:#1a3a8f;border:none;
  padding:11px 28px;border-radius:8px;
  font-size:14px;font-weight:800;cursor:pointer;
  letter-spacing:.02em;
  box-shadow:0 2px 8px rgba(0,0,0,.15);
}
.print-btn:hover{background:#eef2fb;}
.wrap{margin-top:60px;padding:16px;display:flex;flex-direction:column;gap:14px;}
.page-block{background:white;padding:8mm;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.1);}
</style>
</head>
<body>
<div class="toolbar">
  <div>
    <div class="info-title">🖨️ City Government of Dagupan — Employee ID Cards</div>
    <div class="info-sub">${queue.length} employee${queue.length>1?'s':''} · ${pages.length} page${pages.length>1?'s':''} · Size: ${size.toUpperCase()} · ${CARD_SIZES[size].perPage} cards/page</div>
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ &nbsp; Print Now</button>
</div>
<div class="wrap">
  ${pages.map(emps => `<div class="page-block">${emps.map(e => buildCard(e, size, qrMap[e.id], L, tplUrl)).join('')}</div>`).join('\n')}
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) { alert('Pop-up blocked! Please allow pop-ups for this site.'); return }
  win.document.write(html)
  win.document.close()
}
