// Hitung masa kerja real-time dari TMT CPNS
export function hitungMasaKerja(tmtCpns) {
    if (!tmtCpns) return { tahun: 0, bulan: 0, hari: 0, text: '-' }
  
    const tmt = new Date(tmtCpns)
    const now = new Date()
  
    let tahun = now.getFullYear() - tmt.getFullYear()
    let bulan = now.getMonth() - tmt.getMonth()
    let hari = now.getDate() - tmt.getDate()
  
    if (hari < 0) {
      bulan--
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      hari += prevMonth.getDate()
    }
  
    if (bulan < 0) {
      tahun--
      bulan += 12
    }
  
    return {
      tahun,
      bulan,
      hari,
      text: `${tahun} tahun ${bulan} bulan ${hari} hari`
    }
  }
  
  // Hitung usia real-time dari tanggal lahir
  export function hitungUsia(tanggalLahir) {
    if (!tanggalLahir) return null
  
    const lahir = new Date(tanggalLahir)
    const now = new Date()
  
    let usia = now.getFullYear() - lahir.getFullYear()
    const m = now.getMonth() - lahir.getMonth()
  
    if (m < 0 || (m === 0 && now.getDate() < lahir.getDate())) {
      usia--
    }
  
    return usia
  }