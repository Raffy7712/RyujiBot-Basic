# RyujiBot-Basic

Bot WhatsApp modular dengan SQLite auth + admin panel via WhatsApp.

## Fitur

- **SQLite auth** — custom `SignalKeyStore`, gak pake `useMultiFileAuthState` yang IO-heavy
- **Command handler** — prefix bisa diatur via `.env`, command terdaftar di `commands.json`
- **Admin panel** — kontrol bot langsung dari WhatsApp (multi-admin support)
- **Modular** — tinggal buat file di `src/commands/` + daftarin di `commands.json`

## Persiapan

```bash
git clone https://github.com/Raffy7712/RyujiBot-Basic
cd RyujiBot-Basic
npm install
```

## Konfigurasi

Copy `.env.example` ke `.env` dan isi:

```env
PREFIX=!
BOT_NAME=RyujiBot
BOT_AUTHOR=RyujiBot
ADMIN_NUMBER=62812xxx,62813xxx
```

| Variabel | Wajib | Keterangan |
|---|---|---|
| `PREFIX` | ✗ | Prefix command (default `!`) |
| `BOT_NAME` | ✗ | Nama sticker pack |
| `BOT_AUTHOR` | ✗ | Author sticker |
| `ADMIN_NUMBER` | ✓ | Nomor admin (bisa lebih dari 1, pisah koma) |

## Jalankan

```bash
npm start
```

Pertama jalan, bakal minta nomor HP buat pairing code. Masukin nomor, nanti dapet kode, masukin di WhatsApp > Perangkat Tertaut.

## Command

### User

| Command | Deskripsi |
|---|---|
| `!ping` | Cek respon bot |
| `!help [cmd]` | Lihat daftar command |

### Admin

| Command | Deskripsi |
|---|---|
| `!admin` | Menu admin |
| `!block [@user/628xx]` | Blokir user |
| `!unblock [@user/628xx]` | Buka blokir |
| `!groups` | Lihat grup dengan ID |
| `!broadcast [id/all] [text]` | Kirim ke grup |
| `!leave [id]` | Keluar grup |
| `!kick [@user] [id]` | Tendang anggota |
| `!promote [@user] [id]` | Jadikan admin grup |
| `!demote [@user] [id]` | Cabut admin grup |
| `!mute [id]` | Kunci grup |
| `!unmute [id]` | Buka grup |
| `!welcome [on/off] [id]` | Atur sambutan |
| `!goodbye [on/off] [id]` | Atur pesan keluar |

> **Note:** `[id]` bisa nomor (01, 02...) dari `!groups` atau `all` untuk semua grup.

## Struktur

```
src/
├── commands/        # file command (ping.js, help.js, ...)
├── database/        # commands.json
└── handlers/        # message.js, command.js, admin.js
```

Nambah command: buat file di `src/commands/`, daftarin di `src/database/commands.json`.

## Lisensi

MIT — lihat [LICENSE](LICENSE)
