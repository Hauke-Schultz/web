<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { PLANET_TYPES, RESOURCES } from '~/utils/hawkStarConfig.js'
import HsCommLog from '~/components/hawk-star/HsCommLog.vue'
import HsBattleLog from '~/components/hawk-star/HsBattleLog.vue'
import HsGalaxyOverview from '~/components/hawk-star/HsGalaxyOverview.vue'

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
  scanDuration,
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
  raidFuelState,
  raidsAgainstMe,
  raidsByMe,
  raidLog,
  allActiveRaids,
  startRaid,
  // traffic
  activeFlights,
  flightProgress,
  flightRemainingSec,
} = useHawkStar()

const { t } = useI18n()

// ── Raid dialog ───────────────────────────────────────────────────────────────
// Opened per planet. The order is sealed at launch — the fleet cannot be
// re-tasked in flight — so both decisions are made here or not at all.
const raidTarget = ref(null)   // planet id, or null while the dialog is closed
const raidShips   = ref(1)
const raidOrder   = ref('disable')

// Why the launch is not fire-and-forget: the server refuses a sortie for half a
// dozen reasons a player meets in normal play — no power cells for the burn, no
// hull in the dock, a fleet from this planet already out. The dialog used to
// close on the click, before the answer had even arrived, so a refused raid was
// indistinguishable from a launched one: the panel shut, no fleet appeared, and
// nothing anywhere said why. It now waits for the answer, and a refusal keeps
// the dialog open with the reason on it.
const raidError   = ref('')
const raidSending = ref(false)

const openRaid = (planet) => {
  raidTarget.value = planet.id
  raidShips.value  = corvetteInventory.value
  raidOrder.value  = 'disable'
  raidError.value  = ''
}

const closeRaid = () => { raidTarget.value = null; raidError.value = '' }

// Changing the sortie clears the complaint: it was about the one that stood
// before, and this is a different one.
// Stock against bill for the sortie as it currently stands. The fleet leaves
// from the active planet, so that is the store that has to cover it.
const raidFuel = computed(() => raidFuelState(raidShips.value, activePlanetId.value))

const setRaidShips = (delta) => {
  raidShips.value = Math.max(1, Math.min(raidShips.value + delta, corvetteInventory.value))
  raidError.value = ''
}

const setRaidOrder = (order) => {
  raidOrder.value = order
  raidError.value = ''
}

