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
    postDroneMission:  (fromPlanetId, toPlanetId)     => post('/game/mission/drone',   { fromPlanetId, toPlanetId }),
    postColonyMission: (fromPlanetId, toPlanetId)     => post('/game/mission/colony',  { fromPlanetId, toPlanetId }),
    getMissions:       ()                              => apiFetch('/game/missions'),
    fetchContacts:     ()                              => apiFetch('/galaxy/contacts'),
    postScanSystem:    (systemId)                      => post('/galaxy/scan',          { systemId }),
    postSendMessage:   (systemId, messageKeys)          => post('/comm/send',            { systemId, messageKeys }),
    fetchCommLog:      ()                              => apiFetch('/comm/log'),
    postDevCheat:          (action, planetId = null)  => post('/dev/cheat', { action, ...(planetId != null ? { planetId } : {}) }),
    fetchAgricultureState: (planetId)                 => apiFetch(`/agriculture/state?planet_id=${planetId}`),
    postHarvest:           (planetId, cellIndex)      => post('/agriculture/harvest', { planetId, cellIndex }),
  }
}
