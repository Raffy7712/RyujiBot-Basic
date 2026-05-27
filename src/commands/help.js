export default async function (sock, msg, args, commands, prefix) {
  if (args.length > 0) {
    const cmd = commands.find(c => c.name === args[0].toLowerCase())
    if (!cmd) {
      await sock.sendMessage(msg.key.remoteJid, { text: `Command "${args[0]}" not found.` })
      return
    }
    await sock.sendMessage(msg.key.remoteJid, {
      text: `*${cmd.name}*\n${cmd.description}\n\nUsage: ${prefix}${cmd.usage}`
    })
    return
  }

  const text = commands.map(c => `${prefix}${c.name} - ${c.description}`).join('\n')
  await sock.sendMessage(msg.key.remoteJid, { text: `*Available Commands*\n\n${text}` })
}
