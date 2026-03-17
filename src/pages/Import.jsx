import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react'
import { toDirectImageUrl } from '../lib/driveUtils'
import toast from 'react-hot-toast'

// All known column name variations → internal field name
const COL = {
  'last name':       'last_name',  'lastname':       'last_name',  'last_name': 'last_name',
  'first name':      'first_name', 'firstname':      'first_name', 'first_name': 'first_name',
  'middle name':     'middle_name','middlename':     'middle_name','middle_name': 'middle_name',
  'middle initial':  'middle_initial', 'middleinitial': 'middle_initial', 'middle_initial': 'middle_initial',
  'employee id':     'employee_id','employeeid':     'employee_id','employee_id': 'employee_id','id': 'employee_id',
  'position':        'position',   'job title':      'position',   'title': 'position',
  'department':      'department', 'office':         'department', 'dept': 'department',
  'photo url':       'photo_url',  'photo':          'photo_url',  'photo_url': 'photo_url',
  'updated id picture': 'photo_url', 'picture':      'photo_url',  'image': 'photo_url',
  'photo link':      'photo_url',  'drive link':     'photo_url',
}

// Robust CSV line parser — handles quoted fields with commas
function parseLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += c
  }
  result.push(cur.trim())
  return result
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Find header row (first row with recognized columns)
  const rawHeaders = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  const headers = rawHeaders.map(h => COL[h.toLowerCase()] || null)

  return lines.slice(1).map(line => {
    const vals = parseLine(line).map(v => v.replace(/^"|"$/g, '').trim())
    const row = {}
    headers.forEach((key, i) => { if (key) row[key] = vals[i] || '' })

    if (!row.first_name && !row.last_name) return null

    // Auto middle initial from middle name
    if (row.middle_name && !row.middle_initial) {
      row.middle_initial = row.middle_name.trim()[0]?.toUpperCase() || ''
    }
    // Empty employee_id → null (avoid unique constraint error)
    row.employee_id = row.employee_id?.trim() || null
    // Convert Google Drive share links
    if (row.photo_url) row.photo_url = toDirectImageUrl(row.photo_url)

    return row
  }).filter(Boolean)
}

