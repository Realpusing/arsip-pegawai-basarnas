import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import emailjs from '@emailjs/browser'
import toast from 'react-hot-toast'

function SettingsPage() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('profile')

  // Profile
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [generatedOTP, setGeneratedOTP] = useState(null)
  const [otpExpiry, setOtpExpiry] = useState(null)
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOTP, setSendingOTP] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  // Success animation
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // ========== COUNTDOWN TIMER ==========
  useEffect(() => {
    let timer
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [countdown])

  // Format countdown
  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Show success notification
  const showSuccessNotif = (message) => {
    setSuccessMessage(message)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 5000)
  }

  // ========== UPDATE NICKNAME ==========
  const handleUpdateNickname = async (e) => {
    e.preventDefault()
    if (!nickname.trim()) { toast.error('Nickname tidak boleh kosong'); return }

    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ nickname: nickname.trim() })
        .eq('id', user.id)

      if (error) throw error

      const updated = { ...user, nickname: nickname.trim() }
      localStorage.setItem('user', JSON.stringify(updated))
      showSuccessNotif('Nickname berhasil diubah!')
      toast.success('Nickname berhasil diubah! Silakan re-login untuk melihat perubahan.')
    } catch (err) {
      if (err.message?.includes('unique')) {
        toast.error('Nickname sudah dipakai orang lain')
      } else {
        toast.error('Gagal: ' + err.message)
      }
    } finally {
      setSavingProfile(false)
    }
  }

  // ========== SEND OTP ==========
  const handleSendOTP = async (e) => {
    e.preventDefault()

    if (!newEmail.trim()) { toast.error('Masukkan email baru'); return }
    if (newEmail === user.email) { toast.error('Email sama dengan yang lama'); return }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) { toast.error('Format email tidak valid'); return }

    // Cek email sudah dipakai
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('email', newEmail.trim())

    if (existingUsers && existingUsers.length > 0) {
      toast.error('Email sudah dipakai user lain')
      return
    }

    setSendingOTP(true)

    // Loading toast
    const loadingToast = toast.loading('📧 Mengirim kode OTP...')

    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expiry = Date.now() + 5 * 60 * 1000 // 5 menit

      // Kirim via EmailJS
      await emailjs.send(
        'service_33ptfui',
        'template_musg9iq',
        {
          email: newEmail.trim(),
          otp_code: otp,
        },
        'qX83Sx8BdTGiXvDE7'
      )

      // Dismiss loading toast
      toast.dismiss(loadingToast)

      setGeneratedOTP(otp)
      setOtpExpiry(expiry)
      setOtpSent(true)
      setCountdown(300) // 5 menit countdown

      // Success notification
      toast.success(
        `✅ Kode OTP berhasil dikirim ke\n${newEmail}\n\nCek inbox atau folder spam!`,
        { duration: 6000 }
      )
    } catch (err) {
      toast.dismiss(loadingToast)
      console.error('EmailJS error:', err)

      // FALLBACK: OTP tampil di toast (untuk testing jika EmailJS gagal)
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expiry = Date.now() + 5 * 60 * 1000

      setGeneratedOTP(otp)
      setOtpExpiry(expiry)
      setOtpSent(true)
      setCountdown(300)

      toast(
        `⚠️ Email gagal terkirim.\n\n[TEST MODE] Kode OTP: ${otp}\n\nGunakan kode ini untuk verifikasi.`,
        { duration: 15000, icon: '🔑' }
      )
    } finally {
      setSendingOTP(false)
    }
  }

  // ========== VERIFY OTP ==========
  const handleVerifyOTP = async (e) => {
    e.preventDefault()

    if (!otpCode.trim()) { toast.error('Masukkan kode OTP'); return }

    // Cek expired
    if (Date.now() > otpExpiry) {
      toast.error('⏰ Kode OTP sudah expired! Silakan kirim ulang.')
      setOtpSent(false)
      setGeneratedOTP(null)
      setOtpCode('')
      setCountdown(0)
      return
    }

    // Cek kode
    if (otpCode.trim() !== generatedOTP) {
      toast.error('❌ Kode OTP salah! Cek kembali email Anda.')
      return
    }

    setVerifying(true)
    const loadingToast = toast.loading('Memverifikasi...')

    try {
      const { error } = await supabase
        .from('users')
        .update({ email: newEmail.trim() })
        .eq('id', user.id)

      if (error) throw error

      toast.dismiss(loadingToast)

      // Update localStorage
      const updated = { ...user, email: newEmail.trim() }
      localStorage.setItem('user', JSON.stringify(updated))

      // Success!
      showSuccessNotif(`Email berhasil diubah ke ${newEmail}`)
      toast.success('🎉 Email berhasil diubah!', { duration: 5000 })

      // Reset semua state
      setNewEmail('')
      setOtpCode('')
      setOtpSent(false)
      setGeneratedOTP(null)
      setCountdown(0)

      // Auto refresh setelah 3 detik
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (err) {
      toast.dismiss(loadingToast)
      toast.error('Gagal: ' + err.message)
    } finally {
      setVerifying(false)
    }
  }

  // ========== RESEND ==========
  const handleResendOTP = () => {
    setOtpSent(false)
    setOtpCode('')
    setGeneratedOTP(null)
    setCountdown(0)
    setTimeout(() => {
      handleSendOTP({ preventDefault: () => {} })
    }, 100)
  }

  // ========== UPDATE PASSWORD ==========
  const handleUpdatePassword = async (e) => {
    e.preventDefault()

    if (!currentPassword) { toast.error('Masukkan password saat ini'); return }
    if (!newPassword) { toast.error('Masukkan password baru'); return }
    if (newPassword.length < 6) { toast.error('Password minimal 6 karakter'); return }
    if (newPassword !== confirmPassword) { toast.error('Konfirmasi password tidak sama'); return }
    if (newPassword === currentPassword) { toast.error('Password baru tidak boleh sama dengan yang lama'); return }

    setSavingPassword(true)
    const loadingToast = toast.loading('Mengubah password...')

    try {
      if (user.password !== currentPassword) {
        toast.dismiss(loadingToast)
        toast.error('❌ Password saat ini salah!')
        setSavingPassword(false)
        return
      }

      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', user.id)

      if (error) throw error

      toast.dismiss(loadingToast)

      const updated = { ...user, password: newPassword }
      localStorage.setItem('user', JSON.stringify(updated))

      showSuccessNotif('Password berhasil diubah!')
      toast.success('🔒 Password berhasil diubah!', { duration: 5000 })

      // Reset
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrentPass(false)
      setShowNewPass(false)
      setShowConfirmPass(false)
    } catch (err) {
      toast.dismiss(loadingToast)
      toast.error('Gagal: ' + err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  // ========== RENDER ==========
  return (
    <div className="max-w-2xl mx-auto">

      {/* Success Notification Banner */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div className="bg-green-500 text-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-green-500 text-xl">✅</span>
            </div>
            <div>
              <p className="font-bold">Berhasil!</p>
              <p className="text-sm text-green-100">{successMessage}</p>
            </div>
            <button onClick={() => setShowSuccess(false)} className="text-green-200 hover:text-white ml-2">✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">⚙️ Pengaturan Akun</h1>
        <p className="text-gray-500 text-sm">Kelola profil, email, dan password</p>
      </div>

      {/* Current Info */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">Info Akun</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400">Nickname</p>
            <p className="text-sm font-medium">{user?.nickname}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400">Email</p>
            <p className="text-sm font-medium truncate">{user?.email}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400">Level</p>
            <p className="text-sm font-medium">{user?.level?.nama}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400">Status</p>
            <p className="text-sm font-medium text-green-600">● Aktif</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'profile', label: '👤 Profil' },
          { id: 'email', label: '📧 Email' },
          { id: 'password', label: '🔒 Password' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border p-6">

        {/* ========== PROFIL ========== */}
        {activeTab === 'profile' && (
          <div>
            <h3 className="text-lg font-bold mb-1">👤 Ubah Nickname</h3>
            <p className="text-gray-400 text-xs mb-4">Nickname digunakan sebagai identitas login Anda</p>
            <form onSubmit={handleUpdateNickname} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nickname Saat Ini</label>
                <input type="text" value={user?.nickname} disabled
                  className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nickname Baru</label>
                <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Masukkan nickname baru" required />
                <p className="text-xs text-gray-400 mt-1">Harus unik, tidak boleh sama dengan user lain</p>
              </div>
              <button type="submit" disabled={savingProfile || nickname === user?.nickname}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50 transition">
                {savingProfile ? '⏳ Menyimpan...' : '💾 Simpan Nickname'}
              </button>
            </form>
          </div>
        )}

        {/* ========== EMAIL ========== */}
        {activeTab === 'email' && (
          <div>
            <h3 className="text-lg font-bold mb-1">📧 Ubah Email</h3>
            <p className="text-gray-400 text-xs mb-4">Verifikasi dengan kode OTP yang dikirim ke email baru</p>

            {!otpSent ? (
              /* STEP 1: Input email baru */
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email Saat Ini</label>
                  <input type="email" value={user?.email} disabled
                    className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email Baru</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="email.baru@example.com" required />
                </div>

                <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700 space-y-1">
                  <p className="font-medium">📧 Cara kerja:</p>
                  <p className="text-xs">1. Masukkan email baru di atas</p>
                  <p className="text-xs">2. Klik "Kirim Kode OTP"</p>
                  <p className="text-xs">3. Cek inbox email baru (atau folder spam)</p>
                  <p className="text-xs">4. Masukkan kode 6 digit untuk verifikasi</p>
                </div>

                <button type="submit" disabled={sendingOTP || !newEmail}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 transition">
                  {sendingOTP ? '⏳ Mengirim kode OTP...' : '📧 Kirim Kode OTP'}
                </button>
              </form>
            ) : (
              /* STEP 2: Input OTP */
              <div className="space-y-4">
                {/* Status Banner */}
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xl">📧</span>
                    </div>
                    <div>
                      <p className="text-sm text-green-700 font-semibold">Kode OTP Terkirim!</p>
                      <p className="text-xs text-green-600 mt-1">
                        Dikirim ke: <b>{newEmail}</b>
                      </p>
                      <p className="text-xs text-green-500 mt-1">
                        Cek inbox atau folder spam email Anda
                      </p>
                    </div>
                  </div>
                </div>

                {/* Countdown Timer */}
                <div className={`rounded-lg p-3 text-center ${
                  countdown > 60 ? 'bg-blue-50' : countdown > 0 ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  {countdown > 0 ? (
                    <div>
                      <p className={`text-2xl font-mono font-bold ${
                        countdown > 60 ? 'text-blue-600' : 'text-yellow-600'
                      }`}>
                        ⏱️ {formatCountdown(countdown)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Waktu tersisa</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-red-600 font-bold">⏰ Kode OTP Expired!</p>
                      <p className="text-xs text-red-500">Silakan kirim ulang</p>
                    </div>
                  )}
                </div>

                {/* OTP Input */}
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-center">Masukkan Kode OTP</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-center text-3xl font-mono tracking-[0.5em] placeholder:tracking-normal placeholder:text-base"
                      placeholder="Masukkan 6 digit"
                      maxLength={6}
                      autoFocus
                      required
                    />
                    {/* OTP Progress Dots */}
                    <div className="flex justify-center gap-2 mt-3">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full transition ${
                            otpCode.length > i ? 'bg-orange-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={verifying || otpCode.length !== 6 || countdown === 0}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 transition"
                    >
                      {verifying ? '⏳ Memverifikasi...' : '✅ Verifikasi & Ubah Email'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false)
                        setOtpCode('')
                        setGeneratedOTP(null)
                        setCountdown(0)
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      ← Ganti email lain
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={sendingOTP || countdown > 240}
                      className="text-sm text-orange-500 hover:text-orange-700 font-medium disabled:opacity-50"
                    >
                      {countdown > 240
                        ? `Kirim ulang dalam ${countdown - 240}s`
                        : '🔄 Kirim Ulang OTP'
                      }
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ========== PASSWORD ========== */}
        {activeTab === 'password' && (
          <div>
            <h3 className="text-lg font-bold mb-1">🔒 Ubah Password</h3>
            <p className="text-gray-400 text-xs mb-4">Pastikan password baru mudah diingat tapi sulit ditebak</p>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium mb-1">Password Saat Ini</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none pr-12"
                    placeholder="Masukkan password lama"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCurrentPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <hr className="my-2" />

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium mb-1">Password Baru</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none pr-12"
                    placeholder="Minimal 6 karakter"
                    minLength={6}
                    required
                  />
                  <button type="button" onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPass ? '🙈' : '👁️'}
                  </button>
                </div>
                {/* Password Strength */}
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      <div className={`h-1.5 flex-1 rounded ${newPassword.length >= 1 ? 'bg-red-400' : 'bg-gray-200'}`} />
                      <div className={`h-1.5 flex-1 rounded ${newPassword.length >= 4 ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                      <div className={`h-1.5 flex-1 rounded ${newPassword.length >= 6 ? 'bg-green-400' : 'bg-gray-200'}`} />
                      <div className={`h-1.5 flex-1 rounded ${newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'bg-green-600' : 'bg-gray-200'}`} />
                    </div>
                    <p className="text-xs mt-1 text-gray-500">
                      {newPassword.length < 6 ? '❌ Terlalu pendek'
                        : newPassword.length < 8 ? '⚠️ Cukup'
                        : /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? '✅ Kuat'
                        : '⚠️ Tambahkan huruf besar & angka'}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-1">Konfirmasi Password Baru</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 outline-none pr-12 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-300 focus:ring-red-500'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-green-300 focus:ring-green-500'
                        : 'focus:ring-orange-500'
                    }`}
                    placeholder="Ulangi password baru"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPass ? '🙈' : '👁️'}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">❌ Password tidak sama</p>
                )}
                {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                  <p className="text-xs text-green-500 mt-1">✅ Password cocok</p>
                )}
              </div>

              <div className="bg-yellow-50 rounded-lg p-3 text-xs text-yellow-700 flex items-start gap-2">
                <span>⚠️</span>
                <div>
                  <p className="font-medium">Penting:</p>
                  <p>Setelah ubah password, Anda perlu login ulang dengan password baru.</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 transition"
              >
                {savingPassword ? '⏳ Menyimpan...' : '🔒 Ubah Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPage