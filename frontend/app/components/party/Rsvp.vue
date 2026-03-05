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

  await new Promise(r => setTimeout(r, 400)) // kurze Bestätigungs-Pause
  isSaving.value = false
  justSaved.value = true
  isEditing.value = false
  setTimeout(() => { justSaved.value = false }, 3000)
}
</script>

<template>
  <div class="rsvp-card">
    <h2 class="rsvp-card__title">✉️ Deine Rückmeldung</h2>

    <!-- Zusammenfassung nach Absenden -->
    <div v-if="isSubmitted" class="rsvp-summary">
      <div class="summary-row">
        <span class="summary-label">Name</span>
        <span>{{ rsvp.name }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Status</span>
        <span
          class="status-badge"
          :class="`status-badge--${rsvp.status}`"
        >
          <template v-if="rsvp.status === 'accepted'">✅ Dabei!</template>
          <template v-else-if="rsvp.status === 'pending'">⏳ Vielleicht</template>
          <template v-else-if="rsvp.status === 'declined'">❌ Leider nicht</template>
        </span>
      </div>

      <template v-if="rsvp.status === 'accepted'">
        <div v-if="rsvp.numberOfGuests > 1" class="summary-row">
          <span class="summary-label">Personen</span>
          <span>{{ rsvp.numberOfGuests }}</span>
        </div>
        <div v-if="rsvp.comingByCar" class="summary-row">
          <span class="summary-label">Anreise</span>
          <span>Mit dem Auto</span>
        </div>
        <div v-if="rsvp.needsParking" class="summary-row">
          <span class="summary-label">Parkplatz</span>
          <span>Ja</span>
        </div>
        <div v-if="rsvp.needsHotelRoom" class="summary-row">
          <span class="summary-label">Hotelzimmer</span>
          <span>{{ rsvp.numberOfRooms }} Zimmer</span>
        </div>
        <div v-if="rsvp.foodPreferences?.some(p => p && p !== '---')" class="summary-row">
          <span class="summary-label">Essen</span>
          <span>
            <span
              v-for="(pref, i) in rsvp.foodPreferences.filter(p => p && p !== '---')"
              :key="i"
              class="food-tag"
            >{{ foodLabel(pref) }}</span>
          </span>
        </div>
        <div v-if="rsvp.remarks" class="summary-row">
          <span class="summary-label">Anmerkung</span>
          <span>{{ rsvp.remarks }}</span>
        </div>
      </template>

      <div v-if="rsvp.remarks && rsvp.status !== 'accepted'" class="summary-row">
        <span class="summary-label">{{ rsvp.status === 'declined' ? 'Grund' : 'Bemerkung' }}</span>
        <span>{{ rsvp.remarks }}</span>
      </div>

      <p class="rsvp-updated">Abgeschickt: {{ formattedDate }}</p>

      <button class="rsvp-btn rsvp-btn--secondary" @click="isEditing = true">
        Eingaben ändern
      </button>
    </div>

    <!-- Formular -->
    <form v-else class="rsvp-form" @submit.prevent="submit">

      <!-- Name -->
      <div class="form-group">
        <label for="rsvp-name">Dein Name *</label>
        <input
          id="rsvp-name"
          v-model="rsvp.name"
          type="text"
          placeholder="Max Mustermann"
          class="rsvp-input"
          maxlength="50"
          required
        />
      </div>

      <!-- Status -->
      <div class="form-group">
        <label>Kommst du? *</label>
        <div class="status-btns">
          <button type="button" class="status-btn" :class="{ 'status-btn--accepted': rsvp.status === 'accepted' }" @click="rsvp.status = 'accepted'">✅ Dabei!</button>
          <button type="button" class="status-btn" :class="{ 'status-btn--pending':  rsvp.status === 'pending'  }" @click="rsvp.status = 'pending'">⏳ Vielleicht</button>
          <button type="button" class="status-btn" :class="{ 'status-btn--declined': rsvp.status === 'declined' }" @click="rsvp.status = 'declined'">❌ Leider nicht</button>
        </div>
      </div>

      <!-- Zusatzfelder bei Zusage -->
      <div v-if="rsvp.status === 'accepted'" class="additional-fields">

        <div class="form-group">
          <label for="rsvp-guests">Anzahl Personen (inkl. dir)</label>
          <input id="rsvp-guests" v-model.number="rsvp.numberOfGuests" type="number" min="1" max="10" class="rsvp-input" />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="rsvp.comingByCar" class="rsvp-checkbox" />
            <span>Ich komme mit dem Auto</span>
          </label>
        </div>

        <div v-if="rsvp.comingByCar" class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="rsvp.needsParking" class="rsvp-checkbox" />
            <span>Ich brauche einen Parkplatz (ca. 25 €/Tag)</span>
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="rsvp.needsHotelRoom" class="rsvp-checkbox" />
            <span>Ich brauche ein Hotelzimmer</span>
          </label>
        </div>

        <div v-if="rsvp.needsHotelRoom" class="form-group">
          <label for="rsvp-rooms">Anzahl Zimmer</label>
          <input id="rsvp-rooms" v-model.number="rsvp.numberOfRooms" type="number" min="1" max="10" class="rsvp-input" />
          <p class="rsvp-hint">
            Zimmer direkt auf der
            <a href="https://www.hotel-hafen-hamburg.de/de/galerie/zimmer" target="_blank" rel="noopener">Hotel-Website</a>
            buchen — wir brauchen nur die Anzahl.
          </p>
        </div>

        <!-- Essensvorlieben -->
        <div class="form-group">
          <label>Essensvorlieben</label>
          <div class="food-list">
            <div v-for="(_, i) in rsvp.foodPreferences" :key="i" class="food-item">
              <span class="food-person">Person {{ i + 1 }}</span>
              <select v-model="rsvp.foodPreferences[i]" class="rsvp-input">
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
        <div class="form-group">
          <label for="rsvp-remarks">Anmerkungen (optional)</label>
          <textarea id="rsvp-remarks" v-model="rsvp.remarks" placeholder="z.B. Freue mich schon sehr! :-)" class="rsvp-textarea" maxlength="500" rows="3" />
        </div>
      </div>

      <!-- Anmerkungen bei Absage -->
      <div v-if="rsvp.status === 'declined'" class="form-group">
        <label>Schade — magst du kurz sagen, warum? 😊</label>
        <textarea v-model="rsvp.remarks" placeholder="z.B. Ich bin leider im Urlaub :-(" class="rsvp-textarea" maxlength="500" rows="3" />
      </div>

      <!-- Anmerkungen bei Vielleicht -->
      <div v-if="rsvp.status === 'pending'" class="form-group">
        <label>Noch unsicher? Erzähl uns kurz warum 😊</label>
        <textarea v-model="rsvp.remarks" placeholder="z.B. Ich weiß es erst im Januar …" class="rsvp-textarea" maxlength="500" rows="3" />
      </div>

      <!-- Submit -->
      <button
        type="submit"
        class="rsvp-btn rsvp-btn--primary"
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
/* ---- Card ---- */
.rsvp-card {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  color: var(--color-white);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  height: 100%;
}

.rsvp-card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-white);
}

