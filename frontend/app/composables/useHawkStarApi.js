import { useHawkStarAuth } from './useHawkStarAuth.js'

const API = '/api/star'

// The body is read as TEXT first and only then parsed. A PHP fatal returns 500
// with an empty body or a chunk of HTML, and `res.json()` on that throws
// "Unexpected end of JSON input" — which hides the one thing worth knowing (the
// status, and whatever PHP managed to print). The status and the raw body are
// carried on the error so the UI can show something diagnosable instead.
async function apiFetch(path, options = {}) {
  const { token } = useHawkStarAuth()
  const headers = { 'Content-Type': 'application/json' }
  if (token.value) headers['Authorization'] = `Bearer ${token.value}`

  const res  = await fetch(`${API}${path}`, { ...options, headers })
  const text = await res.text()

  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* not JSON — handled below */ }

  if (!json) {
    // Server-side crash or a proxy error page. Keep the first line of whatever
    // came back: a PHP fatal usually names the file and the undefined thing.
    const snippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
    const err = new Error(
      `HTTP ${res.status} ${res.statusText || ''}`.trim() +
      (snippet ? ` — ${snippet}` : ' — empty response (server error, check the PHP log)')
    )
    err.status   = res.status
    err.endpoint = path
    err.body     = text
    console.error('[hawk-star] API', path, res.status, text || '(empty body)')
    throw err
  }

  if (!json.ok) {
    const err = new Error(json.error || 'API error')
    err.status   = res.status
    err.endpoint = path
    throw err
  }
  return json.data
}

const post = (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) })

export function useHawkStarApi() {
  return {
    fetchGalaxy:       ()                              => apiFetch('/galaxy/'),
    fetchGameState:    (planetId)                      => apiFetch(`/game/state?planet_id=${planetId}`),
    postBuild:         (planetId, buildingKey)         => post('/game/build',          { planetId, buildingKey }),
    postResearch:      (buildingKey)                   => post('/game/research',        { buildingKey }),
    postConvert:       (planetId, buildingKey, recipeIndex, count) =>
                                                          post('/game/convert',         { planetId, buildingKey, recipeIndex, count }),
    // `count` is only read for batchable units (the corvette); the server
    // forces 1 for everything else and clamps to the free fleet berths.
    postUnitBuild:     (planetId, unitKey, count = 1)  => post('/game/unit/build',      { planetId, unitKey, count }),
    postDroneMission:  (fromPlanetId, toPlanetId)     => post('/game/mission/drone',   { fromPlanetId, toPlanetId }),
    postColonyMission: (fromPlanetId, toPlanetId)     => post('/game/mission/colony',  { fromPlanetId, toPlanetId }),
    postCargoMission:  (fromPlanetId, toPlanetId)     => post('/game/mission/cargo',   { fromPlanetId, toPlanetId }),
    // The fleet flies with sealed orders: `order` is 'disable' | 'plunder' and
    // cannot be changed once it is under way.
    postRaidMission:   (fromPlanetId, toPlanetId, ships, order) =>
      post('/game/mission/raid', { fromPlanetId, toPlanetId, ships, order }),
    // Target sits in another system — the server checks that it is scanned.
    // `unit` picks between the one-shot drone and the satellite that stays.
    postSpyMission:    (fromPlanetId, toPlanetId, unit = 'spy_drone') =>
                                                        post('/game/mission/spy',     { fromPlanetId, toPlanetId, unit }),
    // Sends the FULL desired manifest, not a delta — the server diffs it against
    // the stored hold, so `{}` means "unload everything".
    postCargoLoad:     (planetId, cargo)              => post('/game/cargo/load',      { planetId, cargo }),
    getMissions:       ()                              => apiFetch('/game/missions'),
    fetchContacts:     ()                              => apiFetch('/galaxy/contacts'),
    postScanSystem:    (systemId)                      => post('/galaxy/scan',          { systemId }),
    postSendMessage:   (systemId, messageKeys)          => post('/comm/send',            { systemId, messageKeys }),
    fetchCommLog:      ()                              => apiFetch('/comm/log'),
    postDevCheat:          (action, planetId = null, extra = {})  => post('/dev/cheat', { action, ...(planetId != null ? { planetId } : {}), ...extra }),
    chargeBattery:         (planetId)                 => post('/game/power/charge', { planetId }),
    chargeShield:          (planetId)                 => post('/game/defense/charge', { planetId }),
    interceptSatellite:    (planetId, targetPlayerId) => post('/game/defense/intercept', { planetId, targetPlayerId }),
    recruit:               (planetId)                 => post('/game/base/recruit', { planetId }),
    resolveAnomaly:        (planetId, choice)         => post('/game/anomaly/resolve', { planetId, choice }),
  }
}
