import QRCode from 'qrcode'
import { supabase } from './supabase'

// Department code map
export const DEPT_CODES = {
  'Human Resource Management Office': 'HRMO',
  'Office of the City Mayor':         'OMC',
  'City Administrator Office':        'CAO',
  'City Budget Office':               'CBO',
  'City Treasurer Office':            'CTO',
  'City Assessor Office':             'CASS',
  'City Civil Registrar':             'CCR',
  'City Engineer Office':             'CEO',
  'City Health Office':               'CHO',
  'City Social Welfare Office':       'CSWD',
  'City Planning Office':             'CPDO',
  'City Legal Office':                'CLO',
  'City Veterinary Office':           'CVET',
  'City Agriculture Office':          'CAGR',
  'General Services Office':          'GSO',
  'Information Technology Office':    'ICTD',
  'Public Order and Safety Office':   'POSO',
  'Tourism Office':                   'CTA',
}

export function getDeptCode(dept) {
  if (!dept) return 'EMP'
  for (const [name, code] of Object.entries(DEPT_CODES)) {
    if (dept.toLowerCase().includes(name.toLowerCase().split(' ')[0])) return code
  }
  return 'EMP'
}

// Auto-generate employee ID: DEPT-YEAR-SEQUENCE
export async function generateEmployeeId(dept) {
  const code = getDeptCode(dept)
  const year = new Date().getFullYear()
  const prefix = `${code}-${year}-`

  const { data } = await supabase
    .from('employees')
    .select('employee_id')
    .like('employee_id', `${prefix}%`)

  let maxSeq = 0
  ;(data || []).forEach(row => {
    const parts = (row.employee_id || '').split('-')
    const seq = parseInt(parts[parts.length - 1])
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  })

  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`
}

// Generate QR data URL
export async function generateQRDataUrl(employee) {
  const payload = JSON.stringify({
    id: employee.employee_id || employee.id,
    name: `${employee.first_name} ${employee.last_name}`,
    dept: employee.department || '',
  })
  return await QRCode.toDataURL(payload, {
    width: 300, margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
}

// Generate QR and save to Supabase
export async function generateAndSaveQR(employee) {
  const dataUrl = await generateQRDataUrl(employee)
  const { error } = await supabase
    .from('employees')
    .update({ qr_code: dataUrl })
    .eq('id', employee.id)
  if (error) throw error
  return dataUrl
}

// Batch generate QR for all employees without one
export async function batchGenerateQRs(onProgress) {
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id,first_name,last_name,department,employee_id')
    .is('qr_code', null)
  if (error) throw error
  if (!employees?.length) return 0

  let done = 0
  const BATCH = 10
  for (let i = 0; i < employees.length; i += BATCH) {
    const batch = employees.slice(i, i + BATCH)
    await Promise.all(batch.map(async emp => {
      try { await generateAndSaveQR(emp); done++ }
      catch (e) { console.error('QR gen failed', emp.id, e) }
    }))
    if (onProgress) onProgress(done, employees.length)
  }
  return done
}
