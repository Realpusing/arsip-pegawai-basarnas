import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import toast, { Toaster } from 'react-hot-toast'

const backgrounds = [
  '/backgrounds/cb64d2b1-0189-4b49-82a8-5d91df638c01.jpg',
  '/backgrounds/knseta.jpeg',
  '/backgrounds/bg3.jpg',
]

function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [bgIndex, setBgIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex(prev => (prev + 1) % backgrounds.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  // Hilangkan error saat user ketik ulang
  useEffect(() => {
    if (email || password) setError('')
  }, [email, password])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(email, password)
      toast.success('Login berhasil!')
    } catch (err) {
      const msg = err?.message?.toLowerCase() || ''
      if (msg.includes('invalid') || msg.includes('wrong') || msg.includes('password') || msg.includes('credential') || msg.includes('401')) {
        setError('Email atau password salah. Silakan coba lagi.')
      } else if (msg.includes('not found') || msg.includes('tidak ditemukan')) {
        setError('Akun tidak ditemukan. Periksa kembali email Anda.')
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('server')) {
        setError('Gagal terhubung ke server. Periksa koneksi internet Anda.')
      } else {
        setError(err.message || 'Terjadi kesalahan. Silakan coba lagi.')
      }
    } finally {
      setLoading(false)
    }
  }

  const tanggal = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="fixed inset-0 overflow-hidden">
      <Toaster position="top-center" />

      {/* BACKGROUND SLIDESHOW */}
      {backgrounds.map((url, i) => (
        <div
          key={i}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2000ms]"
          style={{
            backgroundImage: `url(${url})`,
            opacity: bgIndex === i ? 1 : 0,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 h-full flex flex-col">

        {/* HEADER */}
        <header className="relative z-20">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="/logos/Lambang_BPP.png" alt="BPP" className="h-10 sm:h-14 object-contain drop-shadow-lg" />
              <img src="/logos/LOGO_BASARNAS.png" alt="BASARNAS" className="h-10 sm:h-14 object-contain drop-shadow-lg" />
              <img src="/logos/logo_basarnas_tararakan-removebg-preview.png" alt="Tarakan" className="h-10 sm:h-14 object-contain drop-shadow-lg" />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="/logos/Logo_berakhlak_bangga-1-1024x390-removebg-preview.png" alt="BerAKHLAK" className="h-10 sm:h-14 object-contain drop-shadow-lg" />
              <img src="/logos/White_and_Brown_Minimalist_Easter_Sale_Flyer-removebg-preview.png" alt="We Are Family" className="h-10 sm:h-14 object-contain drop-shadow-lg" />
            </div>
          </div>
        </header>

        {/* TANGGAL */}
        <div className="absolute top-24 sm:top-28 left-0 z-20">
          <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs sm:text-sm font-bold px-4 sm:px-6 py-2 rounded-r-full shadow-lg">
            {tanggal}
          </div>
        </div>

        {/* CENTER */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-[400px]">

            <div className="text-center mb-5">
              <h1 className="text-white text-xl sm:text-2xl font-bold tracking-wide drop-shadow-lg">
                ARSIP PEGAWAI BASARNAS TARAKAN
              </h1>
              <p className="text-white/70 text-sm mt-1 drop-shadow">
                Sistem Informasi Kepegawaian
              </p>
            </div>

            {/* LOGIN CARD */}
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500" />

              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-gray-800 font-bold text-lg leading-tight">Login</h2>
                    <p className="text-gray-400 text-xs">Masukkan kredensial akun Anda</p>
                  </div>
                </div>

                {/* ERROR — SATU NOTIFIKASI SAJA */}
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">Email</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="nama@basarnas.go.id"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">Password</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPw ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Memproses…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Masuk
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* DOTS */}
            <div className="flex justify-center gap-2 mt-5">
              {backgrounds.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setBgIndex(i)}
                  className={`rounded-full transition-all duration-500 ${
                    bgIndex === i ? 'w-6 h-2 bg-orange-400' : 'w-2 h-2 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="relative z-20">
          <div className="bg-gradient-to-r from-red-700 to-red-600 px-4 sm:px-6 py-2.5">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-white text-[11px] sm:text-xs">
              <a href="https://www.tarakan.basarnas.go.id" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-orange-200 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                www.tarakan.basarnas.go.id
              </a>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                0551 5680080
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 00.917.918l4.458-1.495A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.4 0-4.637-.85-6.365-2.265l-.446-.37-3.105 1.04 1.04-3.105-.37-.446A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                0822-5522-6220
              </span>
              <a href="mailto:basarnastrk@gmail.com" className="flex items-center gap-1.5 hover:text-orange-200 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                basarnastrk@gmail.com
              </a>
            </div>
          </div>
          <div className="bg-red-900 px-4 py-1.5">
            <p className="text-white/50 text-[10px] text-center">
              © {new Date().getFullYear()} Kantor SAR Tarakan — Badan SAR Nasional
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default LoginPage