const confirmRaid = async (planet, sysId) => {
  if (raidSending.value) return   // one click, one fleet
  raidSending.value = true
  raidError.value   = ''
  try {
    const res = await startRaid(planet.id, sysId, raidShips.value, raidOrder.value, activePlanetId.value)
    if (res?.ok) { closeRaid(); return }
    // The server's own words. They are diagnostic English rather than game copy,
    // but they name the thing that is missing — which is the whole point, and it
    // beats a translated "something went wrong" that names nothing. Localising
    // them would need the API to send an error *code* beside the message.
    raidError.value = res?.error || t('hawkStar.galaxy.raidFailedUnknown')
  } finally {
    raidSending.value = false
  }
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
// Two badges per commander, because the two directions are opposite news: ⚔️ is
// what they did to us, 🎯 what we did to them. Both count repelled attacks —
// three bounced attempts are exactly the thing worth watching build up.
const raidRecord    = (owner) => raidsAgainstMe(owner.playerId)
const raidOutRecord = (owner) => raidsByMe(owner.playerId)

// The card's battle log is a short read, not an archive — the badges above it
// already carry the long-term count. The server sends at most 5 per commander;
// this caps the merged list of a multi-commander system to the same length.
const BATTLE_LOG_MAX = 5

const isFresh = (rec) => !!rec && (now.value - rec.lastAt) < 24 * 3600 * 1000

const raidRecordFresh    = (owner) => isFresh(raidRecord(owner))
const raidOutRecordFresh = (owner) => isFresh(raidOutRecord(owner))

const agoLabel = (ts) => {
  const hours = Math.floor((now.value - ts) / 3600000)
  return hours < 1  ? t('hawkStar.galaxy.raidJustNow')
       : hours < 24 ? t('hawkStar.galaxy.raidHoursAgo', { n: hours })
       : t('hawkStar.galaxy.raidDaysAgo', { n: Math.floor(hours / 24) })
}

const recordLabel = (icon, rec) => rec ? `${icon} ${rec.count} · ${agoLabel(rec.lastAt)}` : ''

const raidRecordLabel    = (owner) => recordLabel('⚔️', raidRecord(owner))
const raidOutRecordLabel = (owner) => recordLabel('🎯', raidOutRecord(owner))

// The entries themselves are rendered by HsBattleLog — the same block serves the
// galaxy overview, and one copy of it keeps the two from drifting apart.

// ── System order: home first, then inhabited systems ─────────────────────────
// `inhabited` is a system-level flag from the API. It used to be derived from the
// planet owners, which no longer works: those are hidden until a spy drone lands.
const sortedSystems = computed(() => {
  const home = galaxySystems.value.find(s => s.id === homeSystemId.value)
  const rest = galaxySystems.value.filter(s => s.id !== homeSystemId.value && s.inhabited)
  return home ? [home, ...rest] : rest
})

// ── Helpers ───────────────────────────────────────────────────────────────────
// ── The star itself ───────────────────────────────────────────────────────────
// A marker is a star, drawn in CSS and lit by its spectral class, not a face.
// The portraits were a category error: what a chart of the sky shows is the
// thing that is actually out there and actually visible from home, and `starClass`
// arrives for every system whether or not it has been scanned — the star is what
// a telescope gives you for free, and *who lives on it* is precisely what the
// scan buys. Putting a commander's avatar where the star belongs said the
// opposite: that the people are the terrain.
//
// So the marker splits in two. The **core** is the star, coloured by class. The
// **rim** is your relationship to the system — blue at home, green where a scan
// found somebody, dashed where nothing has looked. Who lives there moved to the
// caption, next to the name, which is where a name belongs anyway.
const STAR_CLASS = new Set(['F', 'G', 'K', 'M'])
const starClassOf = (sys) => STAR_CLASS.has(sys.starClass) ? sys.starClass : 'G'

// Stars do not throb in unison. Derived from the id so a system keeps its own
// rhythm across reloads, and it costs nothing to compute.
const twinkleDelay = (sys) => `${-(sys.id % 7) * 0.9}s`

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
// The planet type comes with the drone's finding — `type` is null until then,
// in your own system just as much as in a foreign one. An unsurveyed world is a
// ❓, the same glyph the solar map draws for it: a generic 🪐 read as a type of
// its own and made every list look fully surveyed at a glance.
const typeIcon  = (planet) => planet.type ? (PLANET_TYPES[planet.type]?.icon ?? '🪐') : '❓'
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

// ── The chart ─────────────────────────────────────────────────────────────────
// Every system carries real galactic coordinates — 0…100 on both axes, seeded at
// least 15 apart — and BOTH the deep-space scan and the spy flight are priced by
// the distance between two of them. The old tile strip threw that away and drew
// the systems in id order, so the one number the map already knew was the one
// thing it could not show. The chart puts each system where it actually is, and
// "far away" becomes something you see before you read a countdown.
//
// Same idiom as the solar map: one square box, everything in percentages, so it
// scales from a 360 px phone to a desktop without a media query or a measurement.
const homeSys = computed(() => galaxySystems.value.find(s => s.id === homeSystemId.value) ?? null)

const nodeStyle = (sys) => ({ left: `${sys.x}%`, top: `${sys.y}%` })

// "Arix System" is the stored name. On the chart it is a caption under a dot,
// and "System" is the half every single one of them shares.
const shortName = (sys) => String(sys.name ?? '').replace(/s*System$/i, '')

const distanceTo = (sys) => {
  const h = homeSys.value
  if (!h || !sys) return 0
  return Math.round(Math.sqrt((sys.x - h.x) ** 2 + (sys.y - h.y) ** 2))
}

// Who a scan turned up. One portrait fits on a marker and one name fits under
// it, so a shared system wears the first commander and counts the rest — four
// portraits on a 2 rem dot is four things you cannot tell apart. Both halves
// come from the same list, so the badge and the caption can never disagree.
const ownerName  = (o) => o?.username ?? o?.name ?? '?'
const ownerNames = (sys) => uniqueOwners(sys).map(ownerName).join(' · ')
const ownerRest  = (sys) => Math.max(0, uniqueOwners(sys).length - 1)
const ownerLabel = (sys) => ownerName(uniqueOwners(sys)[0])

// ── Traffic ───────────────────────────────────────────────────────────────────
// The payoff of having coordinates at all. A tile strip could only ever say
// "something is on its way there", with a dot on the target; on a grid it can
// say how far along it is, in the same geometry the server bills the flight in.
const sysById = computed(() => {
  const m = {}
  for (const sys of galaxySystems.value) m[sys.id] = sys
  return m
})

// A flight placed on the chart: the two ends of its lane, and where it has got
// to between them. A flight whose endpoints are not both drawn is dropped — a
// pip travelling towards a dot that is not there is a pip going nowhere.
const chartFlights = computed(() => activeFlights.value.flatMap((fl) => {
  const a = sysById.value[fl.fromSystemId]
  const b = sysById.value[fl.toSystemId]
  if (!a || !b) return []
  const p = flightProgress(fl)
  return [{
    ...fl,
    x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
  }]
}))

const FLIGHT_ICON = {
  drone:       '🕵️',
  satellite:   '📡',
  raid:        '⚔️',
  'raid-back': '⚔️',
}

// The fleet is the flight whose outcome you are actually waiting for, so its
// countdown is printed on the pip instead of hidden in a tooltip. Espionage
// keeps its countdown on the target marker's badge, where it already was — four
// visible timers on one chart is a dashboard, not a map.
const isFleet = (fl) => fl.kind === 'raid' || fl.kind === 'raid-back'

const contactOf = (sysId) =>
  systemContacts.value[sysId] ?? { scanState: 'unscanned', scanEndsAt: null }

const resolvedScanState = (sys) =>
  isHome(sys) ? 'scanned' : contactOf(sys.id).scanState

const scanRemaining = (sysId) => {
  const c = contactOf(sysId)
  return c.scanEndsAt ? Math.max(0, Math.ceil((c.scanEndsAt - now.value) / 1000)) : 0
}


// ── Selection — home system pre-selected ──────────────────────────────────────
// The overview does not depend on this any more: it lives in the chart's column
// and is up whatever is selected. So the panel column can go back to opening on
// home, which is the one system a player always has something to read about.
// Closing it with ✕ leaves the column empty and the overview standing.
const selectedId = ref(homeSystemId.value)
const selected   = computed(() => galaxySystems.value.find(s => s.id === selectedId.value) ?? null)

const selectSystem = (sys) => {
  selectedId.value = selectedId.value === sys.id ? null : sys.id
}

// ── The panel's two faces ─────────────────────────────────────────────────────
// Card and comm log used to sit side by side, which cost the panel twice the
// width it needed and left the chart nothing to sit next to. They are two views
// of one system, not two things you read at once, so they became tabs — and the
// page can put the whole panel beside the chart instead of under it.
//
// Home has no comm log, so it has no tabs either; `activeTab` makes sure a
// 'comm' left over from the previous selection cannot blank the home panel.
const panelTab  = ref('card')
const activeTab = computed(() =>
  selected.value && !isHome(selected.value) ? panelTab.value : 'card'
)
// A new system opens on its card. Reading somebody's messages says nothing
// about what you want to see next door.
watch(selectedId, () => { panelTab.value = 'card' })

// ── Battle log for the selected system ────────────────────────────────────────
// Every battle fought with any commander who lives here, both directions, in one
// list at the foot of the card. Merged rather than folded per owner: what a
// player wants to see is "what has happened between us and this place", and that
// is one chronology. The opponent is named on every line because the list is no
// longer sitting under anybody's row.
//
// Note the entries are NOT filtered to this system's planets — a raid THEY flew
// hit one of OUR colonies somewhere else, and dropping those would leave the
// list showing only half of every feud.
//
// Defined here rather than up with the badges because it reads `selected`.
const systemBattles = computed(() => {
  if (!selected.value) return []

  const seen = new Set()
  const all  = []

  for (const owner of uniqueOwners(selected.value)) {
    for (const e of raidLog(owner.playerId)) {
      if (seen.has(e.id)) continue      // two colonies, one commander, one battle
      seen.add(e.id)
      all.push({ ...e, foeName: owner.username ?? owner.name, foePortrait: owner.portrait ?? '👤' })
    }
  }

  return all.sort((a, b) => b.foughtAt - a.foughtAt).slice(0, BATTLE_LOG_MAX)
})

// Whether the full card has anything to say. An unscanned system gets the scan
// card instead — see the template; it used to get nothing at all.
const showCard = (sys) => isHome(sys) || resolvedScanState(sys) === 'scanned'

// A marker is a 2 rem dot with a one-word caption, so everything it cannot fit
// goes in the tooltip: what the system is, who is on it, how far out it sits.
const nodeTitle = (sys) => {
  const dist = t('hawkStar.galaxy.mapDistance', { n: distanceTo(sys) })
  const st   = resolvedScanState(sys)
  const what = isHome(sys)                 ? t('hawkStar.galaxy.stateColony')
             : st === 'scanning'           ? t('hawkStar.comm.scanning')
             : st !== 'scanned'            ? t('hawkStar.galaxy.mapUnscannedHint')
             : isInhabited(sys)            ? ownerNames(sys)
             :                               t('hawkStar.galaxy.stateUncolonized')
  return isHome(sys) ? `${sys.name} — ${what}` : `${sys.name} — ${what} · ${dist}`
}

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

    <!-- ── Star chart ───────────────────────────────────────────────────────────
         The systems sit at their real coordinates. The field is inset from the
         frame by half a marker so an edge system keeps its caption, and every
         position inside it is a plain percentage — one square box, no measuring.

         The chart is a square, so a desktop always has a column of empty page
         beside it — which is exactly where the key belongs. Under the chart it
         pushed the system card further down for no reason; next to it, it costs
         nothing at all. On a phone there is no such column and it goes back to
         a wrapped row underneath.
    -->
    <div class="hs-galaxy-chart">
      <div class="hs-galaxy-orbit">
        <div class="hs-galaxy-field">

          <!-- Two faint range rings around home. They carry no rule of their own;
               they are the reminder that distance from home is what the scan and
               the spy flight are both billed by. -->
          <template v-if="homeSys">
            <span class="hs-galaxy-range" :style="{ '--hx': homeSys.x + '%', '--hy': homeSys.y + '%', '--r': '22%' }" />
            <span class="hs-galaxy-range" :style="{ '--hx': homeSys.x + '%', '--hy': homeSys.y + '%', '--r': '44%' }" />
          </template>

          <!-- The line home → selection. The chart's whole claim is that distance
               is a cost, and this is where the claim is cashed: the line is drawn
               on the same 0…100 grid the server prices the flight from. -->
          <svg
            v-if="homeSys && selected && !isHome(selected)"
            class="hs-galaxy-links"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              :x1="homeSys.x" :y1="homeSys.y"
              :x2="selected.x" :y2="selected.y"
              vector-effect="non-scaling-stroke"
            />
          </svg>

          <!-- Traffic lanes. Faint and permanent for as long as something is
               travelling them, so a pip is never a dot floating in the dark. -->
          <svg
            v-if="chartFlights.length"
            class="hs-galaxy-routes"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              v-for="fl in chartFlights"
              :key="fl.id"
              :class="`hs-galaxy-route--${fl.kind}`"
              :x1="fl.x1" :y1="fl.y1" :x2="fl.x2" :y2="fl.y2"
              vector-effect="non-scaling-stroke"
            />
          </svg>

          <!-- The flights themselves. pointer-events: none throughout — a pip
               moves, and a moving click target that can park itself on top of a
               system marker would take that marker's tap. Everything a pip could
               have put in a tooltip is either printed on it or already sitting
               on the marker it is heading for. -->
          <span
            v-for="fl in chartFlights"
            :key="fl.id"
            class="hs-galaxy-pip"
            :class="`hs-galaxy-pip--${fl.kind}`"
            :style="{ left: fl.x + '%', top: fl.y + '%' }"
          >
            <span class="hs-galaxy-pip-dot">{{ FLIGHT_ICON[fl.kind] }}</span>
            <span v-if="isFleet(fl)" class="hs-galaxy-pip-timer">
              {{ formatTime(flightRemainingSec(fl)) }}
            </span>
          </span>

          <button
            v-for="sys in sortedSystems"
            :key="sys.id"
            type="button"
            class="hs-galaxy-tile"
            :class="tileClass(sys)"
            :style="nodeStyle(sys)"
            :title="nodeTitle(sys)"
            @click="selectSystem(sys)"
          >
            <!-- The dot: a star in its own colour, inside a rim that says what
                 the system is to you. The star is visible whether or not the
                 system has been scanned, because from home it always was. -->
            <span
              class="hs-galaxy-tile-marker"
              :class="`hs-galaxy-tile-marker--${starClassOf(sys)}`"
            >
              <span class="hs-galaxy-star" :style="{ animationDelay: twinkleDelay(sys) }" />
            </span>

            <!-- Several commanders share this system. The first one wears the
                 marker; the rest are a count, because four portraits on a 2 rem
                 dot is four things you cannot tell apart. -->
            <span v-if="ownerRest(sys)" class="hs-galaxy-tile-more">+{{ ownerRest(sys) }}</span>

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

            <!-- They can see us too -->
            <span
              v-if="resolvedScanState(sys) === 'scanned' && isInhabited(sys) && contactOf(sys.id).mutualScan"
              class="hs-galaxy-tile-mutual"
              :title="t('hawkStar.comm.mutualScan')"
            >📡</span>

            <!-- Not scanned, in one corner glyph. 📶 = you can scan it right
                 now, 👁️ = they have looked at us and we have not looked back,
                 ❓ = unknown and not yet possible. All three say the same thing;
                 the actionable one wins. Not a button: at this size a button is
                 a mis-tap, and the card behind the marker is where the scan is
                 actually started. -->
            <span
              v-else-if="canScanSystem(sys.id)"
              class="hs-galaxy-tile-scanhint"
              :title="t('hawkStar.comm.scanSystem')"
            >📶</span>
            <span
              v-else-if="resolvedScanState(sys) === 'scanning'"
              class="hs-galaxy-tile-scanhint"
              :title="t('hawkStar.comm.scanning')"
            >📶</span>
            <span
              v-else-if="resolvedScanState(sys) !== 'scanned'"
              class="hs-galaxy-tile-scanhint hs-galaxy-tile-scanhint--idle"
              :title="t('hawkStar.galaxy.mapUnscannedHint')"
            >{{ contactOf(sys.id).theyScannedMe ? '👁️' : '❓' }}</span>

            <span class="hs-galaxy-tile-label">
              <span class="hs-galaxy-tile-name">{{ shortName(sys) }}</span>

              <span v-if="isHome(sys)" class="hs-galaxy-tile-state hs-galaxy-tile-state--own">
                {{ playerPortrait }} {{ t('hawkStar.galaxy.stateColony') }}
              </span>
              <span v-else-if="resolvedScanState(sys) === 'scanning'" class="hs-galaxy-tile-timer">
                {{ formatTime(scanRemaining(sys.id)) }}
              </span>
              <span v-else-if="resolvedScanState(sys) !== 'scanned'" class="hs-galaxy-tile-unknown">
                {{ t('hawkStar.comm.unscanned') }}
              </span>
              <!-- The portrait rides with the name now that the marker is a
                   star. It is the same identification, in the place that was
                   already naming the person. -->
              <span v-else-if="isInhabited(sys)" class="hs-galaxy-tile-state hs-galaxy-tile-state--inhabited">
                {{ firstOwner(sys)?.portrait ?? '👤' }} {{ ownerLabel(sys) }}
              </span>
              <span v-else class="hs-galaxy-tile-state hs-galaxy-tile-state--free">
                {{ t('hawkStar.galaxy.stateUncolonized') }}
              </span>
            </span>
          </button>
        </div>
      </div>

      <!-- What the dots mean, once, instead of five tooltips nobody opens. The
           ❓ entry is the one that matters: it is the only place the chart says
           out loud that an unknown system has to be scanned before it is anything
           else. -->
      <div class="hs-galaxy-legend">
        <span class="hs-galaxy-legend-item hs-galaxy-legend-item--home">
          <i class="hs-galaxy-legend-dot" />{{ t('hawkStar.galaxy.legendHome') }}
        </span>
        <span class="hs-galaxy-legend-item hs-galaxy-legend-item--inhabited">
          <i class="hs-galaxy-legend-dot" />{{ t('hawkStar.galaxy.legendPlayers') }}
        </span>
        <span class="hs-galaxy-legend-item hs-galaxy-legend-item--scanning">
          <i class="hs-galaxy-legend-dot" />{{ t('hawkStar.galaxy.legendScanning') }}
        </span>
        <span class="hs-galaxy-legend-item hs-galaxy-legend-item--unknown">
          <i class="hs-galaxy-legend-dot" />{{ t('hawkStar.galaxy.legendUnscanned') }}
        </span>
      </div>

      <!-- ── The standing overview — always on ────────────────────────────────────
           Under the chart and its key, in the chart's own column, so it is on
           screen whatever is or is not selected next door. Flights in the air and
           battles lately are player-wide facts: they belong to the map itself
           rather than to whichever system happens to be picked, and a fleet three
           hours from home is exactly the thing you must not lose sight of while
           reading somebody else's system card.

           It sits under the key rather than over the chart because the chart is
           the anchor of the screen — it must not move when a flight lands or a
           battle report arrives and the list changes height.

           Only the "pick a system" line comes and goes — with a card already open
           beside it, it would be wrong half the time.
      -->
      <HsGalaxyOverview :show-hint="!selected" />
    </div>

    <!-- ── Everything about the selected system ─────────────────────────────────
         One column, holding whichever of the two cards applies. On a wide
         screen it sits beside the chart; below 1024 px it drops underneath.
    -->
    <div class="hs-galaxy-side">

      <!-- ── An unknown system: the scan comes first ──────────────────────────────
           This card is new, and it exists because selecting an unscanned system
           used to do nothing visible at all: the panel below is gated on
           showCard(), and the only way to start a scan was a 0.48 rem button
           inside the tile — which the mobile layout hid outright. So the one
           action the system actually offers was the one thing you could not find.
           Now the marker opens a card that says the single true thing about an
           unknown system: scan it, and everything else becomes possible.
      -->
      <Transition name="hs-slide">
        <div v-if="selected && !showCard(selected)" class="hs-galaxy-scan-card">
          <div class="hs-galaxy-card-header">
            <div>
              <div class="hs-galaxy-card-name">{{ selected.name }}</div>
              <div class="hs-galaxy-card-meta">
                {{ t('hawkStar.galaxy.mapDistance', { n: distanceTo(selected) }) }}
              </div>
            </div>
            <button class="hs-galaxy-card-close" @click="selectedId = null">✕</button>
          </div>

          <div class="hs-galaxy-scan-body">
            <span
              class="hs-galaxy-scan-glyph"
              :class="{ 'hs-pulse-scan': resolvedScanState(selected) === 'scanning' }"
            >{{ resolvedScanState(selected) === 'scanning' ? '📶' : '❓' }}</span>
            <p class="hs-galaxy-scan-text">
              {{ resolvedScanState(selected) === 'scanning'
                  ? t('hawkStar.galaxy.scanRunningHint')
                  : t('hawkStar.galaxy.scanPrompt') }}
            </p>
          </div>

          <!-- Already under way: the countdown replaces the button, because there
               is nothing left to decide until it lands. -->
          <div v-if="resolvedScanState(selected) === 'scanning'" class="hs-galaxy-scan-timer">
            📶 {{ formatTime(scanRemaining(selected.id)) }}
          </div>

          <!-- The scan itself. Deliberately the widest thing on the card: it is
               the only control an unknown system has. -->
          <button
            v-else-if="canScanSystem(selected.id)"
            class="hs-galaxy-scan-btn"
            @click="scanSystem(selected.id)"
          >
            📶 <span class="hs-galaxy-scan-btn__label">{{ t('hawkStar.comm.scanSystem') }}</span>
            <span class="hs-galaxy-scan-btn__time">{{ formatTime(scanDuration(selected.id)) }}</span>
          </button>

          <!-- Refused, and by what. A greyed button that says nothing is the
               reason people think a feature is broken. -->
          <div v-else-if="starMapLevel < 3" class="hs-galaxy-scan-block">
            🔒 {{ t('hawkStar.galaxy.scanNeedsStarMap') }}
          </div>
          <div v-else-if="activeScan" class="hs-galaxy-scan-block">
            ⏳ {{ t('hawkStar.galaxy.scanBusy') }}
          </div>
        </div>
      </Transition>

      <!-- ── The system, in two tabs ──────────────────────────────────────────── -->
      <Transition name="hs-slide">
        <div v-if="selected && showCard(selected)" class="hs-galaxy-panel">

          <!-- No tabs on your own home system: there is nobody there to call. -->
          <div v-if="!isHome(selected)" class="hs-galaxy-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="hs-galaxy-tab"
              :class="{ 'hs-galaxy-tab--active': activeTab === 'card' }"
              :aria-selected="activeTab === 'card'"
              @click="panelTab = 'card'"
            >🪐 {{ t('hawkStar.galaxy.tabSystem') }}</button>

            <button
              type="button"
              role="tab"
              class="hs-galaxy-tab"
              :class="{ 'hs-galaxy-tab--active': activeTab === 'comm' }"
              :aria-selected="activeTab === 'comm'"
              @click="panelTab = 'comm'"
            >
              📡 {{ t('hawkStar.galaxy.tabComm') }}
              <!-- A tab hides what is behind it, so the one thing that arrives on
                   its own has to knock. Without this dot a message landing in the
                   closed tab would be silent. -->
              <span v-if="unreadSystems[String(selected.id)]" class="hs-galaxy-tab-dot" />
            </button>
          </div>

          <!-- v-if, not v-show: HsCommLog marks the system read when it mounts, and
               a log kept alive behind a closed tab would clear the unread dot for
               messages nobody has looked at. Opening the tab IS reading them. -->
          <div v-if="activeTab === 'comm'" class="hs-galaxy-comm-wrap">
            <HsCommLog :system-id="selected.id" />
          </div>

          <!-- System card -->
          <div v-show="activeTab === 'card'" class="hs-galaxy-card">
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

                  <!-- The running record, both ways round: ⚔️ what they did to us,
                       🎯 what we did to them. Won and repelled raids both count —
                       an attacker who keeps bouncing off is still an attacker, and
                       the next fleet will be bigger. The single battles are in the
                       log at the foot of the card. -->
                  <div class="hs-faction-record">
                    <span
                      v-if="raidOutRecord(owner)"
                      class="hs-faction-raids hs-faction-raids--out"
                      :class="{ 'hs-faction-raids--fresh-out': raidOutRecordFresh(owner) }"
                      :title="t('hawkStar.galaxy.raidOutRecordHint', { n: raidOutRecord(owner).count })"
                    >{{ raidOutRecordLabel(owner) }}</span>
                    <span
                      v-if="raidRecord(owner)"
                      class="hs-faction-raids"
                      :class="{ 'hs-faction-raids--fresh': raidRecordFresh(owner) }"
                      :title="t('hawkStar.galaxy.raidRecordHint', { n: raidRecord(owner).count })"
                    >{{ raidRecordLabel(owner) }}</span>
                  </div>
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
                <!-- have / need. A bare "🔋 4" was the bill with nothing to
                     measure it against, so the only way to find out the burn
                     could not be paid was to launch and be refused. -->
                <span
                  class="hs-raid-fuel"
                  :class="{ 'hs-raid-fuel--short': raidFuel.short }"
                  :title="t('hawkStar.galaxy.raidFuelHint')"
                >
                  {{ RESOURCES[raidFuel.key]?.icon ?? '🔋' }} {{ raidFuel.have }} / {{ raidFuel.need }}
                </span>
              </div>

              <div class="hs-raid-orders">
                <button
                  class="hs-raid-order"
                  :class="{ 'hs-raid-order--active': raidOrder === 'disable' }"
                  @click="setRaidOrder('disable')"
                >
                  <span class="hs-raid-order-title">⚡ {{ t('hawkStar.galaxy.raidDisable') }}</span>
                  <span class="hs-raid-order-desc">{{ t('hawkStar.galaxy.raidDisableDesc') }}</span>
                </button>
                <button
                  class="hs-raid-order"
                  :class="{ 'hs-raid-order--active': raidOrder === 'plunder' }"
                  @click="setRaidOrder('plunder')"
                >
                  <span class="hs-raid-order-title">💰 {{ t('hawkStar.galaxy.raidPlunder') }}</span>
                  <span class="hs-raid-order-desc">{{ t('hawkStar.galaxy.raidPlunderDesc') }}</span>
                </button>
              </div>

              <!-- What the server said, verbatim, right under the button that
                   asked. It stays until the order changes or the dialog closes. -->
              <div v-if="raidError" class="hs-raid-error">
                <span class="hs-raid-error-label">⚠ {{ t('hawkStar.galaxy.raidFailed') }}</span>
                <span class="hs-raid-error-text">{{ raidError }}</span>
              </div>

              <button
                class="hs-raid-launch"
                :disabled="raidSending || raidFuel.short"
                @click="confirmRaid(selected.planets.find(p => p.id === raidTarget), selected.id)"
              >
                {{ raidSending
                    ? t('hawkStar.galaxy.raidLaunching')
                    : t('hawkStar.galaxy.raidLaunch', { time: raidFlightLabel(selected) }) }}
              </button>
            </div>

            <!-- One line of context under the list, so the ❓ is not a mystery -->
            <div v-if="!isHome(selected) && isInhabited(selected)" class="hs-planet-list-hint">
              {{ t('hawkStar.galaxy.spyHint') }}
            </div>

            <!-- Everything that has been fought out with the commanders of this
                 system, newest first, both directions. Always open: it is the one
                 part of the card that is history rather than a control, and it
                 belongs at the foot for exactly that reason. Each entry is one raid
                 read from our chair — who flew, what it cost the fleet, what it did
                 to the target's two meters, what came home in the hold. -->
            <HsBattleLog :entries="systemBattles" />
          </div>

        </div>
      </Transition>

    </div>

  </div>
</template>

<style lang="scss" scoped>
// ── Two columns ───────────────────────────────────────────────────────────────
// Chart on the left, the selected system on the right. The split waits for
// 1024 px because .hs-main caps the whole view at 52 rem: below roughly that
// viewport there is no second column to be had, and a 300 px system card with a
// planet list in it is worse than one that has the width to itself.
.hs-galaxy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  @media (min-width: 1024px) {
    flex-direction: row;
    align-items: flex-start;
    gap: 1rem;

    .hs-galaxy-chart { flex: 1 1 0; min-width: 0; }
    .hs-galaxy-side  { flex: 1 1 0; min-width: 0; }
  }
}

