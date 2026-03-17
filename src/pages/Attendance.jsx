import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { toDirectImageUrl } from '../lib/driveUtils'
import { Download, Search, Calendar, Users, UserX, Clock, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

function exportCSV(rows, headers, filename) {
  const lines = [headers.join(',')]
  rows.forEach(r => lines.push(r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function getMondaysInMonth(year, month) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    if (d.getDay() === 1) days.push(new Date(d).toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function Attendance() {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [viewMode, setViewMode]         = useState('present')
  const [deptFilter, setDeptFilter]     = useState('')
  const [search, setSearch]             = useState('')
  const [logs, setLogs]                 = useState([])
  const [absentees, setAbsentees]       = useState([])
  const [departments, setDepartments]   = useState([])
  const [loading, setLoading]           = useState(false)
  const [stats, setStats]               = useState({ present:0, late:0, absent:0, total:0 })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: emps }, { data: attd }] = await Promise.all([
        supabase.from('employees').select('*').order('last_name'),
        supabase.from('attendance')
          .select('*, employees(id,employee_id,first_name,last_name,department,photo_url,position)')
          .eq('event_date', selectedDate)
          .order('scanned_at'),
      ])
      const empList = emps || []
      const logList = attd || []
      setLogs(logList)
      setDepartments([...new Set(empList.map(e => e.department).filter(Boolean))].sort())
      const presentIds = new Set(logList.map(l => l.employee_id))
      setAbsentees(empList.filter(e => !presentIds.has(e.id)))
      setStats({
        present: logList.filter(l => l.status === 'on_time').length,
        late:    logList.filter(l => l.status === 'late').length,
        absent:  empList.filter(e => !presentIds.has(e.id)).length,
        total:   empList.length,
      })
    } finally { setLoading(false) }
  }, [selectedDate])

  useEffect(() => { loadData() }, [loadData])

  const filtered = viewMode === 'present'
    ? logs.filter(l => {
        const e = l.employees || {}
        return (!deptFilter || e.department === deptFilter) &&
               (!search || `${e.first_name} ${e.last_name} ${e.employee_id||''}`.toLowerCase().includes(search.toLowerCase()))
      })
    : absentees.filter(e =>
        (!deptFilter || e.department === deptFilter) &&
        (!search || `${e.first_name} ${e.last_name} ${e.employee_id||''}`.toLowerCase().includes(search.toLowerCase()))
      )

  const handleExport = () => {
    if (viewMode === 'present') {
      exportCSV(
        filtered.map(l => {
          const e = l.employees || {}
          return [l.event_date, e.employee_id||'', e.last_name||'', e.first_name||'', e.department||'', l.status, new Date(l.scanned_at).toLocaleTimeString('en-PH')]
        }),
        ['Date','Employee ID','Last Name','First Name','Department','Status','Time In'],
        `present_${selectedDate}.csv`
      )
    } else {
      exportCSV(
        filtered.map(e => [selectedDate, e.employee_id||'', e.last_name||'', e.first_name||'', e.department||'', 'ABSENT']),
        ['Date','Employee ID','Last Name','First Name','Department','Status'],
        `absent_${selectedDate}.csv`
      )
    }
    toast.success('Exported to CSV!')
  }

  // Monday shortcuts for current + previous month
  const now = new Date()
  const recentMondays = [
    ...getMondaysInMonth(now.getFullYear(), now.getMonth() - 1),
    ...getMondaysInMonth(now.getFullYear(), now.getMonth()),
  ].filter(d => d <= todayStr).slice(-8).reverse()

  const fmtTime = ts => new Date(ts).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', second:'2-digit' })

  return (
    <div className="page-content">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">Attendance Records</h1>
          <p className="page-subtitle">Flag Raising every Monday · {selectedDate}</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={14}/> Export {viewMode === 'present' ? 'Present' : 'Absent'} List
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:20 }}>
        {[
          { icon:<CheckCircle2 size={20}/>, label:'On Time', value:stats.present, cls:'green' },
          { icon:<Clock size={20}/>,        label:'Late',    value:stats.late,    cls:'amber' },
          { icon:<UserX size={20}/>,        label:'Absent',  value:stats.absent,  cls:'red'   },
          { icon:<Users size={20}/>,        label:'Total',   value:stats.total,   cls:'blue'  },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
            <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body" style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Calendar size={14} color="var(--gray-400)"/>
              <input type="date" className="form-input" style={{ width:'auto', padding:'7px 10px' }}
                value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={todayStr} />
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {recentMondays.map(d => (
                <button key={d} onClick={() => setSelectedDate(d)}
                  style={{ cursor:'pointer', border:`1.5px solid ${d===selectedDate?'var(--primary)':'var(--gray-200)'}`, padding:'3px 10px', borderRadius:999, fontSize:'0.72rem', fontWeight:600, background:d===selectedDate?'var(--primary-light)':'white', color:d===selectedDate?'var(--primary)':'var(--gray-500)', fontFamily:'var(--font)' }}>
                  Mon · {new Date(d+'T12:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
                </button>
              ))}
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <div className="search-bar">
                <Search size={14}/>
                <input className="form-input" placeholder="Search name or ID..." value={search}
                  onChange={e => setSearch(e.target.value)} style={{ minWidth:200 }}/>
              </div>
              <select className="form-select" style={{ width:'auto', minWidth:200 }}
                value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          {/* Present / Absent toggle */}
          <div style={{ display:'flex', gap:0, background:'var(--gray-100)', borderRadius:8, padding:3, width:'fit-content' }}>
            {[['present',`✅ Present (${logs.length})`],['absent',`❌ Absent (${absentees.length})`]].map(([m,lbl]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding:'7px 18px', border:'none', borderRadius:6, cursor:'pointer', fontSize:'0.8125rem', fontWeight:600, fontFamily:'var(--font)',
                background: viewMode===m ? 'white' : 'transparent',
                color: viewMode===m ? 'var(--gray-900)' : 'var(--gray-500)',
                boxShadow: viewMode===m ? 'var(--shadow-xs)' : 'none',
                transition:'all 0.15s',
              }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          {loading
            ? <div style={{ padding:48, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto', width:28, height:28 }}/></div>
            : viewMode === 'present'
              ? (
                <table>
                  <thead>
                    <tr><th>Employee</th><th>Department</th><th>Position</th><th>Time In</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0
                      ? <tr><td colSpan={5}><div className="empty-state"><Users size={32}/><h3>No logs</h3><p>No attendance records for {selectedDate}</p></div></td></tr>
                      : filtered.map(log => {
                          const e = log.employees || {}
                          return (
                            <tr key={log.id}>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                  <div className="avatar">
                                    {e.photo_url ? <img src={toDirectImageUrl(e.photo_url)} alt="" onError={el => el.target.style.display='none'}/> : (e.first_name?.[0]||'')+(e.last_name?.[0]||'')}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight:600 }}>{e.last_name}, {e.first_name}</div>
                                    {e.employee_id && <div style={{ fontSize:'0.72rem', color:'var(--gray-400)' }}>{e.employee_id}</div>}
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontSize:'0.8125rem', color:'var(--gray-500)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.department||'—'}</td>
                              <td style={{ fontSize:'0.8125rem', color:'var(--gray-600)' }}>{e.position||'—'}</td>
                              <td style={{ fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{fmtTime(log.scanned_at)}</td>
                              <td>
                                <span className={`badge ${log.status==='on_time'?'badge-green':'badge-amber'}`}>
                                  {log.status==='on_time'?'✅ On Time':'⏰ Late'}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                    }
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr><th>Employee</th><th>Employee ID</th><th>Department</th><th>Position</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0
                      ? <tr><td colSpan={5}><div className="empty-state"><CheckCircle2 size={32}/><h3>No absentees!</h3><p>All employees present</p></div></td></tr>
                      : filtered.map(e => (
                          <tr key={e.id}>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <div className="avatar">
                                  {e.photo_url ? <img src={toDirectImageUrl(e.photo_url)} alt="" onError={el => el.target.style.display='none'}/> : (e.first_name?.[0]||'')+(e.last_name?.[0]||'')}
                                </div>
                                <div style={{ fontWeight:600 }}>{e.last_name}, {e.first_name}</div>
                              </div>
                            </td>
                            <td><span className="badge badge-gray">{e.employee_id||'—'}</span></td>
                            <td style={{ fontSize:'0.8125rem', color:'var(--gray-500)' }}>{e.department||'—'}</td>
                            <td style={{ fontSize:'0.8125rem', color:'var(--gray-600)' }}>{e.position||'—'}</td>
                            <td><span className="badge badge-red">❌ Absent</span></td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              )
          }
        </div>
      </div>
    </div>
  )
}
