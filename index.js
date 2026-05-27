import { createInterface } from 'readline/promises'
import pino from 'pino'
import { DisconnectReason } from 'baileys'
import { makeSQLiteAuthState } from './src/auth.js'
import { createSocket } from './src/socket.js'
import { registerMessageHandler } from './src/handlers/message.js'
import { registerCommandHandler } from './src/handlers/command.js'
import { registerAdminHandler } from './src/handlers/admin.js'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const logger = pino({ level: 'silent' })

async function startBot() {
  const { state, saveCreds } = makeSQLiteAuthState('auth.db')
  const sock = createSocket(state, logger)

  sock.ev.on('creds.update', saveCreds)

  if (!sock.authState.creds.registered) {
    const phone = await rl.question('Phone number (with country code, e.g. 62812xxx): ')
    const code = await sock.requestPairingCode(phone)
    console.log('Pairing code:', code)
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('Connected!')
      return
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
        console.log('Session expired. Restart to re-pair.')
        process.exit(1)
      }
      console.log('Reconnecting...')
      startBot()
    }
  })

  registerMessageHandler(sock)
  registerCommandHandler(sock)
  registerAdminHandler(sock)
}

startBot().catch(console.error)
