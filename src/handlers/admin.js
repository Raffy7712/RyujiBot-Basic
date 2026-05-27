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
const ADMIN_NUMBERS = (process.env.ADMIN_NUMBER || '').split(',').map(s => s.trim()).filter(Boolean)
const ADMIN_JIDS = ADMIN_NUMBERS.map(n => `${n}@s.whatsapp.net`)

const GROUP_INDEX = {}

function pad(n) {
  return String(n).padStart(2, '0')
}

function isGroupId(str) {
  return /^\d{2}$/.test(str) && GROUP_INDEX[str]
}

function getText(msg) {
  return msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || ''
}

function getMentionedJid(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null
}

async function reply(sock, jid, text) {
  await sock.sendMessage(jid, { text })
}

async function refreshGroupIndex(sock) {
  const groups = await sock.groupFetchAllParticipating()
  const entries = Object.entries(groups)
  for (const key of Object.keys(GROUP_INDEX)) delete GROUP_INDEX[key]
  entries.forEach(([id, g], i) => {
    GROUP_INDEX[pad(i + 1)] = { jid: id, subject: g.subject, count: g.participants?.length || '?' }
  })
  return entries.length
}

function resolveGroupJid(args) {
  const last = args[args.length - 1]
  if (last === 'all') return 'all'
  if (isGroupId(last)) return GROUP_INDEX[last].jid
  return null
}

function ensureGroupId(args) {
  return isGroupId(args[args.length - 1]) || args[args.length - 1] === 'all'
}

// ── handlers ──

async function sendAdminHelp(sock, jid) {
  const cmds = [
    '• admin — show this menu',
    '• block [@user/628xx] — block a user',
    '• unblock [@user/628xx] — unblock a user',
    '',
    '• groups — list all groups with ID',
    '• broadcast [id/all] [text] — send to group(s)',
    '• leave [id] — leave a group',
    '',
    '• kick [@user] [id] — kick member',
    '• promote [@user] [id] — promote to admin',
    '• demote [@user] [id] — demote from admin',
    '• mute [id] — lock group',
    '• unmute [id] — unlock group',
    '• welcome [on/off] [id] — toggle join msgs',
  ]
  await reply(sock, jid, `*Admin Panel*\n\n${cmds.map(c => `${PREFIX}${c}`).join('\n')}`)
}

async function handleBlock(sock, jid, target) {
  if (!target) { await reply(sock, jid, 'Usage: !block [@user / 628xx]'); return }
  if (!target.includes('@')) target = `${target}@s.whatsapp.net`
  await sock.updateBlockStatus(target, 'block')
  await reply(sock, jid, `Blocked ${target}`)
}

async function handleUnblock(sock, jid, target) {
  if (!target) { await reply(sock, jid, 'Usage: !unblock [@user / 628xx]'); return }
  if (!target.includes('@')) target = `${target}@s.whatsapp.net`
  await sock.updateBlockStatus(target, 'unblock')
  await reply(sock, jid, `Unblocked ${target}`)
}

async function handleGroups(sock, jid) {
  const count = await refreshGroupIndex(sock)
  const list = Object.entries(GROUP_INDEX)
    .map(([key, g]) => `${key}. ${g.subject} — ${g.count} members`)
    .join('\n')
  await reply(sock, jid, `*Groups (${count})*\n\n${list || 'none'}\n\nUse ID (01, 02…) or "all" to target groups.`)
}

async function handleBroadcast(sock, jid, args) {
  if (!args.length) { await reply(sock, jid, 'Usage: !broadcast [id/all] [text]'); return }
  const target = args[0]
  const text = args.slice(1).join(' ')
  if (!text) { await reply(sock, jid, 'Usage: !broadcast [id/all] [text]'); return }
  if (target !== 'all' && !isGroupId(target)) { await reply(sock, jid, 'Usage: !broadcast [id/all] [text]'); return }

  if (target === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let sent = 0
    for (const id of Object.keys(groups)) {
      try { await sock.sendMessage(id, { text: `*Broadcast*\n\n${text}` }); sent++ } catch { }
    }
    await reply(sock, jid, `Broadcast sent to ${sent}/${Object.keys(groups).length} groups`)
  } else {
    const g = GROUP_INDEX[target]
    try {
      await sock.sendMessage(g.jid, { text: `*Broadcast*\n\n${text}` })
      await reply(sock, jid, `Sent to ${g.subject}`)
    } catch (e) {
      await reply(sock, jid, `Failed: ${e.message}`)
    }
  }
}

async function handleLeave(sock, jid, args) {
  if (!ensureGroupId(args)) { await reply(sock, jid, 'Usage: !leave [id]'); return }
  const target = resolveGroupJid(args)

  if (target === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let left = 0
    for (const id of Object.keys(groups)) {
      try { await sock.sendMessage(id, { text: 'bye' }); await sock.groupLeave(id); left++ } catch { }
    }
    await reply(sock, jid, `Left ${left} groups`)
  } else {
    await sock.sendMessage(target, { text: 'bye' })
    await sock.groupLeave(target)
    await reply(sock, jid, 'Left group')
  }
}

async function handleKick(sock, jid, target, args) {
  if (!target) { await reply(sock, jid, 'Usage: !kick [@user] [id]'); return }
  if (!ensureGroupId(args)) { await reply(sock, jid, 'Usage: !kick [@user] [id]'); return }
  if (!target.includes('@')) target = `${target}@s.whatsapp.net`
  const groupJid = resolveGroupJid(args)

  if (groupJid === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let done = 0
    for (const id of Object.keys(groups)) {
      try { await sock.groupParticipantsUpdate(id, [target], 'remove'); done++ } catch { }
    }
    await reply(sock, jid, `Kicked ${target} from ${done} groups`)
  } else {
    await sock.groupParticipantsUpdate(groupJid, [target], 'remove')
    await reply(sock, jid, `Kicked ${target}`)
  }
}

