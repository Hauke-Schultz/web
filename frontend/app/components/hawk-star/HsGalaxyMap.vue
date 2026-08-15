<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { PLANET_TYPES } from '~/utils/hawkStarConfig.js'
import HsCommLog from '~/components/hawk-star/HsCommLog.vue'

const {
  playerColonizedPlanets,
  playerPortrait,
  homeSystemId,
  now,
  formatTime,
  starMapLevel,
  activeScan,
  systemContacts,
  unreadSystems,
  canScanSystem,
  scanSystem,
  galaxySystems,
  // espionage
  isSpyingPlanet,
  allActiveSpyMissions,
  planetSystemId,
  isSpyTarget,
  canSendSpyDrone,
  canSendSpySatellite,
  sendSpyDrone,
  sendSpySatellite,
  remainingSpySec,
  spyFlightTime,
  planetIntel,
  intelAgeHours,
  isIntelStale,
  satelliteAgeHours,
  // raids
  activePlanetId,
  corvetteInventory,
  canRaid,
  isRaidTarget,
  raidFlightTime,
  raidsAgainstMe,
  allActiveRaids,
  startRaid,
} = useHawkStar()

const { t } = useI18n()

// ── Raid dialog ───────────────────────────────────────────────────────────────
// Opened per planet. The order is sealed at launch — the fleet cannot be
// re-tasked in flight — so both decisions are made here or not at all.
const raidTarget = ref(null)   // planet id, or null while the dialog is closed
const raidShips   = ref(1)
const raidOrder   = ref('disable')

const openRaid = (planet) => {
  raidTarget.value = planet.id
  raidShips.value  = corvetteInventory.value
  raidOrder.value  = 'disable'
}

const closeRaid = () => { raidTarget.value = null }

const setRaidShips = (delta) => {
  raidShips.value = Math.max(1, Math.min(raidShips.value + delta, corvetteInventory.value))
}

const confirmRaid = (planet, sysId) => {
  startRaid(planet.id, sysId, raidShips.value, raidOrder.value, activePlanetId.value)
  closeRaid()
}

const raidFlightLabel = (sys) => formatTime(raidFlightTime(sys.id))

// A fleet of ours already on its way into this system.
const inboundRaid = (sysId) => allActiveRaids.value.find(
  m => (m.systemId ?? planetSystemId(m.planetId)) === sysId
) ?? null

const isRaidingPlanet = (planetId) => allActiveRaids.value.some(m => m.planetId === planetId)

