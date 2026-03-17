import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Search, Plus, Printer, Pencil, Trash2,
  ChevronLeft, ChevronRight, RefreshCw, Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import EmployeeModal from '../components/EmployeeModal'
import { toDirectImageUrl } from '../lib/driveUtils'

const PER_PAGE = 25

export default function Employees({ onPrintSelected }) {
  const [employees, setEmployees] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [modal, setModal] = useState(null) // null | 'add' | employee obj
  const [departments, setDepartments] = useState([])

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('employees').select('*', { count: 'exact' })

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%`)
    }
    if (deptFilter) {
      query = query.eq('department', deptFilter)
    }

    const from = (page - 1) * PER_PAGE
    query = query.range(from, from + PER_PAGE - 1).order('last_name')

    const { data, error, count } = await query
    if (error) { toast.error(error.message); setLoading(false); return }
    setEmployees(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [search, deptFilter, page])

  const fetchDepts = async () => {
    const { data } = await supabase.from('employees').select('department').not('department', 'is', null)
    const unique = [...new Set(data?.map(d => d.department).filter(Boolean))]
    setDepartments(unique.sort())
  }

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => { fetchDepts() }, [])

  useEffect(() => { setPage(1); setSelected(new Set()) }, [search, deptFilter])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === employees.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(employees.map(e => e.id)))
    }
  }

  const handleDelete = async (emp) => {
    if (!confirm(`Delete ${emp.first_name} ${emp.last_name}?`)) return
    const { error } = await supabase.from('employees').delete().eq('id', emp.id)
    if (error) { toast.error(error.message); return }
    toast.success('Employee deleted')
    fetchEmployees()
  }

  const handleSave = (emp) => {
    setModal(null)
    fetchEmployees()
    fetchDepts()
  }

  const handlePrintSelected = () => {
    const selectedEmployees = employees.filter(e => selected.has(e.id))
    if (onPrintSelected) onPrintSelected(selectedEmployees)
  }

  const totalPages = Math.ceil(total / PER_PAGE)
  const allSelected = employees.length > 0 && selected.size === employees.length

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{total.toLocaleString()} total records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchEmployees}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setModal('add')}>
            <Plus size={15} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Selection Bar */}
      {selected.size > 0 && (
        <div className="selection-bar">
          <span className="selection-bar-text">{selected.size} employee{selected.size > 1 ? 's' : ''} selected</span>
          <div className="selection-bar-actions">
            <button className="btn-white" onClick={handlePrintSelected}>
              <Printer size={14} />
              Print Selected IDs
            </button>
            <button className="btn-white" style={{ opacity: 0.7 }} onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 18px' }}>
          <div className="filter-bar">
            <div className="search-bar">
              <Search size={15} />
              <input
                className="form-input"
                placeholder="Search name or ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-select"
              style={{ minWidth: 220 }}
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
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
                <th className="checkbox-cell">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Photo</th>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Position</th>
                <th>Department</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div className="spinner" style={{ width: 28, height: 28 }} />
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <Users size={36} />
                      <h3>No employees found</h3>
                      <p>Add employees or try a different search</p>
                    </div>
                  </td>
                </tr>
              ) : employees.map(emp => (
                <tr key={emp.id} className={selected.has(emp.id) ? 'selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                    />
                  </td>
                  <td>
                    <div className="avatar">
                      {emp.photo_url
                        ? <img src={toDirectImageUrl(emp.photo_url)} alt="" onError={e => { e.target.style.display = 'none' }} />
                        : (emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')
                      }
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {emp.last_name}, {emp.first_name} {emp.middle_initial ? emp.middle_initial + '.' : ''}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-gray">{emp.employee_id || '—'}</span>
                  </td>
                  <td style={{ color: 'var(--gray-600)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.position || '—'}
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.8125rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.department || '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button className="btn-icon" title="Print ID" onClick={() => onPrintSelected && onPrintSelected([emp])}>
                        <Printer size={15} />
                      </button>
                      <button className="btn-icon" title="Edit" onClick={() => setModal(emp)}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(emp)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
            </span>
            <div className="pagination-buttons">
              <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = page <= 3 ? i + 1 : page + i - 2
                if (p > totalPages) return null
                return (
                  <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                )
              })}
              <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
