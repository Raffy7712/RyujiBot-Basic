import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const text = readFileSync(join(__dirname, '..', '..', '.env'), 'utf-8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = process.env[key] ?? value
    }
  } catch { }
}

loadEnv()

const PREFIX = process.env.PREFIX || '!'

function getText(msg) {
  return msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || ''
}

export async function registerCommandHandler(sock) {
  const commandsPath = join(__dirname, '..', 'database', 'commands.json')
  const commands = JSON.parse(readFileSync(commandsPath, 'utf-8'))

  const cmdMap = new Map()
  for (const cmd of commands) cmdMap.set(cmd.name, cmd)

  const modules = {}
  for (const cmd of commands) {
    modules[cmd.name] = await import(`../commands/${cmd.name}.js`)
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue

      const text = getText(msg)
      if (!text.startsWith(PREFIX)) continue

      const parts = text.slice(PREFIX.length).split(/\s+/)
      const input = parts[0].toLowerCase()
      const args = parts.slice(1)

      const meta = cmdMap.get(input)
      if (!meta) continue

      try {
        await modules[meta.name].default(sock, msg, args, commands, PREFIX)
      } catch (e) {
        console.error(`Command ${meta.name} error:`, e)
      }
    }
  })
}