const remainingRaidSec = (planetId) => {
  const m = allActiveRaids.value.find(r => r.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

// ── Raid history ──────────────────────────────────────────────────────────────
// How often this player has attacked US. Counts repelled attacks too — three
// bounced attempts are exactly the thing worth watching build up.
const raidRecord = (owner) => raidsAgainstMe(owner.playerId)

const raidRecordFresh = (owner) => {
  const rec = raidRecord(owner)
  return !!rec && (now.value - rec.lastAt) < 24 * 3600 * 1000
}

const raidRecordLabel = (owner) => {
  const rec = raidRecord(owner)
  if (!rec) return ''
  const hours = Math.floor((now.value - rec.lastAt) / 3600000)
  const ago = hours < 1 ? t('hawkStar.galaxy.raidJustNow')
            : hours < 24 ? t('hawkStar.galaxy.raidHoursAgo', { n: hours })
            : t('hawkStar.galaxy.raidDaysAgo', { n: Math.floor(hours / 24) })
  return `⚔️ ${rec.count} · ${ago}`
}

// ── System order: home first, then inhabited systems ─────────────────────────
// `inhabited` is a system-level flag from the API. It used to be derived from the
// planet owners, which no longer works: those are hidden until a spy drone lands.
const sortedSystems = computed(() => {
  const home = galaxySystems.value.find(s => s.id === homeSystemId.value)
  const rest = galaxySystems.value.filter(s => s.id !== homeSystemId.value && s.inhabited)
  return home ? [home, ...rest] : rest
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const STAR_CLASS_ICON = { G: '☀️', K: '🟠', M: '🔴', F: '⚪' }

const isHome = (sys) => sys.id === homeSystemId.value

const isInhabited = (sys) => sys.inhabited

// A scan reveals WHO lives in a system and how many planets they hold — never
// which ones. The server only fills `inhabitants` in once the system is scanned.
const uniqueOwners = (sys) => sys.inhabitants ?? []

const firstOwner = (sys) => uniqueOwners(sys)[0] ?? null

// ── Espionage ─────────────────────────────────────────────────────────────────
// Foreign planets arrive with `known: false` — neither owner nor "free" is known
// until something has been there.
const isUnknownPlanet = (planet) => planet.known === false

const spyFlightLabel = (sys) => formatTime(spyFlightTime(sys.id))

// Anything of ours currently on its way into this system. The mission carries
// its target system, but a mission restored before the galaxy finished loading
// has none — planetSystemId() covers that case.
const inboundSpy = (sysId) => allActiveSpyMissions.value.find(
  m => (m.systemId ?? planetSystemId(m.planetId)) === sysId
) ?? null

const inboundSpyLabel = (sysId) => {
  const m = inboundSpy(sysId)
  if (!m) return ''
  const sys = galaxySystems.value.find(s => s.id === sysId)
  const tgt = sys?.planets.find(p => p.id === m.planetId)?.name ?? ''
  const key = m.unit === 'spy_satellite' ? 'hawkStar.galaxy.satelliteEnRoute' : 'hawkStar.galaxy.spyEnRoute'
  return t(key, { planet: tgt, time: formatTime(remainingSpySec(m.planetId)) })
}

// How old the report is, in words. A drone's finding never updates itself, so
// this is the difference between "he lives there" and "he lived there".
const intelLabel = (planet) => {
  const intel = planetIntel(planet.id)
  if (!intel) return ''
  // A transmitting satellite has no countdown — it stays until it is shot down,
  // so the chip is the plain signal and the tooltip carries how long it has been
  // watching. A number here would read as a deadline that no longer exists.
  if (intel.live) return '📡'
  const h = intelAgeHours(planet.id) ?? 0
  if (h < 1)  return t('hawkStar.galaxy.intelAgeMin', { n: Math.max(1, Math.round(h * 60)) })
  if (h < 48) return t('hawkStar.galaxy.intelAgeHours', { n: Math.round(h) })
  return t('hawkStar.galaxy.intelAgeDays', { n: Math.floor(h / 24) })
}

// ── What a survey reports ─────────────────────────────────────────────────────
// The planet type comes with the drone's finding — `type` is null until then.
// A greyed generic world marks that gap, the same way a missing shield does on
// the solar map: a hole in the row would say nothing at all.
const typeIcon  = (planet) => planet.type ? (PLANET_TYPES[planet.type]?.icon ?? '🪐') : '🪐'
const typeTitle = (planet) => planet.type
  ? t(`hawkStar.planetTypes.${planet.type}.name`)
  : t('hawkStar.galaxy.typeUnknown')

// The shield is the satellite's exclusive finding: a drone flies past, a
// satellite sits in the orbit and watches the emitter. Null = never measured;
// a report with `charge === null` = measured, and there is no generator.
const shieldReport = (planet) => planetIntel(planet.id)?.shield ?? null

const shieldLabel = (planet) => {
  const s = shieldReport(planet)
  if (!s) return ''
  return s.charge === null ? '🛡️ –' : `🛡️ ${Math.round(s.charge)} %`
}

// Two halves: what was measured, and how current that measurement is. A shield
// drains ~30 %/day, so an old reading is a much weaker claim than an old owner.
const shieldTitle = (planet) => {
  const s = shieldReport(planet)
  if (!s) return ''
  const state = s.charge === null ? t('hawkStar.galaxy.shieldNone')
              : s.charge > 0      ? t('hawkStar.galaxy.shieldUp', { n: Math.round(s.charge) })
              :                     t('hawkStar.galaxy.shieldDown')
  const src = s.live
    ? t('hawkStar.galaxy.shieldSrcLive')
    : t('hawkStar.galaxy.shieldSrcSnapshot', { age: ageLabel(s.observedAt) })
  return `${state} · ${src}`
}

const ageLabel = (observedAt) => {
  if (!observedAt) return ''
  const h = Math.max(0, (now.value - observedAt) / 3600000)
  if (h < 1)  return t('hawkStar.galaxy.intelAgeMin',   { n: Math.max(1, Math.round(h * 60)) })
  if (h < 48) return t('hawkStar.galaxy.intelAgeHours', { n: Math.round(h) })
  return t('hawkStar.galaxy.intelAgeDays', { n: Math.floor(h / 24) })
}

// The live chip says "somebody is watching"; the tooltip says since when, which
// is the only number a satellite still has now that it cannot expire.
const intelTitle = (planet) => {
  const intel = planetIntel(planet.id)
  if (!intel?.live) return t('hawkStar.galaxy.intelSnapshot')
  return satelliteAgeHours(planet.id) == null
    ? t('hawkStar.galaxy.intelLive')
    : t('hawkStar.galaxy.intelLiveSince', { age: ageLabel(intel.satelliteSince) })
}

const contactOf = (sysId) =>
  systemContacts.value[sysId] ?? { scanState: 'unscanned', scanEndsAt: null }

const resolvedScanState = (sys) =>
  isHome(sys) ? 'scanned' : contactOf(sys.id).scanState

const scanRemaining = (sysId) => {
  const c = contactOf(sysId)
  return c.scanEndsAt ? Math.max(0, Math.ceil((c.scanEndsAt - now.value) / 1000)) : 0
}


// ── Selection — home system pre-selected ──────────────────────────────────────
const selectedId = ref(homeSystemId.value)
const selected   = computed(() => galaxySystems.value.find(s => s.id === selectedId.value) ?? null)

const selectSystem = (sys) => {
  selectedId.value = selectedId.value === sys.id ? null : sys.id
}

// Card only visible when home or fully scanned
const showCard = (sys) => isHome(sys) || resolvedScanState(sys) === 'scanned'

// ── Tile CSS classes ───────────────────────────────────────────────────────────
const tileClass = (sys) => {
  const st = resolvedScanState(sys)
  return [
    isHome(sys)                          ? 'hs-galaxy-tile--home'      :
    st === 'scanning'                    ? 'hs-galaxy-tile--scanning'   :
    st === 'scanned' && isInhabited(sys) ? 'hs-galaxy-tile--inhabited'  :
    st === 'scanned'                     ? 'hs-galaxy-tile--scanned'    :
                                           'hs-galaxy-tile--unknown',
    selectedId.value === sys.id ? 'hs-galaxy-tile--selected' : '',
  ]
}
</script>

<template>
  <div class="hs-galaxy">

    <!-- ── System tile row ──────────────────────────────────────────────────── -->
    <div class="hs-galaxy-orbit">
      <div
        v-for="sys in sortedSystems"
        :key="sys.id"
        class="hs-galaxy-tile"
        :class="tileClass(sys)"
        @click="selectSystem(sys)"
      >
        <!-- Unread message badge -->
        <span v-if="unreadSystems[String(sys.id)]" class="hs-galaxy-tile-unread" />

        <!-- Espionage inbound — violet for a drone, teal for a satellite. Sits
             on the opposite corner from the unread dot so the two never merge
             into one ambiguous blob. -->
        <span
          v-if="inboundSpy(sys.id)"
          class="hs-galaxy-tile-spy"
          :class="inboundSpy(sys.id).unit === 'spy_satellite' ? 'hs-galaxy-tile-spy--sat' : ''"
          :title="inboundSpyLabel(sys.id)"
        />

        <!-- HOME -->
        <template v-if="isHome(sys)">
          <span class="hs-galaxy-tile-icon">{{ playerPortrait }}</span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span class="hs-galaxy-tile-state hs-galaxy-tile-state--own">{{ t('hawkStar.galaxy.stateColony') }}</span>
        </template>

        <!-- SCANNING -->
        <template v-else-if="resolvedScanState(sys) === 'scanning'">
          <span class="hs-galaxy-tile-icon hs-pulse-scan">📶</span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span class="hs-galaxy-tile-state hs-galaxy-tile-state--scanning">{{ t('hawkStar.comm.scanning') }}</span>
          <span class="hs-galaxy-tile-timer">{{ formatTime(scanRemaining(sys.id)) }}</span>
        </template>

        <!-- SCANNED -->
        <template v-else-if="resolvedScanState(sys) === 'scanned'">
          <span class="hs-galaxy-tile-icon">
            {{ isInhabited(sys) ? (firstOwner(sys)?.portrait ?? '👤') : (STAR_CLASS_ICON[sys.starClass] ?? '⭐') }}
          </span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span v-if="isInhabited(sys)" class="hs-galaxy-tile-state hs-galaxy-tile-state--inhabited">
            {{ firstOwner(sys)?.username ?? '?' }}
          </span>
          <span v-else class="hs-galaxy-tile-state hs-galaxy-tile-state--free">
            {{ t('hawkStar.galaxy.stateUncolonized') }}
          </span>
          <span
            v-if="isInhabited(sys) && contactOf(sys.id).mutualScan"
            class="hs-galaxy-tile-mutual"
            :title="t('hawkStar.comm.mutualScan')"
          >📡</span>
        </template>

        <!-- UNSCANNED -->
        <template v-else>
          <span class="hs-galaxy-tile-icon">{{ contactOf(sys.id).theyScannedMe ? '👁️' : '❓' }}</span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span class="hs-galaxy-tile-unknown">{{ t('hawkStar.comm.unscanned') }}</span>
          <button
            v-if="canScanSystem(sys.id)"
            class="hs-galaxy-scan-btn"
            @click.stop="scanSystem(sys.id)"
          >📶 <span class="hs-galaxy-scan-btn__label">{{ t('hawkStar.comm.scanSystem') }}</span></button>
          <span v-else-if="starMapLevel < 3" class="hs-galaxy-tile-locked">🔒</span>
          <span v-else-if="activeScan" class="hs-galaxy-tile-locked" style="opacity:0.5">⏳</span>
        </template>
      </div>
    </div>

    <!-- ── Card + Comm Log side by side ─────────────────────────────────────── -->
    <Transition name="hs-slide">
      <div v-if="selected && showCard(selected)" class="hs-galaxy-panel">

        <!-- Comm Log — hidden for own home system -->
        <div v-if="!isHome(selected)" class="hs-galaxy-comm-wrap">
          <HsCommLog :system-id="selected.id" />
        </div>

        <!-- System card -->
        <div class="hs-galaxy-card">
          <div class="hs-galaxy-card-header">
            <div>
              <div class="hs-galaxy-card-name">{{ selected.name }}</div>
              <div class="hs-galaxy-card-meta">
                {{ t('hawkStar.galaxy.starMeta', { cls: selected.starClass, n: selected.planets.length }) }}
              </div>
            </div>
            <button class="hs-galaxy-card-close" @click="selectedId = null">✕</button>
          </div>

          <!-- Owner list (inhabited foreign systems) -->
          <div v-if="!isHome(selected) && isInhabited(selected)" class="hs-comm-section">
            <div class="hs-faction-list">
              <div v-for="owner in uniqueOwners(selected)" :key="owner.playerId ?? owner.factionId" class="hs-faction-row">
                <span class="hs-faction-portrait">{{ owner.portrait ?? '👤' }}</span>
                <!-- Name only: how many planets they hold is not something a scan
                     reveals — that is what the spy drone is for, planet by planet -->
                <div class="hs-faction-info">
                  <span class="hs-faction-name">{{ owner.username ?? owner.name }}</span>
                </div>
                <!-- What this commander has done to US. Won and repelled raids
                     both count: an attacker who keeps bouncing off is still an
                     attacker, and the next fleet will be bigger. -->
                <span
                  v-if="raidRecord(owner)"
                  class="hs-faction-raids"
                  :class="{ 'hs-faction-raids--fresh': raidRecordFresh(owner) }"
                  :title="t('hawkStar.galaxy.raidRecordHint', { n: raidRecord(owner).count })"
                >{{ raidRecordLabel(owner) }}</span>
              </div>
            </div>
          </div>

          <!-- Planet list — who sits where is a secret until a spy drone lands -->
          <ul class="hs-planet-list">
            <li v-for="planet in selected.planets" :key="planet.id" class="hs-planet-item">
              <!-- The world itself — greyed while nothing has flown past it -->
              <span
                class="hs-planet-type"
                :class="{ 'hs-planet-type--unknown': !planet.type }"
                :title="typeTitle(planet)"
              >{{ typeIcon(planet) }}</span>
              <span class="hs-planet-name">{{ planet.name }}</span>

              <!-- Own colony: no espionage involved, always current -->
              <span
                v-if="playerColonizedPlanets.includes(planet.id)"
                class="hs-planet-tag hs-planet-tag--own"
              >{{ t('hawkStar.galaxy.stateColony') }}</span>

              <!-- Home system: plain truth, no report attached -->
              <template v-else-if="isHome(selected)">
                <span v-if="planet.owner" class="hs-planet-tag hs-planet-tag--owner">
                  {{ planet.owner?.username ?? planet.owner?.name }}
                </span>
              </template>

              <!-- Foreign system: a finding always carries its age -->
              <template v-else>
                <span
                  v-if="planet.owner"
                  class="hs-planet-tag hs-planet-tag--owner"
                >{{ planet.owner?.username ?? planet.owner?.name }}</span>
                <span
                  v-else-if="!isUnknownPlanet(planet)"
                  class="hs-planet-tag hs-planet-tag--empty"
                >{{ t('hawkStar.galaxy.stateUncolonized') }}</span>

                <!-- Satellite finding: is there a shield, and is it up -->
                <span
                  v-if="shieldReport(planet)"
                  class="hs-planet-shield"
                  :class="{
                    'hs-planet-shield--none': shieldReport(planet).charge === null,
                    'hs-planet-shield--up':   shieldReport(planet).charge > 0,
                    'hs-planet-shield--down': shieldReport(planet).charge === 0,
                    'hs-planet-shield--live': shieldReport(planet).live,
                  }"
                  :title="shieldTitle(planet)"
                >{{ shieldLabel(planet) }}</span>

                <span
                  v-if="!isUnknownPlanet(planet)"
                  class="hs-planet-intel"
                  :class="{
                    'hs-planet-intel--live':  planetIntel(planet.id)?.live,
                    'hs-planet-intel--stale': isIntelStale(planet.id),
                  }"
                  :title="intelTitle(planet)"
                >{{ intelLabel(planet) }}</span>

                <!-- Something is on its way there right now -->
                <span v-if="isSpyingPlanet(planet.id)" class="hs-planet-spy-timer">
                  🕵️ {{ formatTime(remainingSpySec(planet.id)) }}
                </span>

                <!-- Send / refresh. Both units fly the same route; the satellite
                     is the one that keeps the finding from ageing. -->
                <template v-else>
                  <button
                    v-if="canSendSpyDrone(planet.id, selected.id)"
                    class="hs-planet-spy-btn"
                    :title="t('hawkStar.galaxy.spyFlight', { time: spyFlightLabel(selected) })"
                    @click.stop="sendSpyDrone(planet.id, selected.id)"
                  >🕵️ {{ isUnknownPlanet(planet) ? t('hawkStar.galaxy.spy') : t('hawkStar.galaxy.spyAgain') }}</button>
                  <button
                    v-if="canSendSpySatellite(planet.id, selected.id)"
                    class="hs-planet-spy-btn hs-planet-spy-btn--sat"
                    :title="t('hawkStar.galaxy.satelliteHint')"
                    @click.stop="sendSpySatellite(planet.id, selected.id)"
                  >📡</button>
                  <span
                    v-if="isUnknownPlanet(planet) && !canSendSpyDrone(planet.id, selected.id)"
                    class="hs-planet-tag hs-planet-tag--unknown"
                    :title="isSpyTarget(planet.id, selected.id) ? t('hawkStar.galaxy.spyNoDrone') : ''"
                  >❓</span>
                </template>
              </template>

              <!-- Raid. Offered on any foreign colony we have looked at, and
                   only while a fleet is parked in the active planet's dock. -->
              <span v-if="isRaidingPlanet(planet.id)" class="hs-planet-raid-timer">
                ⚔️ {{ formatTime(remainingRaidSec(planet.id)) }}
              </span>
              <button
                v-else-if="isRaidTarget(planet, selected.id) && canRaid"
                class="hs-planet-raid-btn"
                :title="t('hawkStar.galaxy.raidHint', { time: raidFlightLabel(selected) })"
                @click.stop="openRaid(planet)"
              >⚔️</button>
            </li>
          </ul>

          <!-- Attack order. Both decisions live here because the fleet flies
               with sealed orders — there is no choice left after the battle. -->
          <div v-if="raidTarget" class="hs-raid-dialog">
            <div class="hs-raid-dialog-head">
              <span class="hs-raid-dialog-title">
                ⚔️ {{ selected.planets.find(p => p.id === raidTarget)?.name }}
              </span>
              <button class="hs-galaxy-card-close" @click="closeRaid">✕</button>
            </div>

            <div class="hs-raid-row">
              <span class="hs-raid-label">{{ t('hawkStar.galaxy.raidShips') }}</span>
              <div class="hs-raid-count">
                <button class="hs-raid-count__btn" :disabled="raidShips <= 1" @click="setRaidShips(-1)">−</button>
                <span class="hs-raid-count__value">{{ raidShips }} / {{ corvetteInventory }}</span>
                <button class="hs-raid-count__btn" :disabled="raidShips >= corvetteInventory" @click="setRaidShips(1)">+</button>
              </div>
            </div>

            <!-- Firepower is the whole battle: it is measured against shield %
                 plus battery %, and only the shield can be scouted. -->
            <div class="hs-raid-power">
              {{ t('hawkStar.galaxy.raidFirepower', { n: raidShips * 20 }) }}
              <span class="hs-raid-fuel">🔋 {{ raidShips }}</span>
            </div>

            <div class="hs-raid-orders">
              <button
                class="hs-raid-order"
                :class="{ 'hs-raid-order--active': raidOrder === 'disable' }"
                @click="raidOrder = 'disable'"
              >
                <span class="hs-raid-order-title">⚡ {{ t('hawkStar.galaxy.raidDisable') }}</span>
                <span class="hs-raid-order-desc">{{ t('hawkStar.galaxy.raidDisableDesc') }}</span>
              </button>
              <button
                class="hs-raid-order"
                :class="{ 'hs-raid-order--active': raidOrder === 'plunder' }"
                @click="raidOrder = 'plunder'"
              >
                <span class="hs-raid-order-title">💰 {{ t('hawkStar.galaxy.raidPlunder') }}</span>
                <span class="hs-raid-order-desc">{{ t('hawkStar.galaxy.raidPlunderDesc') }}</span>
              </button>
            </div>

            <button
              class="hs-raid-launch"
              @click="confirmRaid(selected.planets.find(p => p.id === raidTarget), selected.id)"
            >
              {{ t('hawkStar.galaxy.raidLaunch', { time: raidFlightLabel(selected) }) }}
            </button>
          </div>

          <!-- One line of context under the list, so the ❓ is not a mystery -->
          <div v-if="!isHome(selected) && isInhabited(selected)" class="hs-planet-list-hint">
            {{ t('hawkStar.galaxy.spyHint') }}
          </div>
        </div>

      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
.hs-galaxy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Tile row ──────────────────────────────────────────────────────────────────
.hs-galaxy-orbit {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.25rem;

  @media (min-width: 640px) {
    gap: 0.375rem;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

// ── Tiles ─────────────────────────────────────────────────────────────────────
.hs-galaxy-tile {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
  flex-shrink: 0;
  width: 2.25rem;
  padding: 0.4rem 0.1rem;
  cursor: pointer;
  transition: width 0.25s ease, background 0.15s;
  user-select: none;

  @media (min-width: 640px) {
    width: 5.5rem;
    padding: 0.625rem 0.375rem;
  }

  &--home      { border-color: rgba(96,165,250,0.6);   background: rgba(96,165,250,0.07); }
  &--unknown   { border-color: rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); }
  &--scanning  { border-color: rgba(251,191,36,0.55);  background: rgba(251,191,36,0.05); }
  &--scanned   { border-color: rgba(255,255,255,0.18); }
  &--inhabited { border-color: rgba(52,211,153,0.4);   background: rgba(52,211,153,0.04); }

  &--selected {
    outline: 2px solid var(--hs-active-border) !important;
    box-shadow: 0 0 20px var(--hs-active-glow) !important;
    outline-offset: -1px;
  }

  &:hover { background: rgba(255,255,255,0.04); }
}

// Mobile: selected tile expands
@media (max-width: 639px) {
  .hs-galaxy-tile--selected {
    flex: 1;
    width: auto;
    padding: 0.5rem 0.25rem;
  }

  .hs-galaxy-tile:not(.hs-galaxy-tile--selected) {
    .hs-galaxy-tile-name,
    .hs-galaxy-tile-state,
    .hs-galaxy-tile-unknown,
    .hs-galaxy-tile-timer,
    .hs-galaxy-tile-locked,
    .hs-galaxy-scan-btn { display: none; }
  }
}

// ── Tile content ──────────────────────────────────────────────────────────────
.hs-galaxy-tile-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.hs-galaxy-tile-name {
  font-size: 0.55rem;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
  text-align: center;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.hs-galaxy-tile-state {
  font-size: 0.5rem;
  font-weight: 600;
  text-align: center;

  &--own      { color: rgba(96,165,250,0.85); }
  &--scanning { color: rgba(251,191,36,0.85); }
  &--inhabited{ color: rgba(52,211,153,0.85); }
  &--free     { color: rgba(107,114,128,0.75); }
}

.hs-galaxy-tile-timer {
  font-size: 0.5rem;
  font-weight: 700;
  color: rgba(251,191,36,0.9);
  font-variant-numeric: tabular-nums;
}

.hs-galaxy-tile-unknown {
  font-size: 0.48rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
}

.hs-galaxy-tile-locked {
  font-size: 0.6rem;
  opacity: 0.4;
}

// ── Mutual-scan badge ─────────────────────────────────────────────────────────
.hs-galaxy-tile-mutual {
  font-size: 0.65rem;
  line-height: 1;
}

// ── Unread message badge ──────────────────────────────────────────────────────
.hs-galaxy-tile-unread {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f87171;
  box-shadow: 0 0 6px rgba(248,113,113,0.75);
  animation: hs-pulse-unread 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes hs-pulse-unread {
  0%, 100% { opacity: 1;   transform: scale(1);   }
  50%       { opacity: 0.55; transform: scale(1.4); }
}

// Something of ours is on its way into this system. Top-LEFT, opposite the
// unread dot, so a system that has both still reads as two separate signals.
.hs-galaxy-tile-spy {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a78bfa;
  box-shadow: 0 0 6px rgba(167,139,250,0.75);
  animation: hs-pulse-unread 1.4s ease-in-out infinite;
  // Deliberately NOT pointer-events: none — the title is the only place the
  // target planet and the countdown are named. The click still bubbles to the
  // tile, so selecting the system keeps working.

  &--sat {
    background: #2dd4bf;
    box-shadow: 0 0 6px rgba(45,212,191,0.75);
  }
}

// ── Scan button (inside tile) ─────────────────────────────────────────────────
.hs-galaxy-scan-btn {
  margin-top: 1px;
  padding: 2px 5px;
  border-radius: var(--hs-r-sm);
  font-size: 0.48rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(251,191,36,0.35);
  background: rgba(251,191,36,0.08);
  color: rgba(251,191,36,0.9);
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.6); }
}

.hs-galaxy-scan-btn__label {
  @media (max-width: 639px) { display: none; }
}

// ── Scan pulse animation ──────────────────────────────────────────────────────
@keyframes hs-pulse-scan {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

.hs-pulse-scan { animation: hs-pulse-scan 1.2s ease-in-out infinite; }

// ── Panel: card + comm log side by side ──────────────────────────────────────
.hs-galaxy-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: stretch;
    gap: 1rem;

    .hs-galaxy-card    { flex: 1; min-width: 0; }
    .hs-galaxy-comm-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  }
}

// ── System card ───────────────────────────────────────────────────────────────
.hs-galaxy-card {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-galaxy-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.hs-galaxy-card-name { font-size: 0.82rem; font-weight: 700; color: #fff; }
.hs-galaxy-card-meta { font-size: 0.58rem; color: rgba(255,255,255,0.3); margin-top: 1px; }

.hs-galaxy-card-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 4px;
  &:hover { color: rgba(255,255,255,0.65); }
}

// ── Comm section ──────────────────────────────────────────────────────────────
.hs-comm-section {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-faction-list { display: flex; flex-direction: column; gap: 0.25rem; }

.hs-faction-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.375rem;
  background: rgba(52,211,153,0.05);
  border: 1px solid rgba(52,211,153,0.12);
  border-radius: var(--hs-r-sm);
}

.hs-faction-portrait { font-size: 1rem; line-height: 1; }

.hs-faction-info {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.hs-faction-name  { font-size: 0.7rem; font-weight: 600; color: rgba(255,255,255,0.85); }

// ── Planet list ───────────────────────────────────────────────────────────────
.hs-planet-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hs-planet-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0.375rem;
  border-radius: var(--hs-r-sm);
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
}

// The row now carries type, owner, shield, age and two buttons — the name is
// the one part that may give up width, so it truncates instead of pushing.
.hs-planet-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.75);
}

// An emoji ignores `color`, so an unsurveyed world is greyed with a filter —
// same trick as the missing shield icon on the solar map.
.hs-planet-type {
  font-size: 0.7rem;
  line-height: 1;
  flex: none;

  &--unknown {
    filter: grayscale(1);
    opacity: 0.35;
  }
}

.hs-planet-shield {
  font-size: 0.52rem;
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.45);

  // Measured, no generator — greyed like every other "not built" icon
  &--none { filter: grayscale(1); opacity: 0.5; }
  // Standing shield vs. an emitter that is installed but empty
  &--up   { color: rgba(96,165,250,0.9); }
  &--down { color: rgba(248,113,113,0.85); }
  // A live satellite is measuring right now; anything else is a stored reading
  &--live { text-shadow: 0 0 6px rgba(45,212,191,0.35); }
}

