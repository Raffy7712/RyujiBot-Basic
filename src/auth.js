import Database from 'better-sqlite3'
import { initAuthCreds, BufferJSON, proto, makeCacheableSignalKeyStore } from 'baileys'

export function makeSQLiteAuthState(dbPath) {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS creds (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session_keys (
      type TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT,
      PRIMARY KEY (type, id)
    );
  `)

  const creds = (() => {
    const row = db.prepare('SELECT data FROM creds WHERE id = 1').get()
    return row ? JSON.parse(row.data, BufferJSON.reviver) : initAuthCreds()
  })()

  const keys = {
    get: async (type, ids) => {
      const placeholders = ids.map(() => '?').join(',')
      const rows = db.prepare(
        `SELECT id, data FROM session_keys WHERE type = ? AND id IN (${placeholders})`
      ).all(type, ...ids)

      const result = {}
      for (const id of ids) {
        const row = rows.find(r => r.id === id)
        if (row?.data) {
          let value = JSON.parse(row.data, BufferJSON.reviver)
          if (type === 'app-state-sync-key') {
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          }
          result[id] = value
        } else {
          result[id] = null
        }
      }
      return result
    },
    set: async (data) => {
      const upsert = db.prepare(
        `INSERT INTO session_keys (type, id, data) VALUES (?, ?, ?)
         ON CONFLICT(type, id) DO UPDATE SET data = excluded.data`
      )
      const remove = db.prepare('DELETE FROM session_keys WHERE type = ? AND id = ?')

      db.transaction(() => {
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id]
            if (value) {
              upsert.run(category, id, JSON.stringify(value, BufferJSON.replacer))
            } else {
              remove.run(category, id)
            }
          }
        }
      })()
    }
  }

  return {
    state: { creds, keys },
    saveCreds: () => {
      db.prepare(
        `INSERT INTO creds (id, data) VALUES (1, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      ).run(JSON.stringify(creds, BufferJSON.replacer))
    }
  }
}
