import { useHawkStarAuth } from './useHawkStarAuth.js'

const API = '/api/star'

async function apiFetch(path, options = {}) {
  const { token } = useHawkStarAuth()
  const headers = { 'Content-Type': 'application/json' }
  if (token.value) headers['Authorization'] = `Bearer ${token.value}`
  const res  = await fetch(`${API}${path}`, { ...options, headers })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'API error')
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
    postUnitBuild:     (planetId, unitKey)            => post('/game/unit/build',      { planetId, unitKey }),
    postDroneMission:  (fromPlanetId, toPlanetId)     => post('/game/mission/drone',   { fromPlanetId, toPlanetId }),
    postColonyMission: (fromPlanetId, toPlanetId)     => post('/game/mission/colony',  { fromPlanetId, toPlanetId }),
    postCargoMission:  (fromPlanetId, toPlanetId)     => post('/game/mission/cargo',   { fromPlanetId, toPlanetId }),
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
