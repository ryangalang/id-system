import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import IDCard, { ID_SIZES } from '../components/IDCard'
import IDEditor, { DEFAULT_LAYOUT } from '../components/IDEditor'
import { openPrintWindow } from '../lib/printWindow'
import { Printer, Search, X, Trash2, Plus, Settings2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

const LAYOUT_KEY = 'dagupan_id_layout'

export default function PrintPage({ preselected, onClearPreselected }) {
  const [queue, setQueue] = useState([])
  const [size, setSize] = useState('cr80')
  const [qrMap, setQrMap] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [tab, setTab] = useState('queue') // 'queue' | 'editor'
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUT
    } catch { return DEFAULT_LAYOUT }
  })
  const [editorEmployee, setEditorEmployee] = useState(null)

  useEffect(() => {
    if (preselected && preselected.length > 0) {
      setQueue(preselected)
      if (onClearPreselected) onClearPreselected()
    }
  }, [preselected])

  useEffect(() => {
    queue.forEach(async (emp) => {
      if (!qrMap[emp.id]) {
        const text = JSON.stringify({ id: emp.employee_id || emp.id, name: `${emp.first_name} ${emp.last_name}`, dept: emp.department })
        const url = await QRCode.toDataURL(text, { width: 160, margin: 1 })
        setQrMap(prev => ({ ...prev, [emp.id]: url }))
      }
    })
  }, [queue])

  // Set editor preview employee to first in queue
  useEffect(() => {
    if (queue.length > 0 && !editorEmployee) {
      setEditorEmployee(queue[0])
    }
  }, [queue])

  const handleSearch = async (term) => {
    setSearchTerm(term)
    if (!term.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('employees').select('*')
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_id.ilike.%${term}%`).limit(10)
    setSearchResults(data || [])
    setSearching(false)
  }

  const addToQueue = (emp) => {
    if (queue.find(e => e.id === emp.id)) { toast('Already in queue'); return }
    setQueue(prev => [...prev, emp])
    if (!editorEmployee) setEditorEmployee(emp)
    setSearchTerm('')
    setSearchResults([])
  }

  const removeFromQueue = (id) => {
    setQueue(prev => {
      const next = prev.filter(e => e.id !== id)
      if (editorEmployee?.id === id) setEditorEmployee(next[0] || null)
      return next
    })
  }

  const handleSaveLayout = (newLayout) => {
    const toSave = newLayout || layout
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(toSave))
    if (newLayout) setLayout(newLayout)
    toast.success('Layout saved!')
  }

  const handlePrint = () => {
    if (queue.length === 0) { toast.error('No employees in queue'); return }
    openPrintWindow(queue, size, qrMap, layout)
  }

  const cardsPerPage = size === 'cr80' ? 8 : size === 'a6' ? 4 : 2
  const pages = []
  for (let i = 0; i < queue.length; i += cardsPerPage) pages.push(queue.slice(i, i + cardsPerPage))

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Print IDs</h1>
          <p className="page-subtitle">{queue.length} employee{queue.length !== 1 ? 's' : ''} in queue</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${tab === 'editor' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(tab === 'editor' ? 'queue' : 'editor')}>
            <Settings2 size={15} />
            {tab === 'editor' ? 'Back to Queue' : 'Edit Layout'}
          </button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={queue.length === 0}>
            <Printer size={15} />
            Print All ({queue.length})
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* MAIN AREA */}
        <div className="card">
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)' }}>
            {[['queue', '🖨️ Preview & Queue'], ['editor', '✏️ Edit Layout']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: '12px 20px', border: 'none', background: 'none',
                fontSize: '0.875rem', fontWeight: tab === key ? 600 : 400,
                color: tab === key ? 'var(--primary)' : 'var(--gray-500)',
                borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>

          <div className="card-body">

            {/* ── QUEUE TAB ── */}
            {tab === 'queue' && (
              queue.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px 0' }}>
                  <Printer size={36} />
                  <h3>No employees in queue</h3>
                  <p>Search and add employees from the right panel</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {pages.map((pageEmps, pageIdx) => (
                    <div key={pageIdx}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 8, fontWeight: 500 }}>
                        Page {pageIdx + 1}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16, background: 'var(--gray-100)', borderRadius: 8 }}>
                        {pageEmps.map(emp => (
                          <div key={emp.id} style={{ position: 'relative' }}>
                            <IDCard employee={emp} size={size} qrDataUrl={qrMap[emp.id]} layout={layout} />
                            <button onClick={() => removeFromQueue(emp.id)} style={{
                              position: 'absolute', top: -7, right: -7,
                              width: 20, height: 20, borderRadius: '50%',
                              background: 'white', border: '1px solid var(--gray-300)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--danger)', padding: 0,
                              boxShadow: 'var(--shadow)',
                            }}>
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── EDITOR TAB ── */}
            {tab === 'editor' && (
              <div>
                {/* Employee picker for preview */}
                {queue.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: 6, display: 'block' }}>
                      Preview with employee:
                    </label>
                    <select className="form-select" style={{ maxWidth: 280 }}
                      value={editorEmployee?.id || ''}
                      onChange={e => setEditorEmployee(queue.find(q => q.id === e.target.value))}>
                      {queue.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.last_name}, {emp.first_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!editorEmployee && queue.length === 0 && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.8125rem', color: '#92400e' }}>
                    ⚠️ Add employees to queue first to preview with real data
                  </div>
                )}

                <IDEditor
                  employee={editorEmployee || { first_name: 'JUAN', last_name: 'DELA CRUZ', middle_initial: 'S', position: 'Administrative Assistant I', department: 'Human Resource Management Office', employee_id: 'HRMO-24-0001' }}
                  qrDataUrl={editorEmployee ? qrMap[editorEmployee.id] : null}
                  layout={layout}
                  onChange={setLayout}
                  onSave={handleSaveLayout}
                />
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Size */}
          <div className="card">
            <div className="card-header"><span className="card-title">Card Size</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(ID_SIZES).map(([key, cfg]) => (
                <button key={key} className={`size-option ${size === key ? 'selected' : ''}`}
                  onClick={() => setSize(key)} style={{ textAlign: 'left', width: '100%' }}>
                  <div style={{ fontWeight: 600 }}>{cfg.label}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>{cfg.width} × {cfg.height}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Search & Add */}
          <div className="card">
            <div className="card-header"><span className="card-title">Add Employees</span></div>
            <div className="card-body" style={{ paddingTop: 10 }}>
              <div className="search-bar" style={{ marginBottom: 10 }}>
                <Search size={14} />
                <input className="form-input" placeholder="Search name or ID..."
                  value={searchTerm} onChange={e => handleSearch(e.target.value)}
                  style={{ minWidth: 'unset' }} />
              </div>
              {searching && <div style={{ textAlign: 'center', padding: 8 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
                  {searchResults.map(emp => (
                    <button key={emp.id} onClick={() => addToQueue(emp)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', border: '1px solid var(--gray-200)',
                      borderRadius: 6, background: 'white', cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: '0.65rem', flexShrink: 0 }}>
                        {(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.last_name}, {emp.first_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.department || emp.position || '—'}
                        </div>
                      </div>
                      <Plus size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
              {queue.length > 0 && (
                <button className="btn btn-danger btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={() => setQueue([])}>
                  <Trash2 size={12} /> Clear All
                </button>
              )}
            </div>
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Queue</span>
                <span className="badge badge-blue">{queue.length}</span>
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {queue.map((emp, idx) => (
                  <div key={emp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                    borderBottom: idx < queue.length - 1 ? '1px solid var(--gray-100)' : 'none',
                  }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', width: 18, flexShrink: 0 }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.last_name}, {emp.first_name}
                    </div>
                    <button className="btn-icon danger" onClick={() => removeFromQueue(emp.id)} style={{ flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
