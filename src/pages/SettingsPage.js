import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import emailjs from '@emailjs/browser'
import toast from 'react-hot-toast'

// ============================================================
// SVG ICONS
// ============================================================
const Icon = {
  User: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Mail: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Lock: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Eye: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  Check: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  Send: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Refresh: (p) => <svg {...p} className={p.className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  ArrowLeft: (p) => <svg {...p} className={p.className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Shield: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Clock: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Alert: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>,
  Settings: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Loader: (p) => <svg className={`${p.className || "w-5 h-5"} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>,
  ChevronRight: (p) => <svg {...p} className={p.className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>,
  Pen: (p) => <svg {...p} className={p.className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  XCircle: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  CheckCircle: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Search: (p) => <svg {...p} className={p.className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Sparkles: (p) => <svg {...p} className={p.className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
}

// ============================================================
// OTP INPUT
// ============================================================
const OTPInput = ({ value, onChange, disabled }) => {
  const refs = useRef([])
  const digits = value.padEnd(6, ' ').split('').slice(0, 6)

  const handleChange = (i, char) => {
    if (!/^\d?$/.test(char)) return
    const arr = [...digits]
    arr[i] = char
    onChange(arr.join('').trim())
    if (char && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i]?.trim() && i > 0) refs.current[i - 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(paste)
    refs.current[Math.min(paste.length, 5)]?.focus()
  }

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i]?.trim() || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={i === 0}
          className={`
            w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 outline-none
            transition-all duration-200
            ${digits[i]?.trim()
              ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm shadow-orange-100'
              : 'border-gray-200 bg-gray-50 text-gray-700'
            }
            focus:border-orange-500 focus:ring-4 focus:ring-orange-100 focus:bg-white focus:scale-105
            disabled:opacity-50
          `}
        />
      ))}
    </div>
  )
}

// ============================================================
// PASSWORD STRENGTH
// ============================================================
const PasswordStrength = ({ password }) => {
  if (!password) return null
  const checks = {
    length: password.length >= 6,
    medium: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const score = Object.values(checks).filter(Boolean).length
  const labels = ['', 'Sangat Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat']
  const colors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-500']
  const textColors = ['', 'text-red-500', 'text-orange-500', 'text-yellow-600', 'text-green-500', 'text-green-600']

  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
            {score >= i && <div className={`h-full rounded-full ${colors[score]} transition-all duration-500`} />}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold ${textColors[score]}`}>{labels[score]}</p>
        <div className="flex gap-2 text-[10px] font-medium">
          <span className={checks.upper ? 'text-green-500' : 'text-gray-300'}>A-Z</span>
          <span className={checks.number ? 'text-green-500' : 'text-gray-300'}>0-9</span>
          <span className={checks.special ? 'text-green-500' : 'text-gray-300'}>!@#</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// NICKNAME STATUS
// ============================================================
const NicknameStatusUI = ({ status }) => {
  switch (status) {
    case 'checking':
      return (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <Icon.Loader className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 font-medium">Memeriksa ketersediaan nickname...</span>
        </div>
      )
    case 'available':
      return (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
          <Icon.CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-xs text-green-600 font-semibold">Nickname tersedia!</span>
        </div>
      )
    case 'taken':
      return (
        <div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-red-50 rounded-lg border border-red-200">
          <Icon.XCircle className="w-4 h-4 text-red-500 shrink-0" />
          <div>
            <span className="text-xs text-red-600 font-semibold block">Nickname sudah digunakan!</span>
            <span className="text-[11px] text-red-400">Pilih nickname lain.</span>
          </div>
        </div>
      )
    case 'same':
      return (
        <div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-200">
          <Icon.Alert className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-600 font-semibold">Sama dengan nickname saat ini</span>
        </div>
      )
    case 'too_short':
      return (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
          <Icon.XCircle className="w-4 h-4 text-red-500" />
          <span className="text-xs text-red-600 font-semibold">Nickname minimal 2 karakter</span>
        </div>
      )
    default:
      return null
  }
}

// ============================================================
// ✅ SUCCESS BANNER (animasi setelah berhasil)
// ============================================================
const SuccessBanner = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 animate-[slideDown_0.3s_ease-out]">
      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
        <Icon.CheckCircle className="w-5 h-5 text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-green-700">{message}</p>
        <p className="text-[11px] text-green-500 mt-0.5">Perubahan langsung diterapkan</p>
      </div>
      <button onClick={onDismiss} className="text-green-400 hover:text-green-600 shrink-0">
        <Icon.XCircle className="w-5 h-5" />
      </button>
    </div>
  )
}

// ============================================================
// MAIN
// ============================================================
function SettingsPage() {
  // ✅ Ambil updateUser dari context
  const { user, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')

  // ✅ Success banner
  const [successMsg, setSuccessMsg] = useState(null)

  // Profile
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [nicknameStatus, setNicknameStatus] = useState(null)
  const nicknameCheckTimer = useRef(null)

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [generatedOTP, setGeneratedOTP] = useState(null)
  const [otpExpiry, setOtpExpiry] = useState(null)
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOTP, setSendingOTP] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [emailStatus, setEmailStatus] = useState(null)
  const emailCheckTimer = useRef(null)

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  // ✅ Sync nickname state ketika user berubah dari context
  useEffect(() => {
    if (user?.nickname) setNickname(user.nickname)
  }, [user?.nickname])

  // ========== COUNTDOWN ==========
  useEffect(() => {
    let timer
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0 }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [countdown])

  const formatCountdown = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // ========== REALTIME NICKNAME CHECK ==========
  const checkNicknameAvailability = useCallback(async (name) => {
    const trimmed = name.trim()
    if (!trimmed) { setNicknameStatus(null); return }
    if (trimmed.length < 2) { setNicknameStatus('too_short'); return }
    if (trimmed === user?.nickname) { setNicknameStatus('same'); return }

    setNicknameStatus('checking')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('nickname', trimmed)
        .neq('id', user?.id || '')

      if (error) { setNicknameStatus(null); return }
      setNicknameStatus(data && data.length > 0 ? 'taken' : 'available')
    } catch {
      setNicknameStatus(null)
    }
  }, [user?.nickname, user?.id])

  const handleNicknameChange = (value) => {
    setNickname(value)
    if (nicknameCheckTimer.current) clearTimeout(nicknameCheckTimer.current)
    nicknameCheckTimer.current = setTimeout(() => checkNicknameAvailability(value), 500)
  }

  // ========== REALTIME EMAIL CHECK ==========
  const checkEmailAvailability = useCallback(async (email) => {
    const trimmed = email.trim()
    if (!trimmed) { setEmailStatus(null); return }
    if (trimmed === user?.email) { setEmailStatus('same'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailStatus('invalid'); return }

    setEmailStatus('checking')
    try {
      const { data } = await supabase.from('users').select('id').eq('email', trimmed)
      setEmailStatus(data && data.length > 0 ? 'taken' : 'available')
    } catch { setEmailStatus(null) }
  }, [user?.email])

  const handleEmailChange = (value) => {
    setNewEmail(value)
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current)
    emailCheckTimer.current = setTimeout(() => checkEmailAvailability(value), 500)
  }

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (nicknameCheckTimer.current) clearTimeout(nicknameCheckTimer.current)
      if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current)
    }
  }, [])

  // ========== STYLING HELPERS ==========
  const getNicknameBorderClass = () => {
    switch (nicknameStatus) {
      case 'available': return 'border-green-300 focus:border-green-400 focus:ring-green-50'
      case 'taken': return 'border-red-300 focus:border-red-400 focus:ring-red-50'
      case 'same': return 'border-amber-300 focus:border-amber-400 focus:ring-amber-50'
      case 'too_short': return 'border-red-300 focus:border-red-400 focus:ring-red-50'
      default: return 'border-gray-200 focus:border-orange-400 focus:ring-orange-50'
    }
  }

  const getNicknameRightIcon = () => {
    switch (nicknameStatus) {
      case 'checking': return <Icon.Loader className="w-4 h-4 text-gray-400" />
      case 'available': return <Icon.CheckCircle className="w-4 h-4 text-green-500" />
      case 'taken': return <Icon.XCircle className="w-4 h-4 text-red-500" />
      case 'same': return <Icon.Alert className="w-4 h-4 text-amber-500" />
      case 'too_short': return <Icon.XCircle className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  const getEmailBorderClass = () => {
    switch (emailStatus) {
      case 'available': return 'border-green-300 focus:border-green-400 focus:ring-green-50'
      case 'taken': return 'border-red-300 focus:border-red-400 focus:ring-red-50'
      case 'same': return 'border-amber-300 focus:border-amber-400 focus:ring-amber-50'
      case 'invalid': return 'border-red-300 focus:border-red-400 focus:ring-red-50'
      default: return 'border-gray-200 focus:border-blue-400 focus:ring-blue-50'
    }
  }

  const getEmailRightIcon = () => {
    switch (emailStatus) {
      case 'checking': return <Icon.Loader className="w-4 h-4 text-gray-400" />
      case 'available': return <Icon.CheckCircle className="w-4 h-4 text-green-500" />
      case 'taken': return <Icon.XCircle className="w-4 h-4 text-red-500" />
      case 'same': return <Icon.Alert className="w-4 h-4 text-amber-500" />
      case 'invalid': return <Icon.XCircle className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  const getEmailStatusUI = () => {
    switch (emailStatus) {
      case 'checking':
        return (<div className="flex items-center gap-2 mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"><Icon.Loader className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500 font-medium">Memeriksa email...</span></div>)
      case 'available':
        return (<div className="flex items-center gap-2 mt-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200"><Icon.CheckCircle className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 font-semibold">Email tersedia!</span></div>)
      case 'taken':
        return (<div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-red-50 rounded-lg border border-red-200"><Icon.XCircle className="w-4 h-4 text-red-500 shrink-0" /><div><span className="text-xs text-red-600 font-semibold block">Email sudah digunakan!</span><span className="text-[11px] text-red-400">Gunakan email lain.</span></div></div>)
      case 'same':
        return (<div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-200"><Icon.Alert className="w-4 h-4 text-amber-500 shrink-0" /><span className="text-xs text-amber-600 font-semibold">Sama dengan email saat ini</span></div>)
      case 'invalid':
        return (<div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-red-50 rounded-lg border border-red-200"><Icon.XCircle className="w-4 h-4 text-red-500 shrink-0" /><div><span className="text-xs text-red-600 font-semibold block">Format email tidak valid</span><span className="text-[11px] text-red-400">Contoh: nama@email.com</span></div></div>)
      default: return null
    }
  }

  // ================================================================
  // ✅ NICKNAME UPDATE — Langsung berubah tanpa reload
  // ================================================================
  const handleUpdateNickname = async (e) => {
    e.preventDefault()
    const trimmed = nickname.trim()

    if (!trimmed) { toast.error('Nickname tidak boleh kosong'); return }
    if (trimmed.length < 2) { toast.error('Nickname minimal 2 karakter'); return }
    if (trimmed === user?.nickname) { toast.error('Nickname sama dengan yang sekarang'); return }
    if (!user?.id) { toast.error('Sesi tidak valid. Login ulang.'); return }
    if (nicknameStatus !== 'available') { toast.error('Nickname tidak tersedia'); return }

    setSavingProfile(true)
    const lt = toast.loading('Menyimpan nickname...')

    try {
      // Double-check duplikat
      const { data: existing } = await supabase
        .from('users').select('id').eq('nickname', trimmed).neq('id', user.id)

      if (existing && existing.length > 0) {
        toast.dismiss(lt)
        toast.error('Nickname sudah dipakai!')
        setNicknameStatus('taken')
        return
      }

      const { data: updated, error } = await supabase
        .from('users')
        .update({ nickname: trimmed })
        .eq('id', user.id)
        .select()

      if (error) throw error
      if (!updated || updated.length === 0) throw new Error('Update gagal')

      toast.dismiss(lt)

      // ✅ LANGSUNG UPDATE CONTEXT — tanpa reload!
      updateUser({ nickname: trimmed })

      // ✅ Reset form state
      setNicknameStatus('same') // karena sekarang sudah jadi nickname aktif
      setSuccessMsg(`Nickname berhasil diubah menjadi "${trimmed}"`)

      toast.success(`Nickname → "${trimmed}" ✨`, { duration: 3000 })

    } catch (err) {
      toast.dismiss(lt)
      if (err.message?.includes('unique') || err.code === '23505') {
        toast.error('Nickname sudah dipakai!')
        setNicknameStatus('taken')
      } else {
        toast.error('Gagal: ' + (err.message || 'Error'))
      }
    } finally {
      setSavingProfile(false)
    }
  }

  // ================================================================
  // ✅ EMAIL — SEND OTP
  // ================================================================
  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (!newEmail.trim()) { toast.error('Masukkan email baru'); return }
    if (emailStatus !== 'available') {
      if (emailStatus === 'same') toast.error('Email sama dengan yang lama')
      else if (emailStatus === 'taken') toast.error('Email sudah dipakai')
      else if (emailStatus === 'invalid') toast.error('Format email tidak valid')
      else toast.error('Tunggu pengecekan selesai')
      return
    }

    setSendingOTP(true)
    const lt = toast.loading('Mengirim kode OTP...')
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expiry = Date.now() + 5 * 60 * 1000
      await emailjs.send('service_33ptfui', 'template_musg9iq', { email: newEmail.trim(), otp_code: otp }, 'qX83Sx8BdTGiXvDE7')
      toast.dismiss(lt)
      setGeneratedOTP(otp); setOtpExpiry(expiry); setOtpSent(true); setCountdown(300)
      toast.success(`OTP terkirim ke ${newEmail}`)
    } catch {
      toast.dismiss(lt)
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      setGeneratedOTP(otp); setOtpExpiry(Date.now() + 5 * 60 * 1000); setOtpSent(true); setCountdown(300)
      toast(`[TEST] Kode OTP: ${otp}`, { duration: 15000, icon: '🔑' })
    } finally { setSendingOTP(false) }
  }

  // ================================================================
  // ✅ EMAIL — VERIFY OTP — Langsung berubah tanpa reload
  // ================================================================
  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    if (!otpCode.trim()) { toast.error('Masukkan kode OTP'); return }
    if (Date.now() > otpExpiry) {
      toast.error('OTP expired!'); setOtpSent(false); setGeneratedOTP(null); setOtpCode(''); setCountdown(0); return
    }
    if (otpCode.trim() !== generatedOTP) { toast.error('Kode OTP salah!'); return }

    setVerifying(true)
    const lt = toast.loading('Memverifikasi...')
    try {
      const { data: updated, error } = await supabase
        .from('users')
        .update({ email: newEmail.trim() })
        .eq('id', user.id)
        .select()

      if (error) throw error
      if (!updated || updated.length === 0) throw new Error('Update email gagal')

      toast.dismiss(lt)

      // ✅ LANGSUNG UPDATE CONTEXT — tanpa reload!
      updateUser({ email: newEmail.trim() })

      // ✅ Reset semua state email
      setNewEmail('')
      setOtpCode('')
      setOtpSent(false)
      setGeneratedOTP(null)
      setCountdown(0)
      setEmailStatus(null)

      setSuccessMsg(`Email berhasil diubah menjadi "${newEmail.trim()}"`)
      toast.success('Email berhasil diubah! ✨', { duration: 3000 })

    } catch (err) {
      toast.dismiss(lt)
      toast.error('Gagal: ' + err.message)
    } finally { setVerifying(false) }
  }

  const handleResendOTP = () => {
    setOtpSent(false); setOtpCode(''); setGeneratedOTP(null); setCountdown(0)
    setTimeout(() => handleSendOTP({ preventDefault: () => { } }), 100)
  }

  // ================================================================
  // ✅ PASSWORD — Langsung berubah tanpa reload
  // ================================================================
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!newPassword) { toast.error('Masukkan password baru'); return }
    if (newPassword.length < 6) { toast.error('Password minimal 6 karakter'); return }
    if (newPassword !== confirmPassword) { toast.error('Konfirmasi tidak sama'); return }
    if (!user?.id) { toast.error('Sesi tidak valid'); return }

    setSavingPassword(true)
    const lt = toast.loading('Mengubah password...')
    try {
      const { data: updated, error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', user.id)
        .select()

      if (error) throw error
      if (!updated || updated.length === 0) throw new Error('Update gagal')

      toast.dismiss(lt)

      // ✅ LANGSUNG UPDATE CONTEXT — tanpa reload!
      updateUser({ password: newPassword })

      // ✅ Reset form
      setNewPassword('')
      setConfirmPassword('')
      setShowNewPass(false)
      setShowConfirmPass(false)

      setSuccessMsg('Password berhasil diubah!')
      toast.success('Password berhasil diubah! ✨', { duration: 3000 })

    } catch (err) {
      toast.dismiss(lt)
      toast.error('Gagal: ' + (err.message || 'Error'))
    } finally { setSavingPassword(false) }
  }

  // ========== TABS ==========
  const tabs = [
    { id: 'profile', label: 'Profil', desc: 'Ubah nickname', icon: Icon.User, color: 'orange' },
    { id: 'email', label: 'Email', desc: 'Ubah alamat email', icon: Icon.Mail, color: 'blue' },
    { id: 'password', label: 'Password', desc: 'Ubah kata sandi', icon: Icon.Lock, color: 'purple' },
  ]

  const colorMap = {
    orange: { activeBg: 'bg-orange-500', ring: 'ring-orange-200', icon: 'bg-orange-100 text-orange-600' },
    blue: { activeBg: 'bg-blue-500', ring: 'ring-blue-200', icon: 'bg-blue-100 text-blue-600' },
    purple: { activeBg: 'bg-purple-500', ring: 'ring-purple-200', icon: 'bg-purple-100 text-purple-600' },
  }

  const getInitials = (name) => name ? name.slice(0, 2).toUpperCase() : '?'

  const canSubmitNickname = !savingProfile
    && nickname.trim().length >= 2
    && nickname.trim() !== user?.nickname
    && nicknameStatus === 'available'

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">

      {/* ===== HEADER — ✅ Otomatis update karena pakai user dari context ===== */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 px-6 py-6 -mx-6 -mt-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-white/10 rounded-full" />

        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-lg">
            <span className="text-2xl font-black text-white">{getInitials(user?.nickname)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Icon.Settings className="w-6 h-6" />
              Pengaturan
            </h1>
            <p className="text-white/70 text-sm mt-0.5">Kelola profil, email, dan keamanan akun Anda</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-white">Online</span>
          </div>
        </div>

        {/* ✅ Info cards — otomatis update dari context */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Nickname', value: user?.nickname || '-', icon: '👤' },
            { label: 'Email', value: user?.email || '-', icon: '📧' },
            { label: 'Level', value: user?.level?.nama || '-', icon: '⭐' },
            { label: 'Status', value: 'Aktif', icon: '✅' },
          ].map((item, i) => (
            <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/10">
              <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider flex items-center gap-1">
                <span>{item.icon}</span> {item.label}
              </p>
              <p className="text-sm font-bold text-white truncate mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ SUCCESS BANNER */}
      {successMsg && (
        <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}

      {/* ===== LAYOUT ===== */}
      <div className="flex-1 flex flex-col lg:flex-row gap-5">

        {/* --- SIDEBAR --- */}
        <div className="lg:w-64 shrink-0 space-y-2">
          {tabs.map(tab => {
            const active = activeTab === tab.id
            const c = colorMap[tab.color]
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left
                  transition-all duration-200 group
                  ${active
                    ? `bg-white shadow-lg ring-2 ${c.ring}`
                    : 'bg-white/60 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100'
                  }
                `}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200
                  ${active ? `${c.activeBg} text-white shadow-md` : c.icon}`}>
                  <tab.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${active ? 'text-gray-800' : 'text-gray-600'}`}>{tab.label}</p>
                  <p className="text-[11px] text-gray-400 truncate">{tab.desc}</p>
                </div>
                <Icon.ChevronRight className={`w-4 h-4 transition-all duration-200 
                  ${active ? 'text-gray-400' : 'text-gray-300 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
              </button>
            )
          })}

          <div className="hidden lg:block bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-4 mt-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Icon.Shield className="w-4 h-4 text-green-500" />
              <p className="text-xs font-bold text-gray-600">Keamanan</p>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Pastikan email dan password Anda selalu terupdate untuk keamanan akun.
            </p>
          </div>
        </div>

        {/* --- CONTENT --- */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">

            {/* ================== PROFIL ================== */}
            {activeTab === 'profile' && (
              <div className="p-6 lg:p-8">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                    <Icon.User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Ubah Nickname</h3>
                    <p className="text-sm text-gray-400">Identitas login unik Anda di platform</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateNickname} className="space-y-6 max-w-lg">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Nickname Saat Ini</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icon.User className="w-4 h-4" /></div>
                      {/* ✅ Otomatis update dari context */}
                      <input type="text" value={user?.nickname || ''} disabled
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 cursor-not-allowed" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Nickname Baru</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Pen className="w-4 h-4" /></div>
                      <input
                        type="text"
                        value={nickname}
                        onChange={e => handleNicknameChange(e.target.value)}
                        placeholder="Masukkan nickname baru"
                        className={`w-full pl-11 pr-11 py-3 bg-white border rounded-xl text-sm text-gray-700 
                          outline-none focus:ring-4 transition-all ${getNicknameBorderClass()}`}
                        required
                      />
                      {getNicknameRightIcon() && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {getNicknameRightIcon()}
                        </div>
                      )}
                    </div>
                    <NicknameStatusUI status={nicknameStatus} />
                  </div>

                  <button type="submit" disabled={!canSubmitNickname}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 
                      hover:from-orange-600 hover:to-amber-600 text-white px-8 py-3 rounded-xl font-semibold text-sm
                      shadow-lg shadow-orange-200 hover:shadow-xl hover:-translate-y-0.5
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 
                      active:scale-[0.98] transition-all duration-200">
                    {savingProfile
                      ? <><Icon.Loader className="w-4 h-4" /> Menyimpan...</>
                      : <><Icon.Sparkles className="w-4 h-4" /> Simpan Nickname</>}
                  </button>
                </form>
              </div>
            )}

            {/* ================== EMAIL ================== */}
            {activeTab === 'email' && (
              <div className="p-6 lg:p-8">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                    <Icon.Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Ubah Email</h3>
                    <p className="text-sm text-gray-400">Verifikasi dengan kode OTP 6 digit</p>
                  </div>
                </div>

                {!otpSent ? (
                  <form onSubmit={handleSendOTP} className="space-y-6 max-w-lg">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Email Saat Ini</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Mail className="w-4 h-4" /></div>
                        {/* ✅ Otomatis update dari context */}
                        <input type="email" value={user?.email || ''} disabled
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 cursor-not-allowed" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Email Baru</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Mail className="w-4 h-4" /></div>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={e => handleEmailChange(e.target.value)}
                          placeholder="email.baru@example.com"
                          className={`w-full pl-11 pr-11 py-3 bg-white border rounded-xl text-sm text-gray-700 
                            outline-none focus:ring-4 transition-all ${getEmailBorderClass()}`}
                          required
                        />
                        {getEmailRightIcon() && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">{getEmailRightIcon()}</div>
                        )}
                      </div>
                      {getEmailStatusUI()}
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                      <p className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                        <Icon.Shield className="w-4 h-4" /> Cara Kerja
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { step: '1', text: 'Masukkan email baru' },
                          { step: '2', text: 'Klik "Kirim Kode OTP"' },
                          { step: '3', text: 'Cek inbox / spam' },
                          { step: '4', text: 'Input kode 6 digit' },
                        ].map((s, i) => (
                          <div key={i} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5">
                            <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
                            <span className="text-xs text-blue-600 font-medium">{s.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button type="submit" disabled={sendingOTP || !newEmail || emailStatus !== 'available'}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 
                        hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-3 rounded-xl font-semibold text-sm
                        shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 
                        active:scale-[0.98] transition-all duration-200">
                      {sendingOTP
                        ? <><Icon.Loader className="w-4 h-4" /> Mengirim...</>
                        : <><Icon.Send className="w-4 h-4" /> Kirim Kode OTP</>}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6 max-w-lg mx-auto">
                    <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                          <Icon.Check className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-green-700">Kode OTP Terkirim!</p>
                          <p className="text-xs text-green-600 mt-1 truncate">Ke: <b className="font-mono">{newEmail}</b></p>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-2xl p-5 text-center border transition-colors ${countdown > 60 ? 'bg-blue-50 border-blue-200' : countdown > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                      {countdown > 0 ? (
                        <>
                          <div className="flex items-center justify-center gap-3">
                            <Icon.Clock className={`w-6 h-6 ${countdown > 60 ? 'text-blue-500' : 'text-amber-500'}`} />
                            <span className={`text-4xl font-mono font-black tracking-wider ${countdown > 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                              {formatCountdown(countdown)}
                            </span>
                          </div>
                          <div className="mt-3 h-2 bg-white rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-1000 ${countdown > 60 ? 'bg-blue-400' : 'bg-amber-400'}`}
                              style={{ width: `${(countdown / 300) * 100}%` }} />
                          </div>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-red-600">OTP Expired!</p>
                      )}
                    </div>

                    <form onSubmit={handleVerifyOTP} className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-4 text-center">Masukkan Kode Verifikasi</label>
                        <OTPInput value={otpCode} onChange={setOtpCode} disabled={countdown === 0} />
                        <div className="flex justify-center gap-1.5 mt-4">
                          {[0, 1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${otpCode.length > i ? 'bg-orange-400 scale-125' : 'bg-gray-200'}`} />
                          ))}
                        </div>
                      </div>

                      <button type="submit" disabled={verifying || otpCode.length !== 6 || countdown === 0}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 
                          hover:from-green-600 hover:to-emerald-600 text-white py-3.5 rounded-xl font-semibold text-sm
                          shadow-lg shadow-green-200 hover:shadow-xl hover:-translate-y-0.5
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 
                          active:scale-[0.98] transition-all duration-200">
                        {verifying
                          ? <><Icon.Loader className="w-4 h-4" /> Memverifikasi...</>
                          : <><Icon.Sparkles className="w-4 h-4" /> Verifikasi & Ubah Email</>}
                      </button>

                      <div className="flex items-center justify-between">
                        <button type="button"
                          onClick={() => { setOtpSent(false); setOtpCode(''); setGeneratedOTP(null); setCountdown(0) }}
                          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1.5">
                          <Icon.ArrowLeft className="w-3.5 h-3.5" /> Ganti email
                        </button>
                        <button type="button" onClick={handleResendOTP}
                          disabled={sendingOTP || countdown > 240}
                          className="text-sm text-blue-500 hover:text-blue-700 font-semibold flex items-center gap-1.5 disabled:opacity-50">
                          <Icon.Refresh className="w-3.5 h-3.5" />
                          {countdown > 240 ? `Tunggu ${countdown - 240}s` : 'Kirim Ulang'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ================== PASSWORD ================== */}
            {activeTab === 'password' && (
              <div className="p-6 lg:p-8">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                    <Icon.Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Ubah Password</h3>
                    <p className="text-sm text-gray-400">Buat password baru yang kuat</p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-lg">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Password Baru</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Lock className="w-4 h-4" /></div>
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 
                          outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-50 transition-all"
                        required
                      />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showNewPass ? <Icon.EyeOff className="w-4 h-4" /> : <Icon.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={newPassword} />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Konfirmasi Password</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Shield className="w-4 h-4" /></div>
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru"
                        className={`w-full pl-11 pr-12 py-3 bg-white border rounded-xl text-sm text-gray-700 
                          outline-none transition-all focus:ring-4
                          ${confirmPassword && confirmPassword !== newPassword
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-50'
                            : confirmPassword && confirmPassword === newPassword && newPassword.length >= 6
                              ? 'border-green-300 focus:border-green-400 focus:ring-green-50'
                              : 'border-gray-200 focus:border-purple-400 focus:ring-purple-50'
                          }`}
                        required
                      />
                      <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirmPass ? <Icon.EyeOff className="w-4 h-4" /> : <Icon.Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
                        <Icon.XCircle className="w-3.5 h-3.5" /> Password tidak sama
                      </p>
                    )}
                    {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                      <p className="text-xs text-green-500 mt-2 flex items-center gap-1.5">
                        <Icon.CheckCircle className="w-3.5 h-3.5" /> Password cocok!
                      </p>
                    )}
                  </div>

                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                      <Icon.Alert className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-700">Penting</p>
                      <p className="text-xs text-amber-600 mt-0.5">Password langsung berubah. Gunakan password baru untuk login berikutnya.</p>
                    </div>
                  </div>

                  <button type="submit"
                    disabled={savingPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-violet-500 
                      hover:from-purple-600 hover:to-violet-600 text-white px-8 py-3 rounded-xl font-semibold text-sm
                      shadow-lg shadow-purple-200 hover:shadow-xl hover:-translate-y-0.5
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 
                      active:scale-[0.98] transition-all duration-200">
                    {savingPassword
                      ? <><Icon.Loader className="w-4 h-4" /> Menyimpan...</>
                      : <><Icon.Sparkles className="w-4 h-4" /> Ubah Password</>}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage