import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys"
import pino from "pino"
import fetch from "node-fetch"
import cron from "node-cron"
import fs from "fs"

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    auth: state
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    } else if (connection === "open") {
      console.log("✅ Bot berhasil terhubung!")
    }
  })

  // ====== FILE DATA JADWAL ======
  if (!fs.existsSync("./jadwal.json")) {
    fs.writeFileSync("./jadwal.json", JSON.stringify({
      aktif: true,
      data: {
        "Senin": ["08.00-10.30 Aplikasi Komputer", "10.30-13.00 Administrasi Sistem", "13.50-15.00 Bahasa Inggris"],
        "Selasa": ["13.50-15.30 Algoritma Pemrograman", "15.30-16.20 Praktikum Algoritma Pemrograman"],
        "Rabu": ["08.00-09.40 Agama", "15.30-17.10 Pancasila"],
        "Kamis": ["08.00-10.30 Kalkulus", "10.30-13.00 Jaringan Komputer Dasar"]
      }
    }, null, 2))
  }

  let jadwal = JSON.parse(fs.readFileSync("./jadwal.json"))
  function saveJadwal() {
    fs.writeFileSync("./jadwal.json", JSON.stringify(jadwal, null, 2))
  }

  // ====== FILE DATA TUGAS ======
  if (!fs.existsSync("./tugas.json")) {
    fs.writeFileSync("./tugas.json", JSON.stringify({
      aktif: true,
      data: []
    }, null, 2))
  }
  let tugas = JSON.parse(fs.readFileSync("./tugas.json"))
  function saveTugas() {
    fs.writeFileSync("./tugas.json", JSON.stringify(tugas, null, 2))
  }

  // ====== FILE CONFIG UNTUK KOTA SHOLAT ======
  if (!fs.existsSync("./config.json")) {
    fs.writeFileSync("./config.json", JSON.stringify({ kota: "Meulaboh" }, null, 2))
  }
  let config = JSON.parse(fs.readFileSync("./config.json"))
  function saveConfig() {
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 2))
  }

  // ====== FORMAT JADWAL ======
  function formatJadwal() {
    let teks = "🎓 *JADWAL KULIAH*\n\n"
    for (let hari in jadwal.data) {
      teks += `📅 ${hari}:\n`
      if (jadwal.data[hari].length === 0) teks += "• (kosong)\n"
      else jadwal.data[hari].forEach((item, i) => teks += `${i + 1}. ${item}\n`)
      teks += "\n"
    }
    return teks
  }

  // ====== FORMAT TUGAS ======
  function formatTugas() {
    if (!tugas.data || tugas.data.length === 0) return "✅ Tidak ada tugas tersimpan."
    let teks = "📚 *DAFTAR TUGAS*\n\n"
    tugas.data.forEach((t, i) => {
      teks += `${i + 1}. ${t.nama}\n🕒 Deadline: ${t.deadline}\n\n`
    })
    return teks
  }

  // ====== HANDLE PESAN ======
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    let text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
    const prefix = "."
    if (!text.startsWith(prefix)) return
    const cmd = text.slice(prefix.length).trim().split(" ")[0].toLowerCase()
    const args = text.split(" ").slice(1).join(" ")
    const sender = msg.pushName || "Pengguna"

    function formatTanggal() {
      const d = new Date()
      const hariList = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
      const pasaran = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"]
      const day = hariList[d.getDay()]
      const pasaranHari = pasaran[d.getDate() % 5]
      const tanggal = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
      const jam = d.toLocaleTimeString("id-ID", { hour12: false })
      return { hari: `${day} ${pasaranHari}`, tanggal, jam }
    }

    switch (cmd) {
      case "jid": {
        await sock.sendMessage(from, { text: `🆔 ID Grup ini:\n${from}` })
      } break

      case "menu": {
        const waktu = formatTanggal()
        await sock.sendMessage(from, {
          image: { url: "./menu.jpg" },
          caption: `
🛡 Alycia Bot
│ 🧜 Nama: ${sender}
│ 👑 Owner: Yuki
│ ⚙️ Versi: 1.0.0
│ 📆 Hari: ${waktu.hari}
│ 🗓️ Tanggal: ${waktu.tanggal}
│ ⏰ Jam: ${waktu.jam}

🛡 *Alycia Menu List*

• .ping
• .jadwalkuliah
• .editjadwal
• .hapusjadwal
• .jadwalon / .jadwaloff
• .tugas / .tambahtugas / .edittugas / .hapustugas
• .tugason / .tugasoff
• .shalat
• .setkota
• .owner
• .azan (Tes suara azan)
`
        })
      } break

      case "ping": await sock.sendMessage(from, { text: "🏓 *Pong!* Bot berjalan normal." }); break
      case "jadwalkuliah": await sock.sendMessage(from, { text: formatJadwal() }); break
      case "jadwalon": jadwal.aktif = true; saveJadwal(); await sock.sendMessage(from, { text: "✅ Pengingat jadwal kuliah diaktifkan." }); break
      case "jadwaloff": jadwal.aktif = false; saveJadwal(); await sock.sendMessage(from, { text: "❌ Pengingat jadwal kuliah dimatikan." }); break

      case "tugas": await sock.sendMessage(from, { text: formatTugas() }); break
      case "tugason": tugas.aktif = true; saveTugas(); await sock.sendMessage(from, { text: "✅ Pengingat tugas diaktifkan." }); break
      case "tugasoff": tugas.aktif = false; saveTugas(); await sock.sendMessage(from, { text: "❌ Pengingat tugas dimatikan." }); break

      case "shalat": {
        try {
          const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(config.kota)}&country=Indonesia&method=2`)
          const data = await res.json()
          const j = data.data.timings
          const tgl = data.data.date.readable
          await sock.sendMessage(from, {
            text: `🕌 *JADWAL SHOLAT ${config.kota.toUpperCase()}*

📅 ${tgl}
🌅 Subuh     : ${j.Fajr}
🌤️ Dzuhur    : ${j.Dhuhr}
🌇 Ashar     : ${j.Asr}
🌆 Maghrib   : ${j.Maghrib}
🌙 Isya      : ${j.Isha}`
          })
        } catch {
          await sock.sendMessage(from, { text: "⚠️ Gagal mengambil jadwal sholat." })
        }
      } break

      case "setkota": {
        if (!args) return sock.sendMessage(from, { text: "⚠️ Contoh: .setkota Banda Aceh" })
        config.kota = args
        saveConfig()
        await sock.sendMessage(from, { text: `✅ Kota sholat diubah ke *${args}*.` })
      } break

      case "azan": {
        await sock.sendMessage(from, {
          audio: { url: "./azan1.mp3" },
          mimetype: "audio/mpeg",
          ptt: false
        })
        await sock.sendMessage(from, { text: "📢 Memutar suara azan..." })
      } break

      case "owner": await sock.sendMessage(from, { text: "👑 Owner: Gibran\nwa.me/6285121084070" }); break
    }
  })

  // ====== PENGINGAT SHOLAT OTOMATIS KE GRUP ======
  const groupID = "120363422769491936@g.us" // ID grup kamu

  async function aturPengingatShalat() {
    try {
      const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(config.kota)}&country=Indonesia&method=2`)
      const data = await res.json()
      const j = data.data.timings

      const waktuList = {
        Subuh: j.Fajr,
        Dzuhur: j.Dhuhr,
        Ashar: j.Asr,
        Maghrib: j.Maghrib,
        Isya: j.Isha
      }

      for (const [nama, waktu] of Object.entries(waktuList)) {
        const [jam, menit] = waktu.split(":")
        cron.schedule(`${menit} ${jam} * * *`, async () => {
          await sock.sendMessage(groupID, { text: `🕌 *Sudah masuk waktu ${nama}!*` })
          await sock.sendMessage(groupID, {
            audio: { url: "./azan1.mp3" },
            mimetype: "audio/mpeg",
            ptt: false
          })
        })
      }

      console.log("✅ Jadwal pengingat shalat diatur.")
    } catch (e) {
      console.error("❌ Gagal mengatur pengingat shalat:", e)
    }
  }

  aturPengingatShalat()
  cron.schedule("1 0 * * *", aturPengingatShalat)
}

startBot()
