import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Building2, CreditCard, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, departments: 0, withPhoto: 0, recent: 0 })
  const [recentEmployees, setRecentEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [totalRes, deptRes, photoRes, recentCountRes, recentRes] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('department').not('department', 'is', null),
        supabase.from('employees').select('*', { count: 'exact', head: true }).not('photo_url', 'is', null).neq('photo_url', ''),
        supabase.from('employees').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('employees').select('*').order('created_at', { ascending: false }).limit(8),
      ])

      const depts = new Set(deptRes.data?.map(d => d.department).filter(Boolean))
      setStats({
        total: totalRes.count || 0,
        departments: depts.size,
        withPhoto: photoRes.count || 0,
        recent: recentCountRes.count || 0,
      })
      setRecentEmployees(recentRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">City Government of Dagupan · HR ID Management</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={20} /></div>
          <div>
            <div className="stat-value">{loading ? '—' : stats.total.toLocaleString()}</div>
            <div className="stat-label">Total Employees</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Building2 size={20} /></div>
          <div>
            <div className="stat-value">{loading ? '—' : stats.departments}</div>
            <div className="stat-label">Departments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon sky"><CreditCard size={20} /></div>
          <div>
            <div className="stat-value">{loading ? '—' : stats.withPhoto.toLocaleString()}</div>
            <div className="stat-label">With Photos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={20} /></div>
          <div>
            <div className="stat-value">{loading ? '—' : stats.recent}</div>
            <div className="stat-label">Added This Week</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recently Added</span>
          <Link to="/employees" className="btn btn-ghost btn-sm">View All</Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div className="spinner" style={{ width: 24, height: 24 }} />
                    </div>
                  </td>
                </tr>
              ) : recentEmployees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar">
                        {emp.photo_url
                          ? <img src={emp.photo_url} alt="" onError={e => { e.target.style.display = 'none' }} />
                          : (emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{emp.last_name}, {emp.first_name}</div>
                        {emp.employee_id && <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{emp.employee_id}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--gray-600)' }}>{emp.position || '—'}</td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.8125rem' }}>{emp.department || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
