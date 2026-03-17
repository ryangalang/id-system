import { toDirectImageUrl } from './driveUtils'
import { DEFAULT_LAYOUT } from '../components/IDEditor'

const SIZES = {
  cr80: { w: '53.98mm', h: '76.36mm'  },
  a6:   { w: '74.25mm', h: '105mm'    },
  a5:   { w: '105mm',   h: '148.5mm'  },
}

function buildCardHTML(emp, size, qrDataUrl, layout, templateUrl) {
  const L = layout || DEFAULT_LAYOUT
  const cfg = SIZES[size]
  const photo = emp.photo_url ? toDirectImageUrl(emp.photo_url) : null

  const nameParts = [emp.first_name, emp.middle_initial ? emp.middle_initial.replace('.','')+'.' : '', emp.last_name].filter(Boolean)
  const fullName = nameParts.join(' ').toUpperCase()

  const pct = v => `${v}%`

  // fontSize as % of card width — use vw equivalent via % of container
  const fsStyle = (pct, bold, color, align, font) =>
    `font-size:${pct}cqw;font-weight:${bold?900:400};color:${color};text-align:${align};font-family:${font};`

  const photoHTML = photo
    ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;" crossorigin="anonymous"/>`
    : `<div style="width:100%;height:100%;background:#e8eaf0;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:8px;font-family:Arial;">NO PHOTO</div>`

  return `
  <div style="width:${cfg.w};height:${cfg.h};position:relative;overflow:hidden;display:inline-block;flex-shrink:0;container-type:inline-size;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <img src="${templateUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact;"/>

    <div style="position:absolute;left:${pct(L.photo.x)};top:${pct(L.photo.y)};width:${pct(L.photo.w)};height:${pct(L.photo.h)};overflow:hidden;">
      ${photoHTML}
    </div>

    <div style="position:absolute;left:${pct(L.name.x)};top:${pct(L.name.y)};width:${pct(L.name.w)};">
      <div style="${fsStyle(L.name.fontSize,L.name.bold,L.name.color,L.name.align,"'Arial Black',Arial,sans-serif")}text-transform:uppercase;line-height:1.2;">
        ${fullName || 'EMPLOYEE NAME'}
      </div>
    </div>

    <div style="position:absolute;left:${pct(L.position.x)};top:${pct(L.position.y)};width:${pct(L.position.w)};">
      <div style="${fsStyle(L.position.fontSize,L.position.bold,L.position.color,L.position.align,'Arial,sans-serif')}text-transform:uppercase;letter-spacing:0.07em;line-height:1.3;">
        ${emp.position || ''}
      </div>
    </div>

    <div style="position:absolute;left:${pct(L.department.x)};top:${pct(L.department.y)};width:${pct(L.department.w)};">
      <div style="${fsStyle(L.department.fontSize,L.department.bold,L.department.color,L.department.align,"'Arial Black',Arial,sans-serif")}text-transform:uppercase;line-height:1.2;">
        ${emp.department || ''}
      </div>
    </div>

    ${qrDataUrl ? `
    <div style="position:absolute;left:${pct(L.qr.x)};top:${pct(L.qr.y)};width:${pct(L.qr.w)};">
      <img src="${qrDataUrl}" style="width:100%;height:auto;image-rendering:pixelated;display:block;"/>
    </div>
    <div style="position:absolute;left:${pct(L.qrLabel.x)};top:${pct(L.qrLabel.y)};width:${pct(L.qrLabel.w)};">
      <div style="${fsStyle(L.qrLabel.fontSize,L.qrLabel.bold,L.qrLabel.color,L.qrLabel.align,'Arial,sans-serif')}letter-spacing:0.06em;">
        ${emp.employee_id || ''}
      </div>
    </div>
    ` : ''}
  </div>`
}

export function openPrintWindow(queue, size, qrMap, layout) {
  if (!queue.length) return
  const cardsPerPage = size === 'cr80' ? 8 : size === 'a6' ? 4 : 2
  const templateUrl = window.location.origin + '/id-template-blank.png'
  const pages = []
  for (let i = 0; i < queue.length; i += cardsPerPage) pages.push(queue.slice(i, i + cardsPerPage))

  const pagesHTML = pages.map((emps, idx) => `
    <div class="page" style="display:flex;flex-wrap:wrap;gap:3mm;align-content:flex-start;page-break-after:${idx < pages.length-1?'always':'avoid'};">
      ${emps.map(emp => buildCardHTML(emp, size, qrMap[emp.id], layout, templateUrl)).join('')}
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Dagupan ID Cards</title>
<style>
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}
  body{background:#e0e0e0;font-family:Arial,sans-serif;}
  @page{size:A4 portrait;margin:8mm;}
  @media print{body{background:white;}.toolbar{display:none!important;}.content{margin-top:0!important;padding:0!important;}.page{box-shadow:none!important;background:transparent!important;padding:0!important;}}
  .toolbar{position:fixed;top:0;left:0;right:0;background:#1a3a8f;color:white;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999;}
  .print-btn{background:white;color:#1a3a8f;border:none;padding:10px 28px;border-radius:6px;font-size:15px;font-weight:700;cursor:pointer;}
  .print-btn:hover{background:#e8eef8;}
  .content{margin-top:56px;padding:16px;display:flex;flex-direction:column;gap:16px;}
  .page{background:white;padding:8mm;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.12);}
</style>
</head>
<body>
  <div class="toolbar">
    <div>
      <div style="font-weight:700;font-size:15px;">🖨️ City Government of Dagupan — ID Cards</div>
      <div style="font-size:12px;opacity:.85;margin-top:2px;">${queue.length} employee${queue.length!==1?'s':''} · ${pages.length} page${pages.length!==1?'s':''} · ${size.toUpperCase()}</div>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ &nbsp;Print Now</button>
  </div>
  <div class="content">${pagesHTML}</div>
</body>
</html>`

  const w = window.open('','_blank','width=960,height=800')
  if (!w) { alert('Pop-up blocked! Please allow pop-ups and try again.'); return }
  w.document.write(html)
  w.document.close()
}
