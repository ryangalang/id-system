import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react'
import { toDirectImageUrl } from '../lib/driveUtils'
import toast from 'react-hot-toast'

const COLUMN_MAP = {
  'Last Name': 'last_name',
  'LastName': 'last_name',
  'last_name': 'last_name',
  'LAST NAME': 'last_name',
  'First Name': 'first_name',
  'FirstName': 'first_name',
  'first_name': 'first_name',
  'FIRST NAME': 'first_name',
  'Middle Name': 'middle_name',
  'MiddleName': 'middle_name',
  'middle_name': 'middle_name',
  'MIDDLE NAME': 'middle_name',
  'Middle Initial': 'middle_initial',
  'middle_initial': 'middle_initial',
  'Position': 'position',
  'POSITION': 'position',
  'Department': 'department',
  'DEPARTMENT': 'department',
  'Employee ID': 'employee_id',
  'EmployeeID': 'employee_id',
  'employee_id': 'employee_id',
  'Photo URL': 'photo_url',
  'photo_url': 'photo_url',
  'Updated ID Picture': 'photo_url',
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((h, i) => {
      const key = COLUMN_MAP[h]
      if (key) row[key] = values[i] || ''
    })
    // Auto middle initial
    if (row.middle_name && !row.middle_initial) {
      row.middle_initial = row.middle_name.trim()[0]?.toUpperCase() || ''
    }
    // FIX: empty employee_id → null to avoid duplicate unique constraint errors
    if (!row.employee_id || row.employee_id.trim() === '') {
      row.employee_id = null
    }
    // FIX: Convert Google Drive share links to direct display URLs
    if (row.photo_url) {
      row.photo_url = toDirectImageUrl(row.photo_url.trim())
    }
    return row
  }).filter(r => r.first_name || r.last_name)
}

export default function ImportCSV() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.csv')) { toast.error('Please upload a .csv file'); return }
    setFile(f)
    setResults(null)
    const reader = new FileReader()
    reader.onload = e => {
      const rows = parseCSV(e.target.result)
      setPreview(rows)
    }
    reader.readAsText(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }

  const handleImport = async () => {
    if (preview.length === 0) return
    setImporting(true)

    // Separate rows: those with employee_id (upsert) vs those without (insert only)
    const withId    = preview.filter(r => r.employee_id)
    const withoutId = preview.filter(r => !r.employee_id)

    let success = 0, failed = 0
    const BATCH = 100

    // Upsert rows that have an employee_id (update if duplicate)
    for (let i = 0; i < withId.length; i += BATCH) {
      const batch = withId.slice(i, i + BATCH)
      const { error } = await supabase.from('employees').upsert(batch, {
        onConflict: 'employee_id',
        ignoreDuplicates: false,
      })
      if (error) { failed += batch.length; console.error('upsert error:', error) }
      else success += batch.length
    }

    // Insert rows without employee_id (no conflict check possible)
    for (let i = 0; i < withoutId.length; i += BATCH) {
      const batch = withoutId.slice(i, i + BATCH)
      const { error } = await supabase.from('employees').insert(batch)
      if (error) { failed += batch.length; console.error('insert error:', error) }
      else success += batch.length
    }

    setResults({ success, failed })
    setImporting(false)
    if (success > 0) toast.success(`Imported ${success} employees!`)
    if (failed > 0) toast.error(`${failed} rows failed — check console for details`)
  }

  const downloadTemplate = () => {
    const csv = `Last Name,First Name,Middle Name,Middle Initial,Employee ID,Position,Department,Photo URL\nDela Cruz,Juan,Santos,S,EMP-0001,Administrative Assistant I,Human Resource Management Office,https://...`
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
        <p className="page-subtitle">Bulk import employees from Google Sheets export</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload Area */}
          <div className="card">
            <div className="card-body">
              <div
                className={`photo-upload-area ${dragActive ? 'drag-active' : ''}`}
                style={{ padding: 40 }}
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current.click()}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 56, height: 56, background: 'var(--primary-light)',
                    borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Upload size={24} color="var(--primary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>
                      Drop your CSV file here
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-400)' }}>
                      or click to browse · .csv files only
                    </div>
                  </div>
                  {file && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', background: 'var(--primary-light)',
                      borderRadius: 8, marginTop: 8,
                    }}>
                      <FileText size={16} color="var(--primary)" />
                      <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 500 }}>
                        {file.name} · {preview.length} rows
                      </span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              </div>
            </div>
          </div>

          {/* Preview Table */}
          {preview.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Preview — {preview.length} rows</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setFile(null); setPreview([]); setResults(null) }}>
                    <X size={13} /> Clear
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={importing}>
                    {importing ? <span className="spinner" /> : null}
                    Import All
                  </button>
                </div>
              </div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>{i + 1}</td>
                        <td>{row.last_name}</td>
                        <td>{row.first_name}</td>
                        <td>{row.middle_initial}</td>
                        <td><span className="badge badge-gray">{row.employee_id || '—'}</span></td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--gray-600)' }}>{row.position || '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{row.department || '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.8125rem', padding: '10px' }}>
                          ... and {preview.length - 50} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="card">
              <div className="card-body">
                <div style={{ display: 'flex', gap: 16 }}>
                  {results.success > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
                      <CheckCircle size={20} />
                      <span style={{ fontWeight: 600 }}>{results.success} imported successfully</span>
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
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Instructions</span>
            </div>
            <div className="card-body" style={{ fontSize: '0.8625rem', color: 'var(--gray-600)', lineHeight: 1.7 }}>
              <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li>Export your Google Sheet as <strong>.csv</strong></li>
                <li>Make sure headers match the template</li>
                <li>Upload the CSV file here</li>
                <li>Review the preview</li>
                <li>Click <strong>Import All</strong></li>
              </ol>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--gray-100)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Supported columns:</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.8 }}>
                  Last Name, First Name, Middle Name, Middle Initial, Employee ID, Position, Department, Photo URL, Updated ID Picture
                </div>
              </div>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={downloadTemplate} style={{ width: '100%' }}>
            <Download size={14} />
            Download Template
          </button>
        </div>
      </div>
    </div>
  )
}
