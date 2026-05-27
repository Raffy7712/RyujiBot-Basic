function getText(msg) {
  return msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || ''
}

function formatJid(jid) {
  return jid.replace(/:.*@/, '@').split('@')[0]
}

export function registerMessageHandler(sock) {
  const groupCache = new Map()

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue

      const jid = msg.key.remoteJid
      const sender = msg.key.participant || jid
      const isGroup = jid.endsWith('@g.us')
      const text = getText(msg)
      const name = msg.pushName || formatJid(sender)

      if (isGroup) {
        if (!groupCache.has(jid)) {
          try {
            const meta = await sock.groupMetadata(jid)
            groupCache.set(jid, meta.subject)
          } catch {
            groupCache.set(jid, formatJid(jid))
          }
        }
        const groupName = groupCache.get(jid)
        console.log(`[${groupName}] ${name}: ${text}`)
      } else {
        console.log(`${name} (${formatJid(sender)}): ${text}`)
      }
    }
  })
}
