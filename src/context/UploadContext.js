import React, { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const UploadContext = createContext(null)

export function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([])

  // Tambah upload baru ke queue
  const addUpload = useCallback(async ({ file, namaBerkas, folderId, profileId, folderName, pegawaiName }) => {
    const uploadId = Date.now()

    // Tambah ke state (status: uploading)
    const newUpload = {
      id: uploadId,
      fileName: file.name,
      namaBerkas,
      status: 'uploading', // uploading, success, error
      progress: 0,
      error: null
    }

    setUploads(prev => [...prev, newUpload])

    try {
      // Buat path storage
      const cleanFolder = folderName.replace(/[^a-zA-Z0-9\s]/g, '').trim()
      const cleanPegawai = pegawaiName.replace(/[^a-zA-Z0-9\s]/g, '').trim()
      const cleanFile = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const timestamp = Date.now()
      const storagePath = `BERKAS PEGAWAI/${cleanFolder}/${cleanPegawai}/${timestamp}_${cleanFile}`

      // Update progress 30%
      setUploads(prev => prev.map(u =>
        u.id === uploadId ? { ...u, progress: 30 } : u
      ))

      // 1. Upload ke Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('berkas-pegawai')
        .upload(storagePath, file, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Update progress 70%
      setUploads(prev => prev.map(u =>
        u.id === uploadId ? { ...u, progress: 70 } : u
      ))

      // 2. Dapatkan URL publik
      const { data: urlData } = supabase.storage
        .from('berkas-pegawai')
        .getPublicUrl(storagePath)

      // 3. Simpan ke database
      const { error: dbError } = await supabase.from('berkas').insert({
        folder_id: folderId,
        profile_id: profileId,
        nama_berkas: namaBerkas,
        lokasi_berkas: urlData.publicUrl
      })

      if (dbError) throw dbError

      // Update progress 100% - SUCCESS
      setUploads(prev => prev.map(u =>
        u.id === uploadId ? { ...u, progress: 100, status: 'success' } : u
      ))

      // Auto remove setelah 5 detik
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== uploadId))
      }, 5000)

      return true
    } catch (err) {
      // ERROR
      setUploads(prev => prev.map(u =>
        u.id === uploadId ? { ...u, status: 'error', error: err.message } : u
      ))

      // Auto remove setelah 8 detik
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== uploadId))
      }, 8000)

      return false
    }
  }, [])

  // Hapus upload dari list
  const removeUpload = useCallback((uploadId) => {
    setUploads(prev => prev.filter(u => u.id !== uploadId))
  }, [])

  return (
    <UploadContext.Provider value={{ uploads, addUpload, removeUpload }}>
      {children}
    </UploadContext.Provider>
  )
}

export const useUpload = () => useContext(UploadContext)