async function handlePromote(sock, jid, target, args) {
  if (!target) { await reply(sock, jid, 'Usage: !promote [@user] [id]'); return }
  if (!ensureGroupId(args)) { await reply(sock, jid, 'Usage: !promote [@user] [id]'); return }
  if (!target.includes('@')) target = `${target}@s.whatsapp.net`
  const groupJid = resolveGroupJid(args)

  if (groupJid === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let done = 0
    for (const id of Object.keys(groups)) {
      try { await sock.groupParticipantsUpdate(id, [target], 'promote'); done++ } catch { }
    }
    await reply(sock, jid, `Promoted ${target} in ${done} groups`)
  } else {
    await sock.groupParticipantsUpdate(groupJid, [target], 'promote')
    await reply(sock, jid, `Promoted ${target}`)
  }
}

async function handleDemote(sock, jid, target, args) {
  if (!target) { await reply(sock, jid, 'Usage: !demote [@user] [id]'); return }
  if (!ensureGroupId(args)) { await reply(sock, jid, 'Usage: !demote [@user] [id]'); return }
  if (!target.includes('@')) target = `${target}@s.whatsapp.net`
  const groupJid = resolveGroupJid(args)

  if (groupJid === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let done = 0
    for (const id of Object.keys(groups)) {
      try { await sock.groupParticipantsUpdate(id, [target], 'demote'); done++ } catch { }
    }
    await reply(sock, jid, `Demoted ${target} in ${done} groups`)
  } else {
    await sock.groupParticipantsUpdate(groupJid, [target], 'demote')
    await reply(sock, jid, `Demoted ${target}`)
  }
}

async function handleMute(sock, jid, args) {
  if (!ensureGroupId(args)) { await reply(sock, jid, 'Usage: !mute [id]'); return }
  const groupJid = resolveGroupJid(args)

  if (groupJid === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let done = 0
    for (const id of Object.keys(groups)) {
      try { await sock.groupSettingUpdate(id, 'announcement'); done++ } catch { }
    }
    await reply(sock, jid, `Muted ${done} groups`)
  } else {
    await sock.groupSettingUpdate(groupJid, 'announcement')
    await reply(sock, jid, 'Group muted')
  }
}

async function handleUnmute(sock, jid, args) {
  if (!ensureGroupId(args)) { await reply(sock, jid, 'Usage: !unmute [id]'); return }
  const groupJid = resolveGroupJid(args)

  if (groupJid === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let done = 0
    for (const id of Object.keys(groups)) {
      try { await sock.groupSettingUpdate(id, 'not_announcement'); done++ } catch { }
    }
    await reply(sock, jid, `Unmuted ${done} groups`)
  } else {
    await sock.groupSettingUpdate(groupJid, 'not_announcement')
    await reply(sock, jid, 'Group unmuted')
  }
}

async function handleWelcome(sock, jid, args) {
  if (args.length < 2) { await reply(sock, jid, 'Usage: !welcome [on/off] [id]'); return }
  const value = args[0]
  if (value !== 'on' && value !== 'off') { await reply(sock, jid, 'Usage: !welcome [on/off] [id]'); return }
  if (!ensureGroupId(args)) { await reply(sock, jid, 'Usage: !welcome [on/off] [id]'); return }
  const groupJid = resolveGroupJid(args)

  if (groupJid === 'all') {
    const groups = await sock.groupFetchAllParticipating()
    let done = 0
    for (const id of Object.keys(groups)) {
      try { done++ } catch { }
    }
    await reply(sock, jid, `Welcome toggled ${value} in ${done} groups (stub)`)
  } else {
    await reply(sock, jid, `Welcome toggled ${value} (stub)`)
  }
}

// ── entry ──

export function registerAdminHandler(sock) {
  if (!ADMIN_JIDS.length) {
    console.log('Admin panel disabled: ADMIN_NUMBER not set in .env')
    return
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue

      const jid = msg.key.remoteJid
      const sender = msg.key.participant || jid
      const text = getText(msg)

      if (!ADMIN_JIDS.includes(sender) || !text.startsWith(PREFIX)) continue

      const parts = text.slice(PREFIX.length).split(/\s+/)
      const cmd = parts[0].toLowerCase()
      const args = parts.slice(1)
      const mentioned = getMentionedJid(msg)

      try {
        switch (cmd) {
          case 'admin':
            await sendAdminHelp(sock, jid)
            break
          case 'block':
            await handleBlock(sock, jid, mentioned || args[0])
            break
          case 'unblock':
            await handleUnblock(sock, jid, mentioned || args[0])
            break
          case 'groups':
            await handleGroups(sock, jid)
            break
          case 'broadcast':
            await handleBroadcast(sock, jid, args)
            break
          case 'leave':
            await handleLeave(sock, jid, args)
            break
          case 'kick':
            await handleKick(sock, jid, mentioned || args[0], args)
            break
          case 'promote':
            await handlePromote(sock, jid, mentioned || args[0], args)
            break
          case 'demote':
            await handleDemote(sock, jid, mentioned || args[0], args)
            break
          case 'mute':
            await handleMute(sock, jid, args)
            break
          case 'unmute':
            await handleUnmute(sock, jid, args)
            break
          case 'welcome':
            await handleWelcome(sock, jid, args)
            break
        }
      } catch (e) {
        await reply(sock, jid, `Error: ${e.message}`)
      }
    }
  })
}