.hs-planet-tag {
  font-size: 0.52rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;

  &--own     { background: rgba(96,165,250,0.12); color: rgba(96,165,250,0.85); }
  &--owner   { background: rgba(52,211,153,0.1);  color: rgba(52,211,153,0.8); }
  &--empty   { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); }
  &--unknown { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.3); }
}

// ── Espionage ─────────────────────────────────────────────────────────────────
.hs-planet-spy-btn {
  font-size: 0.52rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
  cursor: pointer;
  color: #ddd6fe;
  background: rgba(139,92,246,0.16);
  border: 1px solid rgba(139,92,246,0.45);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(139,92,246,0.3); border-color: rgba(139,92,246,0.7); }

  // The satellite is the same route with a different payload — same colour
  // family, teal, so the pair reads as one action with two intensities.
  &--sat {
    color: #99f6e4;
    background: rgba(45,212,191,0.14);
    border-color: rgba(45,212,191,0.45);

    &:hover { background: rgba(45,212,191,0.28); border-color: rgba(45,212,191,0.7); }
  }
}

// Age of the report. Grey while it is fresh, amber once it is old enough to be
// wrong, teal while a satellite keeps it current.
.hs-planet-intel {
  font-size: 0.5rem;
  font-weight: 600;
  color: rgba(255,255,255,0.3);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &--stale { color: rgba(251,191,36,0.75); }
  &--live  { color: rgba(45,212,191,0.85); }
}