/* ---- Form ---- */
.rsvp-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-white);
}

/* ---- Inputs ---- */
.rsvp-input,
.rsvp-textarea {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1.5px solid rgba(255 255 255 / 0.3);
  background: rgba(255 255 255 / 0.15);
  color: var(--color-white);
  font-size: var(--font-size-sm);
  font-family: var(--font-sans);
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.rsvp-input::placeholder,
.rsvp-textarea::placeholder { color: rgba(255 255 255 / 0.5); }

.rsvp-input:focus,
.rsvp-textarea:focus {
  outline: none;
  border-color: rgba(255 255 255 / 0.8);
  background: rgba(255 255 255 / 0.2);
}

.rsvp-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

select.rsvp-input option { background: #764ba2; }

/* ---- Status Buttons ---- */
.status-btns {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.status-btn {
  flex: 1;
  min-width: 100px;
  padding: var(--space-sm) var(--space-3);
  border-radius: var(--radius-md);
  border: 1.5px solid rgba(255 255 255 / 0.3);
  background: rgba(255 255 255 / 0.15);
  color: var(--color-white);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.status-btn:hover { transform: translateY(-2px); }

.status-btn--accepted { background: linear-gradient(135deg, #70b569, #2da324); border-color: rgba(255 255 255 / 0.8); box-shadow: 0 4px 12px rgba(0 0 0 / 0.2); }
.status-btn--pending  { background: linear-gradient(135deg, #fba403, #df8106); border-color: rgba(255 255 255 / 0.8); box-shadow: 0 4px 12px rgba(0 0 0 / 0.2); }
.status-btn--declined { background: linear-gradient(135deg, #ff9a9a, #f5576c); border-color: rgba(255 255 255 / 0.8); box-shadow: 0 4px 12px rgba(0 0 0 / 0.2); }

/* ---- Zusatzfelder ---- */
.additional-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: rgba(255 255 255 / 0.1);
  border-radius: var(--radius-md);
}

/* ---- Checkbox ---- */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-white);
  user-select: none;
}

.rsvp-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-success);
  flex-shrink: 0;
}

/* ---- Essensvorlieben ---- */
.food-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.food-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.food-person {
  font-size: var(--font-size-sm);
  white-space: nowrap;
  min-width: 64px;
  opacity: 0.85;
}

/* ---- Hint ---- */
.rsvp-hint {
  font-size: var(--font-size-sm);
  opacity: 0.8;
  max-width: none;
  margin: 0;
}

.rsvp-hint a { color: var(--color-white); }

/* ---- Submit / Secondary Button ---- */
.rsvp-btn {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
}

.rsvp-btn--primary {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: var(--color-white);
}

.rsvp-btn--secondary {
  background: rgba(255 255 255 / 0.2);
  color: var(--color-white);
  border: 1.5px solid rgba(255 255 255 / 0.35);
}

.rsvp-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.rsvp-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ---- Zusammenfassung ---- */
.rsvp-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.summary-row {
  display: flex;
  gap: var(--space-md);
  align-items: baseline;
  font-size: var(--font-size-sm);
}

.summary-label {
  font-weight: var(--font-weight-semibold);
  opacity: 0.75;
  width: 100px;
  flex-shrink: 0;
}

.status-badge {
  display: inline-block;
  padding: 2px var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.status-badge--accepted { background: rgba(45 163 36 / 0.5);  border: 1px solid rgba(112 181 105 / 0.8); }
.status-badge--pending  { background: rgba(251 164  3 / 0.5);  border: 1px solid rgba(251 164   3 / 0.8); }
.status-badge--declined { background: rgba(245  87 108 / 0.5); border: 1px solid rgba(245  87 108 / 0.8); }

.food-tag {
  display: inline-block;
  background: rgba(255 255 255 / 0.15);
  border-radius: var(--radius-sm);
  padding: 2px var(--space-xs);
  font-size: var(--font-size-xs);
  margin: 2px var(--space-xs) 2px 0;
}

.rsvp-updated {
  font-size: var(--font-size-xs);
  opacity: 0.65;
  font-style: italic;
  margin: 0;
  max-width: none;
}
</style>
