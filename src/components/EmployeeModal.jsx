import { useState, useEffect } from 'react'
import { X, Upload, Link, ImageOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toDirectImageUrl, isGoogleDriveUrl } from '../lib/driveUtils'
import toast from 'react-hot-toast'

const DEPARTMENTS = [
  'Human Resource Management Office',
  'Office of the City Mayor',
  'City Administrator Office',
  'City Budget Office',
  'City Treasurer Office',
  'City Assessor Office',
  'City Civil Registrar',
  'City Engineer Office',
  'City Health Office',
  'City Social Welfare Office',
  'City Planning Office',
  'City Legal Office',
  'City Veterinary Office',
  'City Agriculture Office',
  'General Services Office',
  'Information Technology Office',
  'Public Order and Safety Office',
  'Tourism Office',
  'Other',
]

export default function EmployeeModal({ employee, onClose, onSave }) {
  const isEdit = !!employee?.id

  const [form, setForm] = useState({
    last_name: '', first_name: '', middle_name: '',
    middle_initial: '', position: '', department: '',
    photo_url: '', employee_id: '',
  })
  const [photoMode, setPhotoMode] = useState('url')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (employee) {
      setForm({
        last_name: employee.last_name || '',
        first_name: employee.first_name || '',
        middle_name: employee.middle_name || '',
        middle_initial: employee.middle_initial || '',
        position: employee.position || '',
        department: employee.department || '',
        photo_url: employee.photo_url || '',
        employee_id: employee.employee_id || '',
      })
    }
  }, [employee])

  const set = (k, v) => {
    setImgError(false)
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'middle_name' && v) {
        next.middle_initial = v.trim()[0]?.toUpperCase() || ''
      }
      return next
    })
  }

  // FIX 1: Photo upload — handles JPG, JPEG, PNG, WEBP
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type.toLowerCase())) {
      toast.error('Only JPG, PNG, WEBP images allowed')
      return
    }

    setUploading(true)
    setImgError(false)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(safeName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(safeName)

      set('photo_url', publicUrl)
      toast.success('Photo uploaded!')
    } catch (err) {
      console.error(err)
      toast.error('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // FIX 2: Empty employee_id → NULL to avoid unique constraint error
  const buildPayload = () => {
    const payload = { ...form }
    payload.employee_id = payload.employee_id?.trim() || null
    // FIX 3: Convert Google Drive share URLs to direct display URLs
    if (payload.photo_url) {
      payload.photo_url = toDirectImageUrl(payload.photo_url.trim())
    }
    return payload
  }

  const handleSave = async () => {
    if (!form.last_name.trim() || !form.first_name.trim()) {
      toast.error('Last name and first name are required')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      let result

      if (isEdit) {
        const { data, error } = await supabase
          .from('employees')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', employee.id)
          .select().single()
        if (error) throw error
        result = data
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert([payload])
          .select().single()
        if (error) throw error
        result = data
      }

      toast.success(isEdit ? 'Employee updated!' : 'Employee added!')
      onSave(result)
    } catch (err) {
      console.error(err)
      if (err.message?.includes('duplicate key') && err.message?.includes('employee_id')) {
        toast.error('Employee ID already exists. Use a different one or leave it blank.')
      } else {
        toast.error('Error: ' + err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const previewUrl = form.photo_url ? toDirectImageUrl(form.photo_url) : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Employee' : 'Add New Employee'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" value={form.last_name}
                onChange={e => set('last_name', e.target.value)} placeholder="DELA CRUZ" />
            </div>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" value={form.first_name}
                onChange={e => set('first_name', e.target.value)} placeholder="JUAN" />
            </div>
            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input className="form-input" value={form.middle_name}
                onChange={e => set('middle_name', e.target.value)} placeholder="SANTOS" />
            </div>
            <div className="form-group">
              <label className="form-label">Middle Initial</label>
              <input className="form-input" value={form.middle_initial}
                onChange={e => set('middle_initial', e.target.value)} placeholder="S" maxLength={2} />
            </div>
            <div className="form-group">
              <label className="form-label">
                Employee ID
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 6, fontWeight: 400 }}>
                  (optional — leave blank if none)
                </span>
              </label>
              <input className="form-input" value={form.employee_id}
                onChange={e => set('employee_id', e.target.value)} placeholder="HRMO-24-1076" />
            </div>
            <div className="form-group">
              <label className="form-label">Position / Title</label>
              <input className="form-input" value={form.position}
                onChange={e => set('position', e.target.value)}
                placeholder="Administrative Assistant I" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Department / Office</label>
            <select className="form-select" value={form.department}
              onChange={e => set('department', e.target.value)}>
              <option value="">Select department...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* PHOTO */}
          <div className="form-group">
            <label className="form-label">Photo</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button"
                className={`size-option ${photoMode === 'url' ? 'selected' : ''}`}
                onClick={() => setPhotoMode('url')}>
                <Link size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                Google Drive / URL
              </button>
              <button type="button"
                className={`size-option ${photoMode === 'upload' ? 'selected' : ''}`}
                onClick={() => setPhotoMode('upload')}>
                <Upload size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                Upload File
              </button>
            </div>

            {photoMode === 'url' && (
              <div>
                <input
                  className="form-input"
                  value={form.photo_url}
                  onChange={e => set('photo_url', e.target.value)}
                  placeholder="https://drive.google.com/file/d/XXXX/view"
                />
                {isGoogleDriveUrl(form.photo_url) && (
                  <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    ✅ Google Drive link — will auto-convert for display
                  </div>
                )}
              </div>
            )}

            {photoMode === 'upload' && (
              <label className="photo-upload-area" style={{ cursor: uploading ? 'wait' : 'pointer', display: 'block' }}>
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--gray-500)' }}>
                    <div className="spinner" />
                    <span style={{ fontSize: '0.875rem' }}>Uploading...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--gray-500)' }}>
                    <Upload size={22} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Click to upload photo</span>
                    <span style={{ fontSize: '0.78rem' }}>JPG, JPEG, PNG, WEBP</span>
                  </div>
                )}
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
            )}

            {previewUrl && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                {imgError ? (
                  <div style={{
                    width: 56, height: 56, borderRadius: 8, background: 'var(--gray-100)',
                    border: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}>
                    <ImageOff size={16} color="var(--gray-400)" />
                    <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>No preview</span>
                  </div>
                ) : (
                  <img src={previewUrl} alt="Preview"
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }}
                    onError={() => setImgError(true)} />
                )}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)' }}>Photo preview</div>
                  {imgError && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: 2 }}>
                      ⚠️ Can't preview — set Drive file to "Anyone with the link"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploading}>
            {saving ? <span className="spinner" /> : null}
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  )
}