.hs-planet-spy-timer {
  font-size: 0.52rem;
  font-weight: 600;
  color: rgba(196,181,253,0.9);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

// ── Raid ──────────────────────────────────────────────────────────────────────
// Red throughout, the same colour the fleet carries in the dock. It is the one
// action on this card aimed at a person rather than at a place, and it should
// never be mistaken for one of the espionage buttons next to it.
.hs-planet-raid-btn {
  font-size: 0.52rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
  cursor: pointer;
  color: #fecaca;
  background: rgba(248,113,113,0.16);
  border: 1px solid rgba(248,113,113,0.45);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(248,113,113,0.32); border-color: rgba(248,113,113,0.75); }
}

.hs-planet-raid-timer {
  font-size: 0.52rem;
  font-weight: 600;
  color: rgba(252,165,165,0.9);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

// The raid record sits at the far end of the owner row — the name is who they
// are, this is what they have done.
.hs-faction-raids {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.55rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;

  // Recent means "still going on". After a day it is history, and history is grey.
  &--fresh { color: rgba(248,113,113,0.95); }
}

.hs-raid-dialog {
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(248,113,113,0.3);
  background: rgba(248,113,113,0.06);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.hs-raid-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.hs-raid-dialog-title { font-size: 0.72rem; font-weight: 700; color: #fecaca; }

.hs-raid-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.hs-raid-label { font-size: 0.62rem; color: rgba(255,255,255,0.6); }

.hs-raid-count {
  display: flex;
  align-items: center;
  gap: 1px;
  border-radius: var(--hs-r-sm);
  border: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-sm);
  overflow: hidden;
}

.hs-raid-count__btn {
  width: 1.35rem;
  padding: 0.25rem 0;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  color: rgba(255,255,255,0.7);
  background: transparent;
  border: 0;
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--hs-glass-lg); color: #fff; }
  &:disabled { opacity: 0.25; cursor: not-allowed; }
}

.hs-raid-count__value {
  min-width: 3rem;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.85);
}

