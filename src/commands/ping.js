export default async function (sock, msg, args) {
  const start = Date.now()
  const reply = await sock.sendMessage(msg.key.remoteJid, { text: 'Pong!' })
  const latency = Date.now() - start
  await sock.sendMessage(msg.key.remoteJid, {
    text: `Server: ${latency}ms`,
    edit: reply.key
  })
}
