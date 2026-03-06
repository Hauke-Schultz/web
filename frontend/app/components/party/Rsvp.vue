<script setup>
const STORAGE_KEY = 'party_rsvp'

const defaultData = () => ({
  name:           '',
  status:         '',
  numberOfGuests: 1,
  comingByCar:    false,
  needsParking:   false,
  needsHotelRoom: false,
  numberOfRooms:  1,
  foodPreferences: ['---'],
  remarks:        '',
  lastUpdated:    null,
})

const rsvp       = ref(defaultData())
const isEditing  = ref(false)
const isSaving   = ref(false)
const justSaved  = ref(false)

// ---- localStorage ----
const ls = {
  get:     ()  => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } },
  set:     (v) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch {} },
}

onMounted(() => {
  const stored = ls.get()
  if (stored) rsvp.value = { ...defaultData(), ...stored }
})

// foodPreferences Array an Gästezahl anpassen
watch(() => rsvp.value.numberOfGuests, (n, o) => {
  const prefs = rsvp.value.foodPreferences
  if (n > prefs.length) {
    for (let i = prefs.length; i < n; i++) prefs.push('---')
  } else if (n < prefs.length) {
    rsvp.value.foodPreferences = prefs.slice(0, n)
  }
})

// ---- Computed ----
const isSubmitted = computed(() => !!rsvp.value.lastUpdated && !isEditing.value)

const formattedDate = computed(() => {
  if (!rsvp.value.lastUpdated) return ''
  return new Date(rsvp.value.lastUpdated).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
})

const foodLabel = (val) => {
  const map = { standard: 'Ich esse alles', vegetarisch: 'Vegetarisch', vegan: 'Vegan', allergien: 'Allergien/Unverträglichkeiten' }
  return map[val] ?? val
}

// ---- Submit ----
const sanitize = (s) =>
  (s ?? '').trim()
    .replace(/[^\p{L}\p{N}\s\-?!_&*+]/gu, '')
    .replace(/\s+/g, ' ')
    .substring(0, 100)
    .trim()

const submit = async () => {
  const name = sanitize(rsvp.value.name)
  if (!name) return
  if (!rsvp.value.status) return

  isSaving.value = true
  rsvp.value.name = name
  rsvp.value.lastUpdated = new Date().toISOString()
  ls.set(rsvp.value)

  await new Promise(r => setTimeout(r, 400))
  isSaving.value = false
  justSaved.value = true
  isEditing.value = false
  setTimeout(() => { justSaved.value = false }, 3000)
}

const statusBtnClass = (s) => rsvp.value.status === s
  ? 'flex-1 min-w-[100px] py-2 px-3 rounded-lg border-[1.5px] border-white/80 text-white text-sm font-medium cursor-pointer transition-transform hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
  : 'flex-1 min-w-[100px] py-2 px-3 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm font-medium cursor-pointer transition-transform hover:-translate-y-0.5'

const statusBtnStyle = (s) => {
  if (rsvp.value.status !== s) return {}
  if (s === 'accepted') return { background: 'linear-gradient(135deg, #70b569, #2da324)' }
  if (s === 'pending')  return { background: 'linear-gradient(135deg, #fba403, #df8106)' }
  if (s === 'declined') return { background: 'linear-gradient(135deg, #ff9a9a, #f5576c)' }
  return {}
}

const statusBadgeClass = (s) => {
  const base = 'inline-block px-2 py-[2px] rounded-full text-sm font-semibold border'
  if (s === 'accepted') return `${base} bg-[rgba(45,163,36,0.5)] border-[rgba(112,181,105,0.8)]`
  if (s === 'pending')  return `${base} bg-[rgba(251,164,3,0.5)] border-[rgba(251,164,3,0.8)]`
  if (s === 'declined') return `${base} bg-[rgba(245,87,108,0.5)] border-[rgba(245,87,108,0.8)]`
  return base
}
</script>

