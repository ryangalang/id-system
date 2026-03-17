import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Search, Plus, Printer, Pencil, Trash2,
  ChevronLeft, ChevronRight, RefreshCw, Users,
  QrCode, X, Download, Wand2, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import EmployeeModal from '../components/EmployeeModal'
import { toDirectImageUrl } from '../lib/driveUtils'
import { generateAndSaveQR, batchGenerateQRs } from '../lib/qrUtils'

const PER_PAGE = 25

// QR Viewer Modal
function QRModal({ employee, onClose }) {
  const [qr, setQr] = useState(employee.qr_code || null)
  const [loading, setLoading] = useState(!employee.qr_code)

  useEffect(() => {
    if (!employee.qr_code) {
      generateAndSaveQR(employee).then(url => {
        setQr(url)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [])

  const download = () => {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `QR_${employee.employee_id || employee.id}.png`
    a.click()
  }

  const name = `${employee.last_name}, ${employee.first_name}${employee.middle_initial ? ' '+employee.middle_initial+'.' : ''}`

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display:'flex',alignItems:'center',gap:8 }}>
            <QrCode size={18} color="var(--primary)"/> QR Code
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body" style={{ textAlign:'center' }}>
          {loading ? (
            <div style={{ padding:'40px 0' }}>
              <div className="spinner" style={{ margin:'0 auto', width:32, height:32 }} />
              <div style={{ marginTop:12, color:'var(--gray-500)', fontSize:'0.875rem' }}>Generating QR...</div>
            </div>
          ) : qr ? (
            <>
              <img src={qr} alt="QR Code" style={{ width:200, height:200, imageRendering:'pixelated', border:'1px solid var(--gray-200)', borderRadius:8, margin:'0 auto', display:'block' }} />
              <div style={{ marginTop:14 }}>
                <div style={{ fontWeight:700, fontSize:'0.9375rem', color:'var(--gray-900)' }}>{name}</div>
                <div style={{ fontSize:'0.8125rem', color:'var(--primary)', fontWeight:600, marginTop:4 }}>{employee.employee_id || 'No Employee ID'}</div>
                <div style={{ fontSize:'0.78rem', color:'var(--gray-400)', marginTop:2 }}>{employee.department}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={download} style={{ marginTop:16, width:'100%' }}>
                <Download size={14}/> Download QR Code
              </button>
            </>
          ) : (
            <div style={{ padding:'20px 0', color:'var(--danger)' }}>Failed to generate QR</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Employees({ onPrintSelected }) {
  const [employees, setEmployees] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [modal, setModal] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [departments, setDepartments] = useState([])
  const [batchProgress, setBatchProgress] = useState(null) // null | { done, total }

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('employees')
      .select('id,first_name,last_name,middle_initial,employee_id,position,department,photo_url,qr_code', { count: 'exact' })
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%`)
    if (deptFilter) query = query.eq('department', deptFilter)
    const from = (page - 1) * PER_PAGE
    query = query.range(from, from + PER_PAGE - 1).order('last_name')
    const { data, error, count } = await query
    if (error) { toast.error(error.message); setLoading(false); return }
    setEmployees(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [search, deptFilter, page])

  const fetchDepts = async () => {
    const { data } = await supabase.from('employees').select('department').not('department','is',null)
    setDepartments([...new Set(data?.map(d=>d.department).filter(Boolean))].sort())
  }

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => { fetchDepts() }, [])
  useEffect(() => { setPage(1); setSelected(new Set()) }, [search, deptFilter])

  const toggleSelect = (id) => setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleAll = () => setSelected(employees.length>0 && selected.size===employees.length ? new Set() : new Set(employees.map(e=>e.id)))

  const handleDelete = async (emp) => {
    if (!confirm(`Delete ${emp.first_name} ${emp.last_name}?`)) return
    const { error } = await supabase.from('employees').delete().eq('id', emp.id)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    fetchEmployees()
  }

  const handleBatchGenerateQR = async () => {
    setBatchProgress({ done: 0, total: 0 })
    try {
      const count = await batchGenerateQRs((done, total) => setBatchProgress({ done, total }))
      if (count === 0) toast.success('All employees already have QR codes!')
      else toast.success(`Generated ${count} QR codes!`)
      fetchEmployees()
    } catch (e) {
      toast.error('Batch QR failed: ' + e.message)
    } finally {
      setBatchProgress(null)
    }
  }

  const allSelected = employees.length > 0 && selected.size === employees.length
  const totalPages = Math.ceil(total / PER_PAGE)
  const noQRCount = employees.filter(e => !e.qr_code).length

  return (
    <div className="page-content">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{total.toLocaleString()} total records</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {noQRCount > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleBatchGenerateQR} disabled={!!batchProgress}>
              {batchProgress
                ? <><span className="spinner"/> {batchProgress.done}/{batchProgress.total} QRs...</>
                : <><Sparkles size={13}/> Generate {noQRCount} Missing QRs</>
              }
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={fetchEmployees}><RefreshCw size={14}/> Refresh</button>
          <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={15}/> Add Employee</button>
        </div>
      </div>

      {/* Selection Bar */}
      {selected.size > 0 && (
        <div className="selection-bar">
          <span className="selection-bar-text">{selected.size} employee{selected.size>1?'s':''} selected</span>
          <div className="selection-bar-actions">
            <button className="btn-white" onClick={() => onPrintSelected && onPrintSelected(employees.filter(e=>selected.has(e.id)))}>
              <Printer size={14}/> Print Selected IDs
            </button>
            <button className="btn-white" style={{ opacity:.7 }} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-body" style={{ padding:'14px 18px' }}>
          <div className="filter-bar">
            <div className="search-bar">
              <Search size={15}/>
              <input className="form-input" placeholder="Search name or ID..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="form-select" style={{ minWidth:220 }} value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="checkbox-cell"><input type="checkbox" checked={allSelected} onChange={toggleAll}/></th>
                <th>Photo</th>
                <th>Name</th>
                <th>Employee ID</th>
                <th>QR Code</th>
                <th>Position</th>
                <th>Department</th>
                <th style={{ width:110 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:'48px 0' }}>
                  <div style={{ display:'flex', justifyContent:'center' }}><div className="spinner" style={{ width:28, height:28 }}/></div>
                </td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state"><Users size={36}/><h3>No employees found</h3><p>Add employees or try a different search</p></div>
                </td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id} className={selected.has(emp.id)?'selected':''}>
                  <td><input type="checkbox" checked={selected.has(emp.id)} onChange={()=>toggleSelect(emp.id)}/></td>
                  <td>
                    <div className="avatar">
                      {emp.photo_url
                        ? <img src={toDirectImageUrl(emp.photo_url)} alt="" onError={e=>{e.target.style.display='none'}}/>
                        : (emp.first_name?.[0]||'')+(emp.last_name?.[0]||'')
                      }
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{emp.last_name}, {emp.first_name} {emp.middle_initial?emp.middle_initial+'.':''}</div>
                  </td>
                  <td>
                    {emp.employee_id
                      ? <span className="badge badge-blue">{emp.employee_id}</span>
                      : <span className="badge badge-gray">—</span>
                    }
                  </td>
                  <td>
                    {emp.qr_code ? (
                      <button onClick={() => setQrModal(emp)} title="View QR Code" style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
                        <img src={emp.qr_code} alt="QR" style={{ width:36, height:36, imageRendering:'pixelated', borderRadius:4, border:'1px solid var(--gray-200)', display:'block' }}/>
                      </button>
                    ) : (
                      <button className="btn-icon" title="Generate QR Code"
                        onClick={async () => {
                          const t = toast.loading('Generating QR...')
                          try {
                            await generateAndSaveQR(emp)
                            toast.success('QR generated!', { id: t })
                            fetchEmployees()
                          } catch(e) {
                            toast.error('Failed', { id: t })
                          }
                        }}>
                        <QrCode size={15} color="var(--gray-400)"/>
                      </button>
                    )}
                  </td>
                  <td style={{ color:'var(--gray-600)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {emp.position||'—'}
                  </td>
                  <td style={{ color:'var(--gray-500)', fontSize:'0.8125rem', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {emp.department||'—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:2 }}>
                      <button className="btn-icon" title="View QR" onClick={() => setQrModal(emp)}><QrCode size={14}/></button>
                      <button className="btn-icon" title="Print ID" onClick={() => onPrintSelected&&onPrintSelected([emp])}><Printer size={14}/></button>
                      <button className="btn-icon" title="Edit" onClick={() => setModal(emp)}><Pencil size={14}/></button>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(emp)}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,total)} of {total.toLocaleString()}</span>
            <div className="pagination-buttons">
              <button className="page-btn" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={14}/></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_,i) => {
                let p = page<=3 ? i+1 : page+i-2
                if (p>totalPages) return null
                return <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={()=>setPage(p)}>{p}</button>
              })}
              <button className="page-btn" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}><ChevronRight size={14}/></button>
            </div>
          </div>
        )}
      </div>

      {modal && <EmployeeModal employee={modal==='add'?null:modal} onClose={()=>setModal(null)} onSave={()=>{ setModal(null); fetchEmployees(); fetchDepts() }}/>}
      {qrModal && <QRModal employee={qrModal} onClose={()=>setQrModal(null)}/>}
    </div>
  )
}
