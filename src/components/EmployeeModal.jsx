import { useState, useEffect } from 'react'
import { X, Upload, Link, ImageOff, Wand2, QrCode } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toDirectImageUrl, isGoogleDriveUrl } from '../lib/driveUtils'
import { generateEmployeeId, generateAndSaveQR, generateQRDataUrl } from '../lib/qrUtils'
import toast from 'react-hot-toast'

const DEPARTMENTS = [
  'Human Resource Management Office','Office of the City Mayor','City Administrator Office',
  'City Budget Office','City Treasurer Office','City Assessor Office','City Civil Registrar',
  'City Engineer Office','City Health Office','City Social Welfare Office','City Planning Office',
  'City Legal Office','City Veterinary Office','City Agriculture Office','General Services Office',
  'Information Technology Office','Public Order and Safety Office','Tourism Office','Other',
]

export default function EmployeeModal({ employee, onClose, onSave }) {
  const isEdit = !!employee?.id
  const [form, setForm] = useState({
    last_name:'', first_name:'', middle_name:'', middle_initial:'',
    position:'', department:'', photo_url:'', employee_id:'',
  })
  const [photoMode, setPhotoMode] = useState('url')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [generatingId, setGeneratingId] = useState(false)
  const [qrPreview, setQrPreview] = useState(null)

  useEffect(() => {
    if (employee) {
      setForm({
        last_name: employee.last_name||'', first_name: employee.first_name||'',
        middle_name: employee.middle_name||'', middle_initial: employee.middle_initial||'',
        position: employee.position||'', department: employee.department||'',
        photo_url: employee.photo_url||'', employee_id: employee.employee_id||'',
      })
      if (employee.qr_code) setQrPreview(employee.qr_code)
    }
  }, [employee])

  const set = (k, v) => {
    setImgError(false)
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'middle_name' && v) next.middle_initial = v.trim()[0]?.toUpperCase() || ''
      return next
    })
  }

  // Auto-generate employee ID
  const handleAutoId = async () => {
    if (!form.department) { toast.error('Select a department first'); return }
    setGeneratingId(true)
    try {
      const id = await generateEmployeeId(form.department)
      set('employee_id', id)
      toast.success('Employee ID generated: ' + id)
    } catch (e) {
      toast.error('Failed to generate ID')
    } finally {
      setGeneratingId(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp']
    if (!allowed.includes(file.type.toLowerCase())) { toast.error('Only JPG, PNG, WEBP allowed'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(safeName, file, { cacheControl:'3600', upsert:true, contentType:file.type })
      if (uploadError) throw uploadError
      const { data:{ publicUrl } } = supabase.storage.from('employee-photos').getPublicUrl(safeName)
      set('photo_url', publicUrl)
      toast.success('Photo uploaded!')
    } catch (err) {
      toast.error('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const buildPayload = () => {
    const payload = { ...form }
    payload.employee_id = payload.employee_id?.trim() || null
    if (payload.photo_url) payload.photo_url = toDirectImageUrl(payload.photo_url.trim())
    return payload
  }

  const handleSave = async () => {
    if (!form.last_name.trim() || !form.first_name.trim()) {
      toast.error('Last name and first name are required'); return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      let result

      if (isEdit) {
        const { data, error } = await supabase.from('employees')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', employee.id).select().single()
        if (error) throw error
        result = data
      } else {
        const { data, error } = await supabase.from('employees')
          .insert([payload]).select().single()
        if (error) throw error
        result = data
      }

      // Auto-generate and save QR code
      try {
        const qrUrl = await generateAndSaveQR(result)
        setQrPreview(qrUrl)
        result.qr_code = qrUrl
      } catch (qrErr) {
        console.warn('QR gen failed:', qrErr)
      }

      toast.success(isEdit ? 'Employee updated!' : 'Employee added!')
      onSave(result)
    } catch (err) {
      if (err.message?.includes('duplicate key') && err.message?.includes('employee_id')) {
        toast.error('Employee ID already taken. Use a different one or auto-generate.')
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
          <button className="btn-icon" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" value={form.last_name} onChange={e=>set('last_name',e.target.value)} placeholder="DELA CRUZ"/>
            </div>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" value={form.first_name} onChange={e=>set('first_name',e.target.value)} placeholder="JUAN"/>
            </div>
            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input className="form-input" value={form.middle_name} onChange={e=>set('middle_name',e.target.value)} placeholder="SANTOS"/>
            </div>
            <div className="form-group">
              <label className="form-label">Middle Initial</label>
              <input className="form-input" value={form.middle_initial} onChange={e=>set('middle_initial',e.target.value)} placeholder="S" maxLength={2}/>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Department / Office</label>
            <select className="form-select" value={form.department} onChange={e=>set('department',e.target.value)}>
              <option value="">Select department...</option>
              {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                Employee ID
                <span style={{ fontSize:'0.72rem',color:'var(--gray-400)',marginLeft:6,fontWeight:400 }}>(auto-generate or manual)</span>
              </label>
              <div style={{ display:'flex', gap:6 }}>
                <input className="form-input" value={form.employee_id} onChange={e=>set('employee_id',e.target.value)} placeholder="HRMO-2026-0001"/>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAutoId} disabled={generatingId} title="Auto-generate based on department" style={{ flexShrink:0, whiteSpace:'nowrap' }}>
                  {generatingId ? <span className="spinner"/> : <Wand2 size={14}/>}
                  Auto
                </button>
              </div>
              {form.department && (
                <div style={{ fontSize:'0.72rem',color:'var(--gray-400)',marginTop:4 }}>
                  Format for {form.department.split(' ').slice(0,2).join(' ')}: <strong>{form.employee_id || '...'}</strong>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Position / Title</label>
              <input className="form-input" value={form.position} onChange={e=>set('position',e.target.value)} placeholder="Administrative Assistant I"/>
            </div>
          </div>

          {/* Photo */}
          <div className="form-group">
            <label className="form-label">Photo</label>
            <div style={{ display:'flex',gap:8,marginBottom:10 }}>
              <button type="button" className={`size-option ${photoMode==='url'?'selected':''}`} onClick={()=>setPhotoMode('url')}>
                <Link size={13} style={{ marginRight:5,verticalAlign:'middle' }}/>Google Drive / URL
              </button>
              <button type="button" className={`size-option ${photoMode==='upload'?'selected':''}`} onClick={()=>setPhotoMode('upload')}>
                <Upload size={13} style={{ marginRight:5,verticalAlign:'middle' }}/>Upload File
              </button>
            </div>
            {photoMode==='url' ? (
              <div>
                <input className="form-input" value={form.photo_url} onChange={e=>set('photo_url',e.target.value)} placeholder="https://drive.google.com/file/d/XXXX/view"/>
                {isGoogleDriveUrl(form.photo_url) && (
                  <div style={{ marginTop:6,fontSize:'0.78rem',color:'var(--success)' }}>✅ Google Drive link — will auto-convert</div>
                )}
              </div>
            ) : (
              <label className="photo-upload-area" style={{ cursor:uploading?'wait':'pointer',display:'block' }}>
                {uploading
                  ? <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:8,color:'var(--gray-500)' }}><div className="spinner"/><span style={{ fontSize:'0.875rem' }}>Uploading...</span></div>
                  : <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:8,color:'var(--gray-500)' }}><Upload size={22}/><span style={{ fontSize:'0.875rem',fontWeight:500 }}>Click to upload</span><span style={{ fontSize:'0.78rem' }}>JPG, JPEG, PNG, WEBP</span></div>
                }
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePhotoUpload} style={{ display:'none' }} disabled={uploading}/>
              </label>
            )}
            {previewUrl && (
              <div style={{ marginTop:12,display:'flex',alignItems:'center',gap:12 }}>
                {imgError
                  ? <div style={{ width:56,height:56,borderRadius:8,background:'var(--gray-100)',border:'1px solid var(--gray-200)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2 }}><ImageOff size={16} color="var(--gray-400)"/></div>
                  : <img src={previewUrl} alt="Preview" style={{ width:56,height:56,objectFit:'cover',borderRadius:8,border:'1px solid var(--gray-200)' }} onError={()=>setImgError(true)}/>
                }
                <div>
                  <div style={{ fontSize:'0.8rem',fontWeight:500,color:'var(--gray-700)' }}>Photo preview</div>
                  {imgError && <div style={{ fontSize:'0.75rem',color:'var(--warning)',marginTop:2 }}>⚠️ Set Drive file to "Anyone with the link"</div>}
                </div>
              </div>
            )}
          </div>

          {/* QR Preview */}
          {qrPreview && (
            <div style={{ marginTop:4, padding:'14px 16px', background:'var(--gray-50)', borderRadius:'var(--r)', border:'1px solid var(--gray-200)', display:'flex', alignItems:'center', gap:16 }}>
              <img src={qrPreview} alt="QR Code" style={{ width:72,height:72,imageRendering:'pixelated' }}/>
              <div>
                <div style={{ fontWeight:600,fontSize:'0.875rem',color:'var(--gray-800)',marginBottom:3,display:'flex',alignItems:'center',gap:6 }}>
                  <QrCode size={14} color="var(--primary)"/> QR Code Generated
                </div>
                <div style={{ fontSize:'0.78rem',color:'var(--gray-500)' }}>
                  Auto-saved to employee record · Ready to scan
                </div>
                <div style={{ fontSize:'0.75rem',color:'var(--primary)',fontWeight:600,marginTop:2 }}>
                  ID: {form.employee_id || 'No ID yet'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving||uploading}>
            {saving ? <span className="spinner"/> : null}
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  )
}