// Whichever card the selection calls for, in one column.
.hs-galaxy-side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Chart + key + overview ────────────────────────────────────────────────────
// The key stays under the chart it explains, at every width, and the standing
// overview under the key. The spare column a desktop has goes to the system
// panel instead — that is the thing whose height was pushing the page around.
//
// The overview belongs to this column rather than to the panel's: it is on
// screen whether or not a system is selected, and its two lists change height on
// their own (a flight lands, a report arrives). Under the key it pushes nothing;
// above the chart it would move the anchor of the whole screen.
.hs-galaxy-chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

// ── Star chart ────────────────────────────────────────────────────────────────
// A square box, like the solar map: every position inside it is a percentage of
// the same side, so a system's coordinates mean the same thing on a 360 px phone
// and on a desktop, and nothing here needs a media query to stay true.
// --node is the only pixel-ish value, and it grows exactly once.
.hs-galaxy-orbit {
  --node: 2.1rem;

  position: relative;
  width: 100%;
  max-width: 32rem;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--hs-line-md);
  border-radius: var(--hs-r-lg);
  overflow: hidden;
  background:
    radial-gradient(ellipse 70% 55% at 34% 38%, rgba(129,140,248,0.13), transparent 70%),
    radial-gradient(ellipse 60% 70% at 72% 68%, rgba(45,212,191,0.07),  transparent 72%),
    radial-gradient(circle at 12% 22%, rgba(255,255,255,0.55) 0 1px, transparent 1.5px),
    radial-gradient(circle at 78% 12%, rgba(255,255,255,0.40) 0 1px, transparent 1.5px),
    radial-gradient(circle at 88% 62%, rgba(255,255,255,0.50) 0 1px, transparent 1.5px),
    radial-gradient(circle at 32% 88%, rgba(255,255,255,0.35) 0 1px, transparent 1.5px),
    radial-gradient(circle at 62% 92%, rgba(255,255,255,0.45) 0 1px, transparent 1.5px),
    radial-gradient(circle at 6%  68%, rgba(255,255,255,0.30) 0 1px, transparent 1.5px),
    radial-gradient(circle at 94% 34%, rgba(255,255,255,0.30) 0 1px, transparent 1.5px),
    radial-gradient(circle at 46% 6%,  rgba(255,255,255,0.35) 0 1px, transparent 1.5px),
    radial-gradient(circle at 20% 52%, rgba(255,255,255,0.22) 0 1px, transparent 1.5px),
    radial-gradient(circle at 70% 44%, rgba(255,255,255,0.22) 0 1px, transparent 1.5px),
    radial-gradient(circle at 55% 26%, rgba(255,255,255,0.18) 0 1px, transparent 1.5px),
    radial-gradient(circle at 40% 70%, rgba(255,255,255,0.20) 0 1px, transparent 1.5px),
    linear-gradient(180deg, rgba(10,12,24,0.75), rgba(6,8,18,0.92));

  @media (min-width: 640px) { --node: 2.6rem; }
}