// Firepower is the number the whole battle turns on, so it is printed, not
// implied — and next to the fuel it costs to put it in the air.
.hs-raid-power {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(252,165,165,0.95);
}

.hs-raid-fuel { color: rgba(255,255,255,0.5); font-weight: 600; }

.hs-raid-orders { display: flex; gap: 0.35rem; }

.hs-raid-order {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.35rem 0.4rem;
  text-align: left;
  border-radius: var(--hs-r-sm);
  border: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-sm);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover { background: var(--hs-glass-lg); }

  &--active {
    border-color: rgba(248,113,113,0.7);
    background: rgba(248,113,113,0.14);
  }
}

.hs-raid-order-title { font-size: 0.62rem; font-weight: 700; color: rgba(255,255,255,0.9); }
.hs-raid-order-desc  { font-size: 0.55rem; line-height: 1.3; color: rgba(255,255,255,0.45); }

.hs-raid-launch {
  padding: 0.4rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  background: rgba(248,113,113,0.3);
  border: 1px solid rgba(248,113,113,0.6);
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: rgba(248,113,113,0.45); }
}

.hs-planet-list-hint {
  margin-top: 0.4rem;
  font-size: 0.55rem;
  line-height: 1.4;
  color: rgba(255,255,255,0.3);
}

// ── Slide transition ──────────────────────────────────────────────────────────
.hs-slide-enter-active,
.hs-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hs-slide-enter-from,
.hs-slide-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
