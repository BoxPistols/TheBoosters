// Main-process IPC endpoint for the inline AI writing-assist.
//
// Renderer calls `ipcRenderer.invoke('ai:run', req)`. Text deltas stream back on
// the `ai:chunk` channel as `{ runId, delta }`; the invoke promise resolves with
// the full text (the renderer treats that as "done") or rejects on error (the
// renderer shows the message). Keys: the Preferences override wins, else the
// provider's env var.
const { ipcMain } = require('electron')
const { streamCompletion } = require('./aiService')

const ENV_KEYS = {
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY']
}

function resolveKey(provider, overrideKey) {
  if (overrideKey && String(overrideKey).trim())
    return String(overrideKey).trim()
  for (const name of ENV_KEYS[provider] || []) {
    if (process.env[name]) return process.env[name]
  }
  return null
}

let registered = false

function registerAiIpc() {
  if (registered) return
  registered = true
  ipcMain.handle('ai:run', (event, req) => {
    req = req || {}
    const apiKey = resolveKey(req.provider, req.apiKey)
    return streamCompletion(Object.assign({}, req, { apiKey }), delta => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chunk', { runId: req.runId, delta })
      }
    })
  })
}

module.exports = { registerAiIpc }