// The seeder puts systems anywhere in 5…95, so the field is inset by half a
// marker, plus the caption's height at the bottom. Without it an edge system
// loses its name to the frame — and the name is the one thing a dot cannot draw.
.hs-galaxy-field {
  position: absolute;
  inset: calc(var(--node) * 0.62) calc(var(--node) * 0.75) calc(var(--node) * 0.95);
}

// ── Range rings ───────────────────────────────────────────────────────────────
// Centred on home, carrying no rule of their own. They are the reminder that
// distance from home is what the scan and the spy flight are both billed by.
// The box is square, so one percentage sizes both axes.
.hs-galaxy-range {
  position: absolute;
  left:   calc(var(--hx) - var(--r));
  top:    calc(var(--hy) - var(--r));
  width:  calc(var(--r) * 2);
  height: calc(var(--r) * 2);
  border: 1px solid rgba(129,140,248,0.10);
  border-radius: 50%;
  pointer-events: none;
}

// ── Home → selection ──────────────────────────────────────────────────────────
// The svg covers the field exactly and shares its 0…100 grid, so the line needs
// no arithmetic: it is drawn straight from the coordinates the server prices the
// scan and the spy flight from.
.hs-galaxy-links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;

  line {
    stroke: rgba(129,140,248,0.55);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    animation: hs-galaxy-lane 1.4s linear infinite;
  }
}
@keyframes hs-galaxy-lane {
  to { stroke-dashoffset: -8; }
}

