import makeWASocket, { Browsers, makeCacheableSignalKeyStore } from 'baileys'

export function createSocket(state, logger) {
  const keys = makeCacheableSignalKeyStore(state.keys, logger)

  return makeWASocket({
    auth: { creds: state.creds, keys },
    logger,
    browser: Browsers.windows('Chrome'),
    printQRInTerminal: false,
    syncFullHistory: true
  })
}