export default function ImportCSV() {
  const [file, setFile]       = useState(null)
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [results, setResults]     = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError]   = useState('')
  const fileRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    setError('')
    setResults(null)
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file')
      return
    }
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const rows = parseCSV(e.target.result)
        if (rows.length === 0) {
          setError('No valid rows found. Check column headers match the template.')
          setPreview([])
        } else {
          setPreview(rows)
          toast.success(`${rows.length} rows parsed`)
        }
      } catch (err) {
        setError('Failed to parse CSV: ' + err.message)
      }
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handleImport = async () => {
    if (!preview.length) return
    setImporting(true)
    setProgress(0)
    setResults(null)

    const BATCH = 100
    let success = 0, failed = 0, done = 0

    const withId    = preview.filter(r => r.employee_id)
    const withoutId = preview.filter(r => !r.employee_id)

    // Upsert rows with employee_id (update if exists)
    for (let i = 0; i < withId.length; i += BATCH) {
      const batch = withId.slice(i, i + BATCH)
      const { error } = await supabase.from('employees')
        .upsert(batch, { onConflict: 'employee_id', ignoreDuplicates: false })
      error ? (failed += batch.length) : (success += batch.length)
      done += batch.length
      setProgress(Math.round((done / preview.length) * 100))
    }

    // Insert rows without employee_id
    for (let i = 0; i < withoutId.length; i += BATCH) {
      const batch = withoutId.slice(i, i + BATCH)
      const { error } = await supabase.from('employees').insert(batch)
      error ? (failed += batch.length) : (success += batch.length)
      done += batch.length
      setProgress(Math.round((done / preview.length) * 100))
    }

    setProgress(100)
    setResults({ success, failed })
    setImporting(false)
    if (success > 0) toast.success(`Imported ${success} employees!`)
    if (failed > 0) toast.error(`${failed} rows failed`)
  }

  const downloadTemplate = () => {
    const csv = `Last Name,First Name,Middle Name,Middle Initial,Employee ID,Position,Department,Photo URL\nDELA CRUZ,JUAN,SANTOS,S,HRMO-24-0001,Administrative Assistant I,Human Resource Management Office,https://drive.google.com/file/d/XXXX/view`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'employee_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Import CSV</h1>
        <p className="page-subtitle">Bulk import employees from Google Sheets / Excel export</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload */}
          <div className="card">
            <div className="card-body">
              <div className={`photo-upload-area ${dragActive ? 'drag-active' : ''}`}
                style={{ padding: 36, cursor: 'pointer' }}
                onClick={() => fileRef.current.click()}
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files[0]) }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 52, height: 52, background: 'var(--primary-light)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={24} color="var(--primary)" />
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>Drop CSV file here or click to browse</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>.csv files only · UTF-8 encoding</div>
                  {file && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--primary-light)', borderRadius: 8, marginTop: 4 }}>
                      <FileText size={15} color="var(--primary)" />
                      <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 500 }}>{file.name} · {preview.length} rows</span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--danger)', display: 'flex', gap: 8 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}
                </div>
              )}
            </div>
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Preview — {preview.length} rows</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setFile(null); setPreview([]); setResults(null); setError('') }}>
                    <X size={13} /> Clear
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={importing}>
                    {importing ? <span className="spinner" /> : null}
                    {importing ? `Importing... ${progress}%` : `Import All ${preview.length}`}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {importing && (
                <div style={{ padding: '10px 22px 0' }}>
                  <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', borderRadius: 999, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 4 }}>{progress}% complete</div>
                </div>
              )}

              <div className="table-wrapper" style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Last Name</th>
                      <th>First Name</th>
                      <th>MI</th>
                      <th>Employee ID</th>
                      <th>Position</th>
                      <th>Department</th>
                      <th>Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 100).map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{row.last_name}</td>
                        <td>{row.first_name}</td>
                        <td>{row.middle_initial}</td>
                        <td><span className="badge badge-gray">{row.employee_id || '—'}</span></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.position || '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--gray-500)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.department || '—'}</td>
                        <td>
                          {row.photo_url
                            ? <span style={{ fontSize: '0.72rem', color: 'var(--success)' }}>✓ Link</span>
                            : <span style={{ fontSize: '0.72rem', color: 'var(--gray-300)' }}>—</span>
                          }
                        </td>
                      </tr>
                    ))}
                    {preview.length > 100 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.8rem', padding: 10 }}>
                        + {preview.length - 100} more rows (all will be imported)
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="card">
              <div className="card-body" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {results.success > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
                    <CheckCircle size={20} />
                    <span style={{ fontWeight: 600 }}>{results.success.toLocaleString()} imported successfully</span>
                  </div>
                )}
                {results.failed > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontWeight: 600 }}>{results.failed} failed</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">How to Import</span></div>
            <div className="card-body" style={{ fontSize: '0.8375rem', color: 'var(--gray-600)', lineHeight: 1.7 }}>
              <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>Open your Google Sheet</li>
                <li><b>File → Download → CSV (.csv)</b></li>
                <li>Upload the CSV file here</li>
                <li>Check the preview</li>
                <li>Click <b>Import All</b></li>
              </ol>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Accepted column names:</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', lineHeight: 1.9 }}>
                  Last Name, First Name, Middle Name, Middle Initial, Employee ID, Position, Department, Photo URL, Updated ID Picture, Photo Link
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: '0.78rem', color: '#92400e' }}>
                ⚡ Handles 1,700+ rows in batches of 100
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={downloadTemplate} style={{ width: '100%' }}>
            <Download size={14} /> Download CSV Template
          </button>
        </div>
      </div>
    </div>
  )
}