// ── Traffic ───────────────────────────────────────────────────────────────────
// Lanes share the link layer's grid, so they need no arithmetic either.
.hs-galaxy-routes {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;

  line {
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
  .hs-galaxy-route--drone     { stroke: rgba(167,139,250,0.35); }
  .hs-galaxy-route--satellite { stroke: rgba(45,212,191,0.35); }
  .hs-galaxy-route--raid      { stroke: rgba(248,113,113,0.45); }
  .hs-galaxy-route--raid-back { stroke: rgba(248,113,113,0.22); }
}

// Above the markers, because a flight is the thing that has changed since you
// last looked — and it is only there for as long as it is flying.
.hs-galaxy-pip {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  z-index: 8;
  pointer-events: none;
}

.hs-galaxy-pip-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  font-size: 0.55rem;
  line-height: 1;
  border: 1px solid transparent;
  background: rgba(8,10,20,0.92);

  .hs-galaxy-pip--drone &     { border-color: rgba(167,139,250,0.9); box-shadow: 0 0 8px rgba(167,139,250,0.55); }
  .hs-galaxy-pip--satellite & { border-color: rgba(45,212,191,0.9);  box-shadow: 0 0 8px rgba(45,212,191,0.55); }
  .hs-galaxy-pip--raid &      { border-color: rgba(248,113,113,0.95); box-shadow: 0 0 10px rgba(248,113,113,0.65); }
  // The way home is the same fleet with nothing left to decide about it, so it
  // travels dimmed: still worth seeing, no longer worth watching.
  .hs-galaxy-pip--raid-back & { border-color: rgba(248,113,113,0.5); opacity: 0.75; }
}