<template>
  <div class="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-xl p-6 text-white flex flex-col gap-4 h-full">
    <h2 class="text-lg font-bold text-white">✉️ Deine Rückmeldung</h2>

    <!-- Zusammenfassung nach Absenden -->
    <div v-if="isSubmitted" class="flex flex-col gap-3">
      <div class="flex gap-4 items-baseline text-sm">
        <span class="font-semibold opacity-75 w-[100px] shrink-0">Name</span>
        <span>{{ rsvp.name }}</span>
      </div>
      <div class="flex gap-4 items-baseline text-sm">
        <span class="font-semibold opacity-75 w-[100px] shrink-0">Status</span>
        <span :class="statusBadgeClass(rsvp.status)">
          <template v-if="rsvp.status === 'accepted'">✅ Dabei!</template>
          <template v-else-if="rsvp.status === 'pending'">⏳ Vielleicht</template>
          <template v-else-if="rsvp.status === 'declined'">❌ Leider nicht</template>
        </span>
      </div>

      <template v-if="rsvp.status === 'accepted'">
        <div v-if="rsvp.numberOfGuests > 1" class="flex gap-4 items-baseline text-sm">
          <span class="font-semibold opacity-75 w-[100px] shrink-0">Personen</span>
          <span>{{ rsvp.numberOfGuests }}</span>
        </div>
        <div v-if="rsvp.comingByCar" class="flex gap-4 items-baseline text-sm">
          <span class="font-semibold opacity-75 w-[100px] shrink-0">Anreise</span>
          <span>Mit dem Auto</span>
        </div>
        <div v-if="rsvp.needsParking" class="flex gap-4 items-baseline text-sm">
          <span class="font-semibold opacity-75 w-[100px] shrink-0">Parkplatz</span>
          <span>Ja</span>
        </div>
        <div v-if="rsvp.needsHotelRoom" class="flex gap-4 items-baseline text-sm">
          <span class="font-semibold opacity-75 w-[100px] shrink-0">Hotelzimmer</span>
          <span>{{ rsvp.numberOfRooms }} Zimmer</span>
        </div>
        <div v-if="rsvp.foodPreferences?.some(p => p && p !== '---')" class="flex gap-4 items-baseline text-sm">
          <span class="font-semibold opacity-75 w-[100px] shrink-0">Essen</span>
          <span>
            <span
              v-for="(pref, i) in rsvp.foodPreferences.filter(p => p && p !== '---')"
              :key="i"
              class="inline-block bg-white/15 rounded px-1 py-[2px] text-xs mr-1 mb-[2px]"
            >{{ foodLabel(pref) }}</span>
          </span>
        </div>
        <div v-if="rsvp.remarks" class="flex gap-4 items-baseline text-sm">
          <span class="font-semibold opacity-75 w-[100px] shrink-0">Anmerkung</span>
          <span>{{ rsvp.remarks }}</span>
        </div>
      </template>

      <div v-if="rsvp.remarks && rsvp.status !== 'accepted'" class="flex gap-4 items-baseline text-sm">
        <span class="font-semibold opacity-75 w-[100px] shrink-0">{{ rsvp.status === 'declined' ? 'Grund' : 'Bemerkung' }}</span>
        <span>{{ rsvp.remarks }}</span>
      </div>

      <p class="text-xs opacity-65 italic m-0 max-w-none">Abgeschickt: {{ formattedDate }}</p>

      <button
        class="w-full py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer text-white border-[1.5px] border-white/35 bg-white/20 transition-transform hover:-translate-y-px"
        @click="isEditing = true"
      >
        Eingaben ändern
      </button>
    </div>

    <!-- Formular -->
    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">

      <!-- Name -->
      <div class="flex flex-col gap-2">
        <label for="rsvp-name" class="text-sm font-medium text-white">Dein Name *</label>
        <input
          id="rsvp-name"
          v-model="rsvp.name"
          type="text"
          placeholder="Max Mustermann"
          class="py-2 px-4 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-white/80 focus:bg-white/20 font-sans"
          maxlength="50"
          required
        />
      </div>

      <!-- Status -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-white">Kommst du? *</label>
        <div class="flex gap-2 flex-wrap">
          <button
            type="button"
            :class="statusBtnClass('accepted')"
            :style="statusBtnStyle('accepted')"
            @click="rsvp.status = 'accepted'"
          >✅ Dabei!</button>
          <button
            type="button"
            :class="statusBtnClass('pending')"
            :style="statusBtnStyle('pending')"
            @click="rsvp.status = 'pending'"
          >⏳ Vielleicht</button>
          <button
            type="button"
            :class="statusBtnClass('declined')"
            :style="statusBtnStyle('declined')"
            @click="rsvp.status = 'declined'"
          >❌ Leider nicht</button>
        </div>
      </div>

      <!-- Zusatzfelder bei Zusage -->
      <div v-if="rsvp.status === 'accepted'" class="flex flex-col gap-3 p-3 bg-white/10 rounded-lg">

        <div class="flex flex-col gap-2">
          <label for="rsvp-guests" class="text-sm font-medium text-white">Anzahl Personen (inkl. dir)</label>
          <input
            id="rsvp-guests"
            v-model.number="rsvp.numberOfGuests"
            type="number"
            min="1"
            max="10"
            class="py-2 px-4 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm focus:outline-none focus:border-white/80 focus:bg-white/20 font-sans"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer text-sm text-white select-none">
            <input type="checkbox" v-model="rsvp.comingByCar" class="w-[18px] h-[18px] cursor-pointer shrink-0 accent-success" />
            <span>Ich komme mit dem Auto</span>
          </label>
        </div>

        <div v-if="rsvp.comingByCar" class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer text-sm text-white select-none">
            <input type="checkbox" v-model="rsvp.needsParking" class="w-[18px] h-[18px] cursor-pointer shrink-0 accent-success" />
            <span>Ich brauche einen Parkplatz (ca. 25 €/Tag)</span>
          </label>
        </div>

        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer text-sm text-white select-none">
            <input type="checkbox" v-model="rsvp.needsHotelRoom" class="w-[18px] h-[18px] cursor-pointer shrink-0 accent-success" />
            <span>Ich brauche ein Hotelzimmer</span>
          </label>
        </div>

        <div v-if="rsvp.needsHotelRoom" class="flex flex-col gap-2">
          <label for="rsvp-rooms" class="text-sm font-medium text-white">Anzahl Zimmer</label>
          <input
            id="rsvp-rooms"
            v-model.number="rsvp.numberOfRooms"
            type="number"
            min="1"
            max="10"
            class="py-2 px-4 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm focus:outline-none focus:border-white/80 focus:bg-white/20 font-sans"
          />
          <p class="text-sm opacity-80 max-w-none m-0">
            Zimmer direkt auf der
            <a href="https://www.hotel-hafen-hamburg.de/de/galerie/zimmer" target="_blank" rel="noopener" class="text-white">Hotel-Website</a>
            buchen — wir brauchen nur die Anzahl.
          </p>
        </div>

        <!-- Essensvorlieben -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-white">Essensvorlieben</label>
          <div class="flex flex-col gap-2">
            <div v-for="(_, i) in rsvp.foodPreferences" :key="i" class="flex items-center gap-2">
              <span class="text-sm whitespace-nowrap min-w-[64px] opacity-85">Person {{ i + 1 }}</span>
              <select
                v-model="rsvp.foodPreferences[i]"
                class="flex-1 py-2 px-4 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm focus:outline-none focus:border-white/80 font-sans"
              >
                <option value="---">Bitte auswählen…</option>
                <option value="standard">Ich esse alles</option>
                <option value="vegetarisch">Ich esse vegetarisch</option>
                <option value="vegan">Ich esse vegan</option>
                <option value="allergien">Allergien / Unverträglichkeiten</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Anmerkungen bei Zusage -->
        <div class="flex flex-col gap-2">
          <label for="rsvp-remarks" class="text-sm font-medium text-white">Anmerkungen (optional)</label>
          <textarea
            id="rsvp-remarks"
            v-model="rsvp.remarks"
            placeholder="z.B. Freue mich schon sehr! :-)"
            class="py-2 px-4 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-white/80 focus:bg-white/20 font-sans resize-y min-h-[80px] leading-relaxed"
            maxlength="500"
            rows="3"
          />
        </div>
      </div>

      <!-- Anmerkungen bei Absage -->
      <div v-if="rsvp.status === 'declined'" class="flex flex-col gap-2">
        <label class="text-sm font-medium text-white">Schade — magst du kurz sagen, warum? 😊</label>
        <textarea
          v-model="rsvp.remarks"
          placeholder="z.B. Ich bin leider im Urlaub :-("
          class="py-2 px-4 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-white/80 focus:bg-white/20 font-sans resize-y min-h-[80px] leading-relaxed"
          maxlength="500"
          rows="3"
        />
      </div>

      <!-- Anmerkungen bei Vielleicht -->
      <div v-if="rsvp.status === 'pending'" class="flex flex-col gap-2">
        <label class="text-sm font-medium text-white">Noch unsicher? Erzähl uns kurz warum 😊</label>
        <textarea
          v-model="rsvp.remarks"
          placeholder="z.B. Ich weiß es erst im Januar …"
          class="py-2 px-4 rounded-lg border-[1.5px] border-white/30 bg-white/15 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-white/80 focus:bg-white/20 font-sans resize-y min-h-[80px] leading-relaxed"
          maxlength="500"
          rows="3"
        />
      </div>

      <!-- Submit -->
      <button
        type="submit"
        class="w-full py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer text-white bg-gradient-to-br from-[#f093fb] to-[#f5576c] border-0 transition-transform hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed"
        :disabled="isSaving || !rsvp.status || !rsvp.name.trim()"
      >
        <span v-if="isSaving">Wird gespeichert…</span>
        <span v-else-if="justSaved">✓ Gespeichert!</span>
        <span v-else>Absenden</span>
      </button>

    </form>
  </div>
</template>

<style scoped>
/* select option background can't be set with Tailwind */
select option { background: #764ba2; }
</style>
