import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

function AbsenPage() {
  const [pegawai, setPegawai] = useState([])
  const [absenList, setAbsenList] = useState([])
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    supabase.from('profile').select('id, nama, nip').order('nama').then(({ data }) => { if (data) setPegawai(data) })
    loadAbsen(tanggal)
  }, [])

  const loadAbsen = async (tgl) => {
    const { data } = await supabase.from('absen').select('*, profile:profile_id(nama, nip)').eq('tanggal', tgl).order('created_at')
    if (data) setAbsenList(data)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      const { error } = await supabase.from('absen').insert({
        profile_id: parseInt(fd.get('profile_id')),
        tanggal: fd.get('tanggal'),
        status_absen: fd.get('status_absen')
      })
      if (error) throw error
      toast.success('Absen disimpan!')
      setShowModal(false)
      loadAbsen(tanggal)
    } catch (err) { toast.error('Gagal: ' + err.message) }
  }

  const handleDelete = async (a) => {
    if (!window.confirm('Hapus absen ini?')) return
    try {
      await supabase.from('absen').delete().eq('id', a.id)
      toast.success('Absen dihapus!')
      loadAbsen(tanggal)
    } catch (err) { toast.error('Gagal: ' + err.message) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 Absensi Pegawai</h1>
        <p className="text-gray-500 text-sm">Input dan kelola absensi (Admin only)</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Tanggal:</label>
            <input type="date" value={tanggal} onChange={e => { setTanggal(e.target.value); loadAbsen(e.target.value) }}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <button onClick={() => setShowModal(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">+ Input Absen</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">NIP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {absenList.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">Belum ada data absen</td></tr>
              ) : absenList.map((a, i) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-mono">{a.profile?.nip}</td>
                  <td className="px-4 py-3 text-sm font-medium">{a.profile?.nama}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      a.status_absen === 'Hadir' ? 'bg-green-100 text-green-700' :
                      a.status_absen === 'Sakit' ? 'bg-yellow-100 text-yellow-700' :
                      a.status_absen === 'Izin' ? 'bg-blue-100 text-blue-700' :
                      a.status_absen === 'Cuti' ? 'bg-purple-100 text-purple-700' :
                      'bg-red-100 text-red-700'
                    }`}>{a.status_absen}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(a)} className="text-red-500 hover:text-red-700 text-sm">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Absen */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">📋 Input Absen</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Pegawai</label>
                <select name="profile_id" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="">Pilih</option>
                  {pegawai.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.nip})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal</label>
                <input name="tanggal" type="date" defaultValue={tanggal} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select name="status_absen" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="Hadir">✅ Hadir</option>
                  <option value="Izin">📝 Izin</option>
                  <option value="Sakit">🏥 Sakit</option>
                  <option value="Cuti">🏖️ Cuti</option>
                  <option value="Alpa">❌ Alpa</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium">Simpan</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AbsenPage