// The one timer the chart prints rather than hides. It sits under the pip and
// travels with it, so "how much longer" is answered in the same glance as
// "how far".
.hs-galaxy-pip-timer {
  padding: 0 3px;
  border-radius: 999px;
  font-size: 0.42rem;
  font-weight: 800;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
  color: rgba(254,226,226,0.95);
  background: rgba(127,29,29,0.9);
  white-space: nowrap;

  @media (min-width: 640px) { font-size: 0.46rem; }

  .hs-galaxy-pip--raid-back & { background: rgba(60,20,20,0.85); color: rgba(254,226,226,0.7); }
}

// ── Markers ───────────────────────────────────────────────────────────────────
// The button is the size of the dot and nothing more, so translate(-50%, -50%)
// lands it on its true coordinate. The caption hangs below without moving it,
// and the hit area is grown by a pseudo-element rather than by padding — padding
// would drag the dot off the point it is supposed to mark.
.hs-galaxy-tile {
  position: absolute;
  transform: translate(-50%, -50%);
  width: var(--node);
  height: var(--node);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;

  &::before {
    content: '';
    position: absolute;
    // 44 px of thumb around a 34 px dot. Markers are seeded at least 15 units
    // apart, which is wider than this at every size the chart is drawn at.
    inset: calc((2.75rem - var(--node)) / -2);
    border-radius: 50%;
  }

  &:focus-visible { outline: none; }
  &:focus-visible .hs-galaxy-tile-marker {
    outline: 2px solid var(--hs-active-border);
    outline-offset: 2px;
  }

  &--selected { z-index: 6; }
  &--home     { z-index: 5; }
  &:hover     { z-index: 7; }
}

