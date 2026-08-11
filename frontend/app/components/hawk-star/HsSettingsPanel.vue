<script setup>
import { useI18n } from 'vue-i18n'
import { useHawkStar, resetGame, refreshPlanetState, initFromApi } from '~/composables/useHawkStar.js'
import { useHawkStarApi } from '~/composables/useHawkStarApi.js'
import { ANOMALY_TYPES } from '~/utils/hawkStarConfig.js'

const { t } = useI18n()
const { tickRateMs, buildTimeFactor, saveDevSettings, activePlanetId } = useHawkStar()
const { postDevCheat } = useHawkStarApi()

const cheatBusy = ref(false)

// Empty = the normal weighted roll. Picking a type forces exactly that event,
// which is the only practical way to look at one of thirteen on demand.
const anomalyType = ref('')
const anomalyOptions = computed(() =>
  ANOMALY_TYPES.map(id => ({ id, label: t('hawkStar.anomaly.types.' + id + '.name') }))
)

const PLANET_CHEATS  = ['complete_buildings', 'complete_units', 'complete_conversions', 'max_resources', 'drain_battery', 'add_population', 'roll_anomaly']
const FULL_RELOAD    = ['complete_drone_missions', 'complete_colony_missions', 'complete_cargo_missions', 'complete_scanning']

async function runCheat(action) {
  if (cheatBusy.value) return
  cheatBusy.value = true
  try {
    const pid = PLANET_CHEATS.includes(action) ? activePlanetId.value : null
    const extra = action === 'roll_anomaly' && anomalyType.value ? { anomalyType: anomalyType.value } : {}
    await postDevCheat(action, pid, extra)
    if (FULL_RELOAD.includes(action)) {
      await initFromApi()
    } else {
      await refreshPlanetState(activePlanetId.value)
    }
  } catch (e) {
    console.error('[dev cheat]', e)
  } finally {
    cheatBusy.value = false
  }
}
</script>

<template>
  <div class="hs-settings-panel">
    <div class="hs-dev-panel">
      <span class="hs-dev-label">CHEAT</span>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Alle laufenden Gebäude fertigstellen" @click="runCheat('complete_buildings')">✓ Bauten</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Laufende Einheiten (Drohne/Colony Ship) fertigstellen" @click="runCheat('complete_units')">✓ Einheiten</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Alle laufenden High-Tech-Umwandlungen inkl. Warteschlange fertigstellen" @click="runCheat('complete_conversions')">⚡ Convert</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Ressourcen auf Lager-Maximum setzen" @click="runCheat('max_resources')">⬆ Res max</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Alle globalen Forschungen fertigstellen" @click="runCheat('complete_research')">⬆ Research</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Alle Drohnen-Missionen abschließen" @click="runCheat('complete_drone_missions')">✓ Drohnen</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Alle Colony-Missionen abschließen" @click="runCheat('complete_colony_missions')">✓ Colony</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Frachtdrohne ausliefern lassen und zurückholen" @click="runCheat('complete_cargo_missions')">✓ Fracht</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Alle Galaxy-Scans abschließen" @click="runCheat('complete_scanning')">✓ Scan</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Reaktor-Batterie sofort leeren (Blackout testen)" @click="runCheat('drain_battery')">🔋 Leeren</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="+1 Bevölkerung hinzufügen" @click="runCheat('add_population')">👥 +1 Pop</button>
      <button class="hs-cheat-btn" :disabled="cheatBusy" title="Sofort eine neue Anomalie auf diesem Planeten auswürfeln" @click="runCheat('roll_anomaly')">☄️ Anomalie</button>
      <select v-model="anomalyType" class="hs-cheat-select" :disabled="cheatBusy" title="Anomalie-Typ erzwingen (leer = zufällig)">
        <option value="">Zufällig</option>
        <option v-for="o in anomalyOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
      </select>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-settings-panel {
  width: 100%;
  border-radius: var(--hs-r-md, 0.5rem);
  border: 1px solid rgba(100, 130, 220, 0.15);
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
}

.hs-settings-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hs-dev-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 200, 0, 0.06);
  border: 1px solid rgba(255, 200, 0, 0.2);
  border-radius: 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

.hs-dev-label {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: rgba(255, 200, 0, 0.5);
  flex-shrink: 0;
  margin-right: 0.35rem;
}

.hs-dev-field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

.hs-dev-input {
  width: 5rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 200, 0, 0.25);
  border-radius: 0.35rem;
  color: rgba(255, 200, 0, 0.8);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.4rem;
  outline: none;
  text-align: right;

  &:focus { border-color: rgba(255, 200, 0, 0.6); }
}

.hs-dev-save {
  margin-left: auto;
  padding: 0.2rem 0.6rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(100, 220, 100, 0.3);
  background: rgba(100, 220, 100, 0.08);
  color: rgba(100, 220, 100, 0.7);
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover { color: rgb(100, 220, 100); border-color: rgba(100, 220, 100, 0.6); }
}

.hs-dev-reset {
  padding: 0.2rem 0.6rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: none;
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.7rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover { color: var(--hs-danger); border-color: var(--hs-danger-border); }
}

.hs-cheat-btn {
  padding: 0.2rem 0.6rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(180, 100, 255, 0.3);
  background: rgba(180, 100, 255, 0.07);
  color: rgba(200, 140, 255, 0.7);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) { color: rgb(210, 160, 255); border-color: rgba(180, 100, 255, 0.6); }
  &:disabled { opacity: 0.4; cursor: default; }
}

/* Belongs to the anomaly button next to it, so it borrows its colours. */
.hs-cheat-select {
  padding: 0.2rem 0.4rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(180, 100, 255, 0.3);
  background: rgba(180, 100, 255, 0.07);
  color: rgba(200, 140, 255, 0.7);
  font-size: 0.7rem;
  font-weight: 700;
  max-width: 9rem;
  cursor: pointer;
  outline: none;

  option { background: #1b1030; color: rgba(255, 255, 255, 0.85); }
  &:disabled { opacity: 0.4; cursor: default; }
}
</style>
