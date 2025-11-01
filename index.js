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
        "Senin": ["08.00-10.30 Aplikasi Komputer", "10.30-13.00 Administrasi Sistem", "13.50-15.00 Bahasa I>
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
  if (tugas.data.length === 0) return "✅ Tidak ada tugas tersimpan."
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
      case "menu": {
        const waktu = formatTanggal()
        await sock.sendMessage(from, {
          image: { url: "./menu.jpg" },
          caption: `
 🛡Alycia Bot
│ 🧜 𝗡𝗔𝗠𝗔       : ${sender}
│ 🛠  𝗕𝗢𝗧        : Alycia Clarissa
│ 👑 𝗢𝗪𝗡𝗘𝗥      : Yuki
│ ⚙️  𝗩𝗘𝗥𝗦       : 1.0.0
│ 📸 𝗦𝗧𝗔𝗧𝗨𝗦     : public
│ 🗓  𝗛𝗔𝗥𝗜       : ${waktu.hari}
│ 📆 𝗧𝗔𝗡𝗚𝗚𝗔𝗟    : ${waktu.tanggal}
│ ⏳️ 𝗝𝗔𝗠        : ${waktu.jam}


🛡 *Alycia Menu list*

• .ping
• .jadwalkuliah
• .editjadwal
• .hapusjadwal
• .jadwalon / .jadwaloff
• .tugas / .edittugas / .hapustugas
• .tugason / .tugasoff
• .shalat
• .owner
`
        })
      }
      break

      case "ping": await sock.sendMessage(from, { text: "🏓 *Pong!* Bot berjalan normal." }); break
      case "jadwalkuliah": await sock.sendMessage(from, { text: formatJadwal() }); break

      // ==== EDIT JADWAL ====
      case "editjadwal": {
        if (!args.includes("|")) return sock.sendMessage(from, { text: "❌ Format salah!\nContoh: .editjadw>
        const [hari, isi] = args.split("|").map(a => a.trim())
        if (!jadwal.data[hari]) jadwal.data[hari] = []
        jadwal.data[hari].push(isi)
        saveJadwal()
        await sock.sendMessage(from, { text: `✅ Jadwal *${hari}* ditambah:\n${isi}` })
      } break

      // ==== HAPUS JADWAL ====
      case "hapusjadwal": {
        if (!args.includes("|")) return sock.sendMessage(from, { text: "❌ Format salah!\nContoh: .hapusjad>
        const [hari, nomor] = args.split("|").map(a => a.trim())
        const index = parseInt(nomor) - 1
        if (!jadwal.data[hari] || !jadwal.data[hari][index]) return sock.sendMessage(from, { text: `⚠️ Tidak>
        const hapus = jadwal.data[hari].splice(index, 1)
        saveJadwal()
        await sock.sendMessage(from, { text: `🗑️ Jadwal "${hapus[0]}" di *${hari}* dihapus.` })
      } break

      // ==== AKTIF/MATIKAN PENGINGAT JADWAL ====
      case "jadwalon": jadwal.aktif = true; saveJadwal(); await sock.sendMessage(from, { text: "✅ Penginga>
      case "jadwaloff": jadwal.aktif = false; saveJadwal(); await sock.sendMessage(from, { text: "❌ Pengin>

      // ==== FITUR TUGAS ====
      case "tugas": await sock.sendMessage(from, { text: formatTugas() }); break
      case "tugason": tugas.aktif = true; saveTugas(); await sock.sendMessage(from, { text: "✅ Pengingat t>
      case "tugasoff": tugas.aktif = false; saveTugas(); await sock.sendMessage(from, { text: "❌ Pengingat>

      case "tambahtugas": {
        if (!args.includes("|")) return sock.sendMessage(from, { text: "❌ Format salah!\nContoh: .tambahtu>
        const [nama, deadline] = args.split("|").map(a => a.trim())
        tugas.data.push({ nama, deadline })
        saveTugas()
        await sock.sendMessage(from, { text: `✅ *Tugas disimpan!*\n📌 ${nama}\n⏳ Deadline: ${deadline}` })
      } break

      case "edittugas": {
        if (!args.includes("|")) return sock.sendMessage(from, { text: "❌ Format salah!\nContoh: .edittuga>
        const [nomor, nama, deadline] = args.split("|").map(a => a.trim())
        const index = parseInt(nomor) - 1
        if (!tugas.data[index]) return sock.sendMessage(from, { text: `⚠️ Tidak ada tugas nomor ${nomor}` })
        tugas.data[index] = { nama, deadline }
        saveTugas()
        await sock.sendMessage(from, { text: `✏️ Tugas nomor ${nomor} berhasil diubah.` })
      } break

      case "hapustugas": {
        if (!args) return sock.sendMessage(from, { text: "❌ Contoh: .hapustugas 1" })
        const index = parseInt(args) - 1
        if (!tugas.data[index]) return sock.sendMessage(from, { text: `⚠️ Tidak ada tugas nomor ${args}` })
        const hapus = tugas.data.splice(index, 1)
        saveTugas()
        await sock.sendMessage(from, { text: `🗑️ Tugas "${hapus[0].nama}" dihapus.` })
      } break

// ==== SHOLAT ====
      case "shalat": {
        try {
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, "/")
          const res = await fetch(`https://api.myquran.com/v1/sholat/jadwal/1101/${today}`)
          const data = await res.json()
          const j = data.data.jadwal
          await sock.sendMessage(from, {
            text: `🕌 *JADWAL SHOLAT ACEH BARAT (MEULABOH)*

📅 ${j.tanggal}
🌅 Subuh     : ${j.subuh}
🌤️ Dzuhur    : ${j.dzuhur}
🌇 Ashar     : ${j.ashar}
🌆 Maghrib   : ${j.maghrib}
🌙 Isya      : ${j.isya}`
          })
        } catch {
          await sock.sendMessage(from, { text: "⚠️ Gagal mengambil jadwal sholat." })
        }
      } break

      // ==== OWNER ====
      case "owner": await sock.sendMessage(from, { text: "👑 Owner: Gibran\nwa.me/6285121084070" }); break
    }
  })

  // ====== PENGINGAT KULIAH JAM 21.00 WIB ======
  cron.schedule("0 21 * * 0-6", () => {
    if (!jadwal.aktif) return
    const hariBesok = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][(new Date().getDay()>
    if (jadwal.data[hariBesok]) {
      let teks = `📚 *JADWAL KULIAH BESOK (${hariBesok})*\n\n`
      jadwal.data[hariBesok].forEach((j, i) => teks += `${i + 1}. ${j}\n`)
      sock.sendMessage("6285121084070@s.whatsapp.net", { text: teks })
    }
  })

  // ====== PENGINGAT TUGAS 07.00 & 18.00 WIB ======
  const remindTugas = () => {
    if (!tugas.aktif || tugas.data.length === 0) return
    let teks = "📖 *PENGINGAT TUGAS*\n\n"
    tugas.data.forEach((t, i) => teks += `${i + 1}. ${t.nama}\n🕒 Deadline: ${t.deadline}\n\n`)
    sock.sendMessage("6285121084070@s.whatsapp.net", { text: teks })
  }
  cron.schedule("0 7,18 * * *", remindTugas)
}

startBot()