// The dot, in two parts. The RIM is your relationship to the system — solid
// blue at home, green where a scan found somebody, dashed where nothing has
// looked yet. The CORE is the star itself, and it is there in every state,
// because a star is visible from home whether or not anybody has scanned it.
//
// Spectral class drives the colour, and the classes the seeder deals out are the
// real ones: F white, G yellow like ours, K orange, M red.
.hs-galaxy-tile-marker {
  --star-core: #fde68a;
  --star-edge: #f59e0b;
  --star-glow: rgba(251,191,36,0.65);

  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
  border: 1px solid var(--hs-line-xl);
  background: rgba(12,14,28,0.9);
  transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &--F { --star-core: #f8fafc; --star-edge: #93c5fd; --star-glow: rgba(191,219,254,0.7); }
  &--G { --star-core: #fef3c7; --star-edge: #f59e0b; --star-glow: rgba(251,191,36,0.65); }
  &--K { --star-core: #fed7aa; --star-edge: #f97316; --star-glow: rgba(249,115,22,0.6); }
  &--M { --star-core: #fecaca; --star-edge: #ef4444; --star-glow: rgba(239,68,68,0.55); }

  .hs-galaxy-tile:hover & { transform: scale(1.08); }

  .hs-galaxy-tile--home & {
    border-color: rgba(96,165,250,0.75);
    background: rgba(30,58,138,0.55);
    box-shadow: 0 0 14px rgba(96,165,250,0.4);
  }
  .hs-galaxy-tile--inhabited & {
    border-color: rgba(52,211,153,0.6);
    background: rgba(6,78,59,0.5);
    box-shadow: 0 0 10px rgba(52,211,153,0.22);
  }
  .hs-galaxy-tile--scanned & {
    border-color: rgba(255,255,255,0.28);
  }
  .hs-galaxy-tile--scanning & {
    border-color: rgba(251,191,36,0.75);
    background: rgba(120,53,15,0.45);
    box-shadow: 0 0 12px rgba(251,191,36,0.3);
  }
  // Unknown reads as unknown: a dashed ring, a dim glyph, no fill worth looking
  // at. What is in there is not information the chart has.
  .hs-galaxy-tile--unknown & {
    border: 1px dashed rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.03);
    opacity: 0.75;
  }
  .hs-galaxy-tile--selected & {
    border-color: var(--hs-active-border);
    box-shadow: 0 0 0 2px var(--hs-active-border), 0 0 22px var(--hs-active-glow);
    opacity: 1;
  }
}

// The star. Offset highlight rather than a centred one, so it reads as a lit
// sphere instead of a flat disc — the same trick the solar map's sun uses, at a
// tenth of the size.
.hs-galaxy-star {
  position: absolute;
  inset: 16%;
  border-radius: 50%;
  // Fades to plain `transparent` rather than a mixed colour: color-mix() is not
  // old enough to bet a whole background declaration on, and an unsupported
  // value here does not degrade — it drops the gradient and the star disappears.
  // The chart's ground is near-black anyway, so sRGB's fade through
  // transparent-black is the colour we would have mixed towards regardless.
  background: radial-gradient(circle at 36% 32%,
    #fff 0%,
    var(--star-core) 30%,
    var(--star-edge) 76%,
    transparent 100%);
  box-shadow:
    0 0 7px 1px var(--star-glow),
    inset 0 0 5px rgba(255,255,255,0.45);
  animation: hs-galaxy-twinkle 6s ease-in-out infinite;
  pointer-events: none;

  // Nothing has looked at this system, so the star is all there is: it stays
  // lit, because you really can see it, but nothing about it is resolved.
  .hs-galaxy-tile--unknown & { opacity: 0.55; box-shadow: 0 0 5px 0 var(--star-glow); }
  .hs-galaxy-tile--selected & { animation-duration: 3s; }
}

// A slow breath, not a blink. Each star gets its own phase from its id, so a
// chart of six systems does not pulse like one object.
@keyframes hs-galaxy-twinkle {
  0%, 100% { transform: scale(1);    filter: brightness(1); }
  50%      { transform: scale(1.06); filter: brightness(1.2); }
}

// ── Caption ───────────────────────────────────────────────────────────────────
// Hangs under the dot and never takes a click: two captions can overlap where
// two systems sit close, and a name must not swallow its neighbour's marker.
.hs-galaxy-tile-label {
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  pointer-events: none;
  max-width: 6rem;
}

.hs-galaxy-tile-name {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(255,255,255,0.82);
  text-shadow: 0 1px 3px rgba(0,0,0,0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;

  @media (min-width: 640px) { font-size: 0.58rem; }

  .hs-galaxy-tile--unknown &  { color: rgba(255,255,255,0.4); font-weight: 600; }
  .hs-galaxy-tile--selected & { color: #fff; }
}

.hs-galaxy-tile-state {
  font-size: 0.45rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-shadow: 0 1px 3px rgba(0,0,0,0.95);

  @media (min-width: 640px) { font-size: 0.5rem; }

  &--own       { color: rgba(147,197,253,0.95); }
  &--inhabited { color: rgba(110,231,183,0.95); }
  &--free      { color: rgba(148,163,184,0.7); }
}

.hs-galaxy-tile-timer {
  font-size: 0.45rem;
  font-weight: 700;
  color: rgba(253,224,71,0.95);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px rgba(0,0,0,0.95);

  @media (min-width: 640px) { font-size: 0.5rem; }
}

// Under every dark corner of the chart this word would be noise, so it is
// spelled out on the system you are actually looking at — and once, in the
// legend, for all the others.
.hs-galaxy-tile-unknown {
  font-size: 0.45rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
  text-shadow: 0 1px 3px rgba(0,0,0,0.95);
  display: none;

  .hs-galaxy-tile--selected & { display: block; }
}

// ── Badges on the dot ─────────────────────────────────────────────────────────
.hs-galaxy-tile-unread {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f87171;
  box-shadow: 0 0 6px rgba(248,113,113,0.75);
  animation: hs-pulse-unread 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes hs-pulse-unread {
  0%, 100% { opacity: 1;    transform: scale(1);   }
  50%      { opacity: 0.55; transform: scale(1.4); }
}

// Something of ours is on its way into this system. Top-LEFT, opposite the
// unread dot, so a system that has both still reads as two separate signals.
.hs-galaxy-tile-spy {
  position: absolute;
  top: -1px;
  left: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a78bfa;
  box-shadow: 0 0 6px rgba(167,139,250,0.75);
  animation: hs-pulse-unread 1.4s ease-in-out infinite;
  // Deliberately NOT pointer-events: none — the title is the only place the
  // target planet and the countdown are named. The click still bubbles to the
  // marker, so selecting the system keeps working.

  &--sat {
    background: #2dd4bf;
    box-shadow: 0 0 6px rgba(45,212,191,0.75);
  }
}

// They can see us too — bottom-right of the dot, clear of both corner signals.
.hs-galaxy-tile-mutual {
  position: absolute;
  right: -3px;
  bottom: -3px;
  font-size: 0.55rem;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
}

// A scan is available here right now. It shares the mutual badge's corner
// because a system can never be both: one is scanned and the other is not.
.hs-galaxy-tile-scanhint {
  position: absolute;
  right: -4px;
  bottom: -4px;
  font-size: 0.55rem;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9));
  animation: hs-pulse-scan 1.6s ease-in-out infinite;
  pointer-events: none;

  // Nothing to do about it yet — no star map, or another scan already running.
  // It states the fact without asking for a tap it cannot honour.
  &--idle { animation: none; opacity: 0.75; }
}

// More commanders than fit on the dot.
.hs-galaxy-tile-more {
  position: absolute;
  left: -6px;
  bottom: -4px;
  padding: 0 3px;
  border-radius: 999px;
  font-size: 0.42rem;
  font-weight: 800;
  line-height: 1.5;
  color: rgba(6,78,59,0.95);
  background: rgba(110,231,183,0.95);
  pointer-events: none;
}

// ── Legend ────────────────────────────────────────────────────────────────────
// Four words under the chart. Cheaper than four tooltips, and the ❓ line is the
// only place the map states its own precondition out loud.
.hs-galaxy-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem 0.7rem;
  padding: 0 0.25rem;
}

.hs-galaxy-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  font-size: 0.5rem;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  white-space: nowrap;

  @media (min-width: 640px) { font-size: 0.56rem; }

  &--home      .hs-galaxy-legend-dot { border-color: rgba(96,165,250,0.85); background: rgba(96,165,250,0.35); }
  &--inhabited .hs-galaxy-legend-dot { border-color: rgba(52,211,153,0.75); background: rgba(52,211,153,0.3); }
  &--scanning  .hs-galaxy-legend-dot { border-color: rgba(251,191,36,0.8);  background: rgba(251,191,36,0.3); }
  &--unknown {
    color: rgba(255,255,255,0.55);
    .hs-galaxy-legend-dot { border-style: dashed; border-color: rgba(255,255,255,0.4); background: none; }
  }
}

.hs-galaxy-legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.3);
  flex: none;
}

// ── An unknown system's card ──────────────────────────────────────────────────
.hs-galaxy-scan-card {
  background: var(--hs-glass-sm);
  border: 1px solid rgba(251,191,36,0.28);
  border-radius: var(--hs-r-lg);
  padding: 0.625rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hs-galaxy-scan-body {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.hs-galaxy-scan-glyph {
  font-size: 1.5rem;
  line-height: 1;
  flex: none;
}

.hs-galaxy-scan-text {
  margin: 0;
  font-size: 0.62rem;
  line-height: 1.45;
  color: rgba(255,255,255,0.6);
}

// ── Scan button ───────────────────────────────────────────────────────────────
// Full width and a thumb tall, because it is the only control an unknown system
// has. It used to be a 0.48 rem chip inside a 2.25 rem tile, with its label
// hidden below 640 px — which left a phone with a bare 📶 and no way to learn
// what it did.
.hs-galaxy-scan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(251,191,36,0.45);
  background: rgba(251,191,36,0.12);
  color: rgba(253,230,138,0.95);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(251,191,36,0.2); border-color: rgba(251,191,36,0.7); }
  &:focus-visible { outline: 2px solid var(--hs-active-border); outline-offset: 2px; }
}

.hs-galaxy-scan-btn__time {
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(253,230,138,0.6);
  font-variant-numeric: tabular-nums;
}

// Why the button is not there. A control that is simply missing, with no reason
// beside it, is the thing people report as broken.
.hs-galaxy-scan-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--hs-r-sm);
  border: 1px dashed var(--hs-line-lg);
  font-size: 0.62rem;
  font-weight: 600;
  color: rgba(255,255,255,0.4);
  text-align: center;
}

.hs-galaxy-scan-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.5rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(251,191,36,0.35);
  background: rgba(251,191,36,0.08);
  font-size: 0.8rem;
  font-weight: 700;
  color: rgba(253,230,138,0.95);
  font-variant-numeric: tabular-nums;
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
  gap: 0.5rem;
  min-width: 0;
}

.hs-galaxy-comm-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
// Two views of one system. They are pills rather than an underlined bar because
// the panel below them is already a bordered card, and a second horizontal rule
// straight above it reads as a crack in the surface.
.hs-galaxy-tabs {
  display: flex;
  gap: 0.3rem;
}

.hs-galaxy-tab {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  // A tab is a target before it is a label: 40 px is what a thumb needs, and
  // this row is the one control that is always on screen.
  min-height: 2.5rem;
  padding: 0.35rem 0.6rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid var(--hs-line-lg);
  background: var(--hs-glass-xs);
  color: rgba(255,255,255,0.5);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover { background: var(--hs-glass-md); color: rgba(255,255,255,0.75); }
  &:focus-visible { outline: 2px solid var(--hs-active-border); outline-offset: 2px; }

  &--active {
    background: var(--hs-active-bg);
    border-color: var(--hs-active-border);
    color: #fff;
  }
}

// Same dot the chart uses for an unread system, in the place the tab hid it.
.hs-galaxy-tab-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f87171;
  box-shadow: 0 0 6px rgba(248,113,113,0.75);
  animation: hs-pulse-unread 1.4s ease-in-out infinite;
}

// ── A refused sortie ──────────────────────────────────────────────────────────
// Loud enough to be seen without hunting, quiet enough not to read as a crash:
// this is a normal answer to a normal request, not the game falling over.
.hs-raid-error {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.45rem 0.6rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid var(--hs-danger-border-card);
  background: var(--hs-danger-bg-card);
}

.hs-raid-error-label {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--hs-danger-muted);
}

// The server's message is not wrapped in anything clever — it names the missing
// thing, so it is allowed the room to say it.
.hs-raid-error-text {
  font-size: 0.62rem;
  line-height: 1.4;
  color: rgba(255,255,255,0.75);
  overflow-wrap: anywhere;
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

// The ❓ is a statement, not a placeholder, so it stays readable — the greyed-out
// treatment of a missing shield would push it under the row it belongs to.
.hs-planet-type {
  font-size: 0.7rem;
  line-height: 1;
  flex: none;

  &--unknown {
    filter: grayscale(1);
    opacity: 0.6;
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
.hs-faction-record {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.hs-faction-raids {
  flex-shrink: 0;
  font-size: 0.55rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;

  // Recent means "still going on". After a day it is history, and history is grey.
  &--fresh     { color: rgba(248,113,113,0.95); }   // they came for us — red
  &--fresh-out { color: rgba(251,191,36,0.95); }    // we went for them — amber
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

.hs-raid-fuel {
  color: rgba(255,255,255,0.5);
  font-weight: 600;
  font-variant-numeric: tabular-nums;

  // The one thing on the dialog that can stop the launch, so it is the one
  // thing allowed to shout.
  &--short {
    color: var(--hs-danger-muted);
    font-weight: 800;
  }
}

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

  // While the request is out. The click already happened; a second one would
  // either send a second fleet or collect the refusal for the first.
  &:disabled {
    opacity: 0.55;
    cursor: default;
    background: rgba(248,113,113,0.2);
  }
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
