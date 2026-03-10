<script setup>
definePageMeta({ hideNav: true })

const router = useRouter()

// Tab State
const activeTab = ref('rsvp')

// RSVP State
const rsvps = ref([])
const loading = ref(true)
const error = ref(null)
const searchQuery = ref('')
const statusFilter = ref('all')
const sortBy = ref('name')
const sortOrder = ref('asc')

// Edit Modal State
const showEditModal = ref(false)
const editingRSVP = ref(null)

// Highscore State
const highscores = ref([])
const highscoresLoading = ref(false)
const highscoresError = ref(null)
const highscoreSearchQuery = ref('')
const highscoreSortBy = ref('level')
const highscoreSortOrder = ref('desc')

// Highscore Edit Modal State
const showHighscoreEditModal = ref(false)
const editingHighscore = ref(null)

// Password Protection State
const isAuthenticated = ref(false)
const showPasswordModal = ref(true)
const passwordInput = ref('')
const passwordError = ref('')
const ADMIN_PASSWORD = 'ZombieBrain6'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '' : 'https://haukeschultz.com'
)

// ── RSVP Functions ────────────────────────────────────────

const loadAllRSVPs = async () => {
  try {
    loading.value = true
    error.value = null
    const rsvpEndpoint = import.meta.env.DEV ? '/api/rsvp' : '/api/rsvp.php'
    const response = await fetch(`${API_BASE_URL}${rsvpEndpoint}`)
    if (!response.ok) throw new Error('Failed to load RSVPs')
    const data = await response.json()
    rsvps.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading RSVPs:', err)
    error.value = 'Fehler beim Laden der RSVPs. Bitte versuche es später erneut.'
    rsvps.value = []
  } finally {
    loading.value = false
  }
}

const filteredRSVPs = computed(() => {
  let filtered = rsvps.value
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(rsvp => rsvp.status === statusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(rsvp => rsvp.name.toLowerCase().includes(query))
  }
  filtered = [...filtered].sort((a, b) => {
    let aVal, bVal
    switch (sortBy.value) {
      case 'name':   aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break
      case 'date':   aVal = new Date(a.lastUpdated || 0); bVal = new Date(b.lastUpdated || 0); break
      case 'status': aVal = a.status; bVal = b.status; break
      case 'guests': aVal = a.numberOfGuests || 0; bVal = b.numberOfGuests || 0; break
      default: return 0
    }
    if (sortOrder.value === 'asc') return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    else return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
  })
  return filtered
})

const statistics = computed(() => {
  const total = rsvps.value.length
  const accepted = rsvps.value.filter(r => r.status === 'accepted').length
  const declined = rsvps.value.filter(r => r.status === 'declined').length
  const pending = rsvps.value.filter(r => r.status === 'pending').length
  const acceptedRSVPs = rsvps.value.filter(r => r.status === 'accepted')
  const totalGuests = acceptedRSVPs.reduce((sum, r) => sum + (r.numberOfGuests || 1), 0)
  const carsCount = acceptedRSVPs.filter(r => r.comingByCar).length
  const parkingCount = acceptedRSVPs.filter(r => r.needsParking).length
  const hotelCount = acceptedRSVPs.filter(r => r.needsHotelRoom).reduce((sum, r) => sum + (r.numberOfRooms || 1), 0)
  let foodStandard = 0, foodVegetarian = 0, foodVegan = 0, foodAllergies = 0
  acceptedRSVPs.forEach(r => {
    const prefs = Array.isArray(r.foodPreferences) ? r.foodPreferences : (r.foodPreference ? [r.foodPreference] : [])
    prefs.forEach(pref => {
      if (pref === 'standard') foodStandard++
      else if (pref === 'vegetarisch') foodVegetarian++
      else if (pref === 'vegan') foodVegan++
      else if (pref === 'allergien') foodAllergies++
      else foodStandard++
    })
  })
  return { total, accepted, declined, pending, totalGuests, carsCount, parkingCount, hotelCount, foodStandard, foodVegetarian, foodVegan, foodAllergies }
})

const modalTitle = computed(() => {
  if (!editingRSVP.value) return 'RSVP bearbeiten'
  return editingRSVP.value.lastUpdated ? 'RSVP bearbeiten' : 'Neuen Gast hinzufügen'
})

const getStatusClass = (status) => {
  switch (status) {
    case 'accepted': return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
    case 'declined': return 'bg-gradient-to-r from-red-500 to-red-600 text-white'
    case 'pending':  return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
    default: return ''
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'accepted': return 'Zugesagt'
    case 'declined': return 'Abgesagt'
    case 'pending':  return 'Ausstehend'
    default: return status
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Nie'
  try {
    return new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return 'Ungültig' }
}

const changeSort = (field) => {
  if (sortBy.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else { sortBy.value = field; sortOrder.value = 'asc' }
}

const exportToCSV = () => {
  if (rsvps.value.length === 0) return
  const headers = ['Name', 'Status', 'Anzahl Personen', 'Mit Auto', 'Parkplatz benötigt', 'Hotelzimmer benötigt', 'Essensvorlieben', 'Bemerkungen', 'Letzte Aktualisierung']
  const rows = rsvps.value.map(rsvp => {
    const prefs = Array.isArray(rsvp.foodPreferences) ? rsvp.foodPreferences : (rsvp.foodPreference ? [rsvp.foodPreference] : [])
    return [
      rsvp.name, getStatusText(rsvp.status), rsvp.numberOfGuests || 1,
      rsvp.comingByCar ? 'Ja' : 'Nein', rsvp.needsParking ? 'Ja' : 'Nein',
      rsvp.needsHotelRoom ? 'Ja' : 'Nein', prefs.filter(p => p).join(' | '),
      (rsvp.remarks || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(),
      formatDate(rsvp.lastUpdated)
    ]
  })
  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.setAttribute('href', URL.createObjectURL(blob))
  link.setAttribute('download', `party-rsvp-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
})

const addNewGuest = () => {
  editingRSVP.value = { guestId: generateUUID(), name: '', status: 'pending', numberOfGuests: 1, comingByCar: false, needsParking: false, needsHotelRoom: false, numberOfRooms: 1, foodPreferences: [''], remarks: '' }
  showEditModal.value = true
}

const editRSVP = (rsvp) => {
  let foodPreferences
  if (Array.isArray(rsvp.foodPreferences)) foodPreferences = [...rsvp.foodPreferences]
  else if (rsvp.foodPreference) foodPreferences = [rsvp.foodPreference]
  else foodPreferences = ['']
  const numberOfGuests = rsvp.numberOfGuests || 1
  while (foodPreferences.length < numberOfGuests) foodPreferences.push('')
  if (foodPreferences.length > numberOfGuests) foodPreferences = foodPreferences.slice(0, numberOfGuests)
  editingRSVP.value = { ...rsvp, numberOfRooms: rsvp.numberOfRooms || 1, foodPreferences }
  showEditModal.value = true
}

const saveEdit = async () => {
  if (!editingRSVP.value) return
  try {
    const rsvpEndpoint = import.meta.env.DEV ? '/api/rsvp' : '/api/rsvp.php'
    const response = await fetch(`${API_BASE_URL}${rsvpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingRSVP.value)
    })
    if (!response.ok) throw new Error('Failed to save RSVP')
    await loadAllRSVPs()
    showEditModal.value = false
    editingRSVP.value = null
  } catch (err) {
    console.error('Error saving RSVP:', err)
  }
}

const cancelEdit = () => { showEditModal.value = false; editingRSVP.value = null }

const copyGuestLink = async (rsvp) => {
  const link = `${window.location.origin}/party?guestId=${rsvp.guestId}`
  try {
    await navigator.clipboard.writeText(link)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = link
    textarea.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(textarea)
    textarea.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(textarea)
  }
}

const deleteRSVP = async (rsvp) => {
  if (!confirm(`Möchtest du das RSVP von "${rsvp.name}" wirklich löschen?`)) return
  try {
    const rsvpEndpoint = import.meta.env.DEV ? '/api/rsvp' : '/api/rsvp.php'
    const response = await fetch(`${API_BASE_URL}${rsvpEndpoint}?guestId=${rsvp.guestId}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete RSVP')
    await loadAllRSVPs()
  } catch (err) {
    console.error('Error deleting RSVP:', err)
  }
}

// ── Auth Functions ────────────────────────────────────────

const checkPassword = () => {
  if (passwordInput.value === ADMIN_PASSWORD) {
    isAuthenticated.value = true
    showPasswordModal.value = false
    passwordError.value = ''
    sessionStorage.setItem('partyAdminAuth', 'true')
    loadAllRSVPs()
    loadAllHighscores()
  } else {
    passwordError.value = 'Falsches Passwort. Bitte versuche es erneut.'
    passwordInput.value = ''
  }
}

const logout = () => {
  isAuthenticated.value = false
  showPasswordModal.value = true
  passwordInput.value = ''
  passwordError.value = ''
  sessionStorage.removeItem('partyAdminAuth')
  rsvps.value = []
  highscores.value = []
}

const goBackToParty = () => router.push('/party')

// ── Highscore Functions ───────────────────────────────────

const loadAllHighscores = async () => {
  try {
    highscoresLoading.value = true
    highscoresError.value = null
    const highscoreEndpoint = import.meta.env.DEV ? '/api/highscores' : '/api/highscores.php'
    const response = await fetch(`${API_BASE_URL}${highscoreEndpoint}`)
    if (!response.ok) throw new Error('Failed to load highscores')
    const data = await response.json()
    highscores.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error loading highscores:', err)
    highscoresError.value = 'Fehler beim Laden der Highscores. Bitte versuche es später erneut.'
    highscores.value = []
  } finally {
    highscoresLoading.value = false
  }
}

const filteredHighscores = computed(() => {
  let filtered = highscores.value
  if (highscoreSearchQuery.value.trim()) {
    const query = highscoreSearchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(score => score.name.toLowerCase().includes(query))
  }
  filtered = [...filtered].sort((a, b) => {
    let aVal, bVal
    switch (highscoreSortBy.value) {
      case 'name':  aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break
      case 'level': aVal = a.level || 0; bVal = b.level || 0; break
      case 'date':  aVal = new Date(a.date || 0); bVal = new Date(b.date || 0); break
      default: return 0
    }
    if (highscoreSortOrder.value === 'asc') return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    else return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
  })
  return filtered
})

const changeHighscoreSort = (field) => {
  if (highscoreSortBy.value === field) highscoreSortOrder.value = highscoreSortOrder.value === 'asc' ? 'desc' : 'asc'
  else { highscoreSortBy.value = field; highscoreSortOrder.value = field === 'level' ? 'desc' : 'asc' }
}

const getHighscoreStatusClass = (status) => {
  switch (status) {
    case 'normal':        return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
    case 'underReview':   return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
    case 'disqualified':  return 'bg-gradient-to-r from-red-500 to-red-600 text-white'
    default: return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
  }
}

const getHighscoreStatusText = (status) => {
  switch (status) {
    case 'normal':        return 'Normal'
    case 'underReview':   return 'In Klärung'
    case 'disqualified':  return 'Disqualifiziert'
    default: return 'Normal'
  }
}

const editHighscore = (highscore) => {
  editingHighscore.value = { ...highscore, status: highscore.status || 'normal' }
  showHighscoreEditModal.value = true
}

const saveHighscoreEdit = async () => {
  if (!editingHighscore.value) return
  try {
    const highscoreEndpoint = import.meta.env.DEV
      ? `/api/highscores/${editingHighscore.value.playerId}`
      : '/api/highscores.php'
    const response = await fetch(`${API_BASE_URL}${highscoreEndpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingHighscore.value)
    })
    if (!response.ok) throw new Error('Failed to update highscore')
    await loadAllHighscores()
    showHighscoreEditModal.value = false
    editingHighscore.value = null
  } catch (err) {
    console.error('Error updating highscore:', err)
    alert('Fehler beim Aktualisieren des Highscores')
  }
}

const cancelHighscoreEdit = () => { showHighscoreEditModal.value = false; editingHighscore.value = null }

const deleteHighscore = async (highscore) => {
  if (!confirm(`Möchtest du den Highscore von "${highscore.name}" (Level ${highscore.level}) wirklich löschen?`)) return
  try {
    const highscoreEndpoint = import.meta.env.DEV
      ? `/api/highscores/${highscore.playerId}`
      : `/api/highscores.php?playerId=${highscore.playerId}`
    const response = await fetch(`${API_BASE_URL}${highscoreEndpoint}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete highscore')
    await loadAllHighscores()
  } catch (err) {
    console.error('Error deleting highscore:', err)
    alert('Fehler beim Löschen des Highscores')
  }
}

// ── Watch ─────────────────────────────────────────────────

watch(
  () => editingRSVP.value?.numberOfGuests,
  (newValue) => {
    if (!editingRSVP.value?.foodPreferences) return
    const target = newValue || 1
    const current = editingRSVP.value.foodPreferences.length
    if (target > current) for (let i = current; i < target; i++) editingRSVP.value.foodPreferences.push('')
    else if (target < current) editingRSVP.value.foodPreferences = editingRSVP.value.foodPreferences.slice(0, target)
  }
)

onMounted(() => {
  if (sessionStorage.getItem('partyAdminAuth') === 'true') {
    isAuthenticated.value = true
    showPasswordModal.value = false
    loadAllRSVPs()
    loadAllHighscores()
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-6">

    <!-- Password Modal -->
    <div v-if="showPasswordModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div class="bg-gradient-to-br from-blue-900 to-indigo-900 border-2 border-white/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center" @click.stop>
        <h2 class="text-2xl font-bold mb-2">🔒 Admin Bereich</h2>
        <p class="text-white/80 mb-6">Bitte gib das Admin-Passwort ein:</p>
        <form @submit.prevent="checkPassword" class="flex flex-col gap-4">
          <input
            v-model="passwordInput"
            type="password"
            placeholder="Passwort eingeben..."
            autofocus
            class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white placeholder-white/50 focus:outline-none focus:border-white/70 focus:bg-white/20 transition"
          />
          <p v-if="passwordError" class="text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm">{{ passwordError }}</p>
          <div class="flex gap-3">
            <button type="button" @click="goBackToParty" class="flex-1 px-4 py-3 rounded-xl border-2 border-white/30 bg-white/10 hover:bg-white/20 font-bold transition">
              Abbrechen
            </button>
            <button type="submit" class="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 font-bold transition">
              Anmelden
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Main Content -->
    <template v-if="isAuthenticated">

      <!-- Header -->
      <header class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 class="text-3xl font-bold">Party Verwaltung</h1>
        <div class="flex items-center gap-3">
          <!-- Tabs -->
          <div class="flex gap-2 bg-white/10 border-2 border-white/20 rounded-2xl p-2">
            <button
              class="px-4 py-2 rounded-xl border-2 font-bold text-sm transition"
              :class="activeTab === 'rsvp'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 border-white/50'
                : 'border-white/30 bg-white/10 hover:bg-white/20'"
              @click="activeTab = 'rsvp'"
            >
              📋 Gästeliste ({{ rsvps.length }})
            </button>
            <button
              class="px-4 py-2 rounded-xl border-2 font-bold text-sm transition"
              :class="activeTab === 'highscores'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 border-white/50'
                : 'border-white/30 bg-white/10 hover:bg-white/20'"
              @click="activeTab = 'highscores'"
            >
              🏆 Highscores ({{ highscores.length }})
            </button>
          </div>
          <button @click="logout" class="px-4 py-2 rounded-xl border-2 border-white/30 bg-white/10 hover:bg-white/20 font-bold text-sm transition">
            Logout
          </button>
        </div>
      </header>

      <!-- ── RSVP Tab ──────────────────────────────────── -->
      <div v-if="activeTab === 'rsvp'" class="flex flex-col gap-4">

        <!-- Actions -->
        <div class="flex gap-3">
          <button @click="addNewGuest" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 font-bold transition hover:-translate-y-0.5">
            ➕ Gast hinzufügen
          </button>
          <button @click="loadAllRSVPs" :disabled="loading" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 font-bold transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
            🔄 Aktualisieren
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <div class="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p>Lade Liste...</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <p>{{ error }}</p>
          <button @click="loadAllRSVPs" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-bold transition">Erneut versuchen</button>
        </div>

        <template v-else>

          <!-- Statistics -->
          <section class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <div class="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40">
              <span class="text-xl">👥</span>
              <div class="flex flex-col items-center w-full">
                <span class="text-xs uppercase tracking-wide opacity-80">Gäste</span>
                <span class="text-2xl font-bold">{{ statistics.totalGuests }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40">
              <span class="text-xl">✅</span>
              <div class="flex flex-col items-center w-full">
                <span class="text-xs uppercase tracking-wide opacity-80">Zugesagt</span>
                <span class="text-2xl font-bold">{{ statistics.accepted }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40">
              <span class="text-xl">❌</span>
              <div class="flex flex-col items-center w-full">
                <span class="text-xs uppercase tracking-wide opacity-80">Abgesagt</span>
                <span class="text-2xl font-bold">{{ statistics.declined }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40">
              <span class="text-xl">⏳</span>
              <div class="flex flex-col items-center w-full">
                <span class="text-xs uppercase tracking-wide opacity-80">Ausstehend</span>
                <span class="text-2xl font-bold">{{ statistics.pending }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40">
              <span class="text-xl">🚗</span>
              <div class="flex flex-col items-center w-full">
                <span class="text-xs uppercase tracking-wide opacity-80">Autos</span>
                <span class="text-2xl font-bold">{{ statistics.carsCount }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40">
              <span class="text-xl">🅿️</span>
              <div class="flex flex-col items-center w-full">
                <span class="text-xs uppercase tracking-wide opacity-80">Parkplätze</span>
                <span class="text-2xl font-bold">{{ statistics.parkingCount }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40">
              <span class="text-xl">🛏️</span>
              <div class="flex flex-col items-center w-full">
                <span class="text-xs uppercase tracking-wide opacity-80">Zimmer</span>
                <span class="text-2xl font-bold">{{ statistics.hotelCount }}</span>
              </div>
            </div>
            <div class="flex items-center gap-3 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-xl hover:border-white/40 min-w-[180px]">
              <span class="text-xl">🍽️</span>
              <div class="flex flex-col gap-0.5 text-sm opacity-90">
                <span>Standard: <strong>{{ statistics.foodStandard }}</strong></span>
                <span>Vegetarisch: <strong>{{ statistics.foodVegetarian }}</strong></span>
                <span>Vegan: <strong>{{ statistics.foodVegan }}</strong></span>
                <span>Allergien: <strong>{{ statistics.foodAllergies }}</strong></span>
              </div>
            </div>
          </section>

          <!-- Filters -->
          <section class="flex flex-wrap items-end gap-3 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-4">
            <div class="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label class="text-xs uppercase tracking-wide opacity-80 font-medium">Suche</label>
              <input v-model="searchQuery" type="text" placeholder="Name suchen..." class="px-4 py-2.5 rounded-xl border-2 border-white/30 bg-white/15 text-white placeholder-white/50 focus:outline-none focus:border-white/70 focus:bg-white/20 transition" />
            </div>
            <div class="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label class="text-xs uppercase tracking-wide opacity-80 font-medium">Status</label>
              <select v-model="statusFilter" class="px-4 py-2.5 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition [&>option]:bg-blue-900">
                <option value="all">Alle</option>
                <option value="accepted">Zugesagt</option>
                <option value="declined">Abgesagt</option>
                <option value="pending">Ausstehend</option>
              </select>
            </div>
            <button @click="exportToCSV" class="self-end px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 font-bold transition hover:-translate-y-0.5">
              📥 CSV Export
            </button>
          </section>

          <!-- Table -->
          <section class="bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl overflow-x-auto">
            <div v-if="filteredRSVPs.length === 0" class="text-center py-16 opacity-70">Keine Einträge gefunden</div>
            <table v-else class="w-full border-collapse">
              <thead class="bg-white/10">
                <tr>
                  <th @click="changeSort('name')" class="px-3 py-2.5 text-left text-xs uppercase tracking-wide font-bold border-b-2 border-white/30 cursor-pointer select-none hover:bg-white/15 transition">
                    Name <span v-if="sortBy === 'name'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th @click="changeSort('status')" class="px-3 py-2.5 text-left text-xs uppercase tracking-wide font-bold border-b-2 border-white/30 cursor-pointer select-none hover:bg-white/15 transition">
                    Status <span v-if="sortBy === 'status'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th @click="changeSort('guests')" class="px-3 py-2.5 text-center text-xs uppercase tracking-wide font-bold border-b-2 border-white/30 cursor-pointer select-none hover:bg-white/15 transition" title="Anzahl Personen">
                    👥 <span v-if="sortBy === 'guests'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30" title="Mit Auto">🚗</th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30" title="Parkplatz">🅿️</th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30" title="Hotelzimmer">🏨</th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30" title="Anzahl Zimmer">🛏️</th>
                  <th class="px-3 py-2.5 text-left text-xs font-bold border-b-2 border-white/30" title="Essen">🍽️</th>
                  <th class="px-3 py-2.5 text-left text-xs font-bold border-b-2 border-white/30" title="Bemerkungen">💬</th>
                  <th @click="changeSort('date')" class="px-3 py-2.5 text-left text-xs uppercase tracking-wide font-bold border-b-2 border-white/30 cursor-pointer select-none hover:bg-white/15 transition" title="Letzte Aktualisierung">
                    🕐 <span v-if="sortBy === 'date'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30">⚙️</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rsvp in filteredRSVPs" :key="rsvp.guestId" class="border-b border-white/10 hover:bg-white/5 transition">
                  <td class="px-3 py-2 font-medium min-w-[140px] w-[18%]">{{ rsvp.name }}</td>
                  <td class="px-3 py-2">
                    <span class="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide" :class="getStatusClass(rsvp.status)">
                      {{ getStatusText(rsvp.status) }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-center whitespace-nowrap">{{ rsvp.numberOfGuests || 1 }}</td>
                  <td class="px-3 py-2 text-center">{{ rsvp.comingByCar ? '✅' : '—' }}</td>
                  <td class="px-3 py-2 text-center">{{ rsvp.needsParking ? '✅' : '—' }}</td>
                  <td class="px-3 py-2 text-center">{{ rsvp.needsHotelRoom ? '✅' : '—' }}</td>
                  <td class="px-3 py-2 text-center">{{ rsvp.needsHotelRoom ? (rsvp.numberOfRooms || 1) : '—' }}</td>
                  <td class="px-3 py-2 text-xs leading-snug min-w-[120px]">
                    <template v-if="Array.isArray(rsvp.foodPreferences) && rsvp.foodPreferences.some(p => p)">
                      <div v-for="(pref, i) in rsvp.foodPreferences" :key="i" class="mb-0.5 last:mb-0">
                        <span v-if="pref">{{ i + 1 }}. {{ pref }}</span>
                      </div>
                    </template>
                    <template v-else-if="rsvp.foodPreference">{{ rsvp.foodPreference }}</template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-3 py-2 text-xs leading-snug min-w-[180px] w-[22%] whitespace-pre-wrap break-words">{{ rsvp.remarks || '—' }}</td>
                  <td class="px-3 py-2 text-xs opacity-80 whitespace-nowrap">{{ formatDate(rsvp.lastUpdated) }}</td>
                  <td class="px-3 py-2 text-center whitespace-nowrap">
                    <button @click="copyGuestLink(rsvp)" title="Link kopieren" class="mx-0.5 p-1 rounded-md bg-white/15 hover:bg-emerald-500/30 hover:scale-110 transition text-lg">🔗</button>
                    <button @click="editRSVP(rsvp)" title="Bearbeiten" class="mx-0.5 p-1 rounded-md bg-white/15 hover:bg-indigo-500/30 hover:scale-110 transition text-lg">✏️</button>
                    <button @click="deleteRSVP(rsvp)" title="Löschen" class="mx-0.5 p-1 rounded-md bg-white/15 hover:bg-red-500/30 hover:scale-110 transition text-lg">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <footer class="text-center text-sm opacity-70 py-2">
            Zeige {{ filteredRSVPs.length }} von {{ rsvps.length }} Einträge
          </footer>

        </template>
      </div>

      <!-- ── Highscores Tab ─────────────────────────────── -->
      <div v-if="activeTab === 'highscores'" class="flex flex-col gap-4">

        <!-- Actions -->
        <div class="flex gap-3">
          <button @click="loadAllHighscores" :disabled="highscoresLoading" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 font-bold transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
            🔄 Aktualisieren
          </button>
        </div>

        <!-- Loading -->
        <div v-if="highscoresLoading" class="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <div class="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p>Lade Highscores...</p>
        </div>

        <!-- Error -->
        <div v-else-if="highscoresError" class="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <p>{{ highscoresError }}</p>
          <button @click="loadAllHighscores" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-bold transition">Erneut versuchen</button>
        </div>

        <template v-else>

          <!-- Search -->
          <section class="flex flex-wrap items-end gap-3 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-4">
            <div class="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label class="text-xs uppercase tracking-wide opacity-80 font-medium">Suche</label>
              <input v-model="highscoreSearchQuery" type="text" placeholder="Name suchen..." class="px-4 py-2.5 rounded-xl border-2 border-white/30 bg-white/15 text-white placeholder-white/50 focus:outline-none focus:border-white/70 transition" />
            </div>
          </section>

          <!-- Table -->
          <section class="bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl overflow-x-auto">
            <div v-if="filteredHighscores.length === 0" class="text-center py-16 opacity-70">Keine Highscores gefunden</div>
            <table v-else class="w-full border-collapse">
              <thead class="bg-white/10">
                <tr>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30" title="Rang">🏅</th>
                  <th @click="changeHighscoreSort('name')" class="px-3 py-2.5 text-left text-xs uppercase tracking-wide font-bold border-b-2 border-white/30 cursor-pointer select-none hover:bg-white/15 transition">
                    Name <span v-if="highscoreSortBy === 'name'">{{ highscoreSortOrder === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th @click="changeHighscoreSort('level')" class="px-3 py-2.5 text-left text-xs uppercase tracking-wide font-bold border-b-2 border-white/30 cursor-pointer select-none hover:bg-white/15 transition">
                    Level <span v-if="highscoreSortBy === 'level'">{{ highscoreSortOrder === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30" title="Emoji">🏷️</th>
                  <th @click="changeHighscoreSort('date')" class="px-3 py-2.5 text-left text-xs uppercase tracking-wide font-bold border-b-2 border-white/30 cursor-pointer select-none hover:bg-white/15 transition">
                    Datum <span v-if="highscoreSortBy === 'date'">{{ highscoreSortOrder === 'asc' ? '↑' : '↓' }}</span>
                  </th>
                  <th class="px-3 py-2.5 text-left text-xs font-bold border-b-2 border-white/30" title="Status">🚩</th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold border-b-2 border-white/30">⚙️</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="score in filteredHighscores" :key="score.playerId" class="border-b border-white/10 hover:bg-white/5 transition">
                  <td class="px-3 py-2 text-center font-bold text-lg">{{ score.rank }}</td>
                  <td class="px-3 py-2 font-medium">{{ score.name }}</td>
                  <td class="px-3 py-2 text-center font-bold text-lg text-yellow-300">{{ score.level }}</td>
                  <td class="px-3 py-2 text-center text-xl">{{ score.emoji || '—' }}</td>
                  <td class="px-3 py-2 text-sm opacity-80 whitespace-nowrap">{{ score.date }}</td>
                  <td class="px-3 py-2">
                    <span class="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide" :class="getHighscoreStatusClass(score.status || 'normal')">
                      {{ getHighscoreStatusText(score.status || 'normal') }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-center whitespace-nowrap">
                    <button @click="editHighscore(score)" title="Bearbeiten" class="mx-0.5 p-1 rounded-md bg-white/15 hover:bg-indigo-500/30 hover:scale-110 transition text-lg">✏️</button>
                    <button @click="deleteHighscore(score)" title="Löschen" class="mx-0.5 p-1 rounded-md bg-white/15 hover:bg-red-500/30 hover:scale-110 transition text-lg">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <footer class="text-center text-sm opacity-70 py-2">
            Zeige {{ filteredHighscores.length }} von {{ highscores.length }} Einträge
          </footer>

        </template>
      </div>

      <!-- ── RSVP Edit Modal ────────────────────────────── -->
      <div v-if="showEditModal && editingRSVP" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" @click="cancelEdit">
        <div class="bg-gradient-to-br from-blue-900 to-indigo-900 border-2 border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
          <h2 class="text-2xl font-bold mb-6">{{ modalTitle }}</h2>

          <div class="flex flex-col gap-4">
            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Name</label>
              <input v-model="editingRSVP.name" type="text" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 focus:bg-white/20 transition" />
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Status</label>
              <select v-model="editingRSVP.status" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition [&>option]:bg-blue-900">
                <option value="pending">Ausstehend</option>
                <option value="accepted">Zugesagt</option>
                <option value="declined">Abgesagt</option>
              </select>
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Anzahl Personen</label>
              <input v-model.number="editingRSVP.numberOfGuests" type="number" min="1" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition" />
            </div>

            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="editingRSVP.comingByCar" type="checkbox" class="w-4 h-4 accent-indigo-400" />
                <span class="text-sm font-medium">Mit Auto</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="editingRSVP.needsParking" type="checkbox" class="w-4 h-4 accent-indigo-400" />
                <span class="text-sm font-medium">Parkplatz benötigt</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="editingRSVP.needsHotelRoom" type="checkbox" class="w-4 h-4 accent-indigo-400" />
                <span class="text-sm font-medium">Hotelzimmer benötigt</span>
              </label>
            </div>

            <div v-if="editingRSVP.needsHotelRoom">
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Anzahl Zimmer</label>
              <input v-model.number="editingRSVP.numberOfRooms" type="number" min="1" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition" />
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Essensvorlieben</label>
              <div class="flex flex-col gap-2">
                <div v-for="(pref, index) in editingRSVP.foodPreferences" :key="index" class="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span class="text-sm text-white/90 min-w-[80px]">Person {{ index + 1 }}:</span>
                  <select :id="`modal-food-${index}`" v-model="editingRSVP.foodPreferences[index]" class="flex-1 px-3 py-2 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition [&>option]:bg-blue-900">
                    <option value="">Bitte auswählen...</option>
                    <option value="standard">Ich esse alles</option>
                    <option value="vegetarisch">Ich esse vegetarisch</option>
                    <option value="vegan">Ich esse vegan</option>
                    <option value="allergien">Ich habe Allergien oder Unverträglichkeiten</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Bemerkungen</label>
              <textarea v-model="editingRSVP.remarks" rows="3" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition resize-y font-sans"></textarea>
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button @click="cancelEdit" class="flex-1 px-4 py-3 rounded-xl border-2 border-white/30 bg-white/10 hover:bg-white/20 font-bold transition">Abbrechen</button>
            <button @click="saveEdit" class="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 font-bold transition">Speichern</button>
          </div>
        </div>
      </div>

      <!-- ── Highscore Edit Modal ───────────────────────── -->
      <div v-if="showHighscoreEditModal && editingHighscore" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-4" @click="cancelHighscoreEdit">
        <div class="bg-gradient-to-br from-blue-900 to-indigo-900 border-2 border-white/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
          <h2 class="text-2xl font-bold mb-6">Highscore bearbeiten</h2>

          <div class="flex flex-col gap-4">
            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Name</label>
              <input v-model="editingHighscore.name" type="text" maxlength="20" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition" />
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Level</label>
              <input v-model.number="editingHighscore.level" type="number" min="0" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition" />
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Emoji (optional)</label>
              <input v-model="editingHighscore.emoji" type="text" placeholder="z.B. 🚩⭐🎉" maxlength="10" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white placeholder-white/50 focus:outline-none focus:border-white/70 transition" />
              <p class="text-xs opacity-60 mt-1">Wird nach dem Level in der öffentlichen Highscore-Liste angezeigt</p>
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Datum</label>
              <input v-model="editingHighscore.date" type="date" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition" />
            </div>

            <div>
              <label class="block text-xs uppercase tracking-wide opacity-90 font-medium mb-1.5">Status</label>
              <select v-model="editingHighscore.status" class="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/15 text-white focus:outline-none focus:border-white/70 transition [&>option]:bg-blue-900">
                <option value="normal">Normal</option>
                <option value="underReview">In Klärung</option>
                <option value="disqualified">Disqualifiziert</option>
              </select>
              <p class="text-xs opacity-60 mt-1">Markierte Einträge werden in der öffentlichen Highscore-Liste ausgegraut und unterhalb angezeigt</p>
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button @click="cancelHighscoreEdit" class="flex-1 px-4 py-3 rounded-xl border-2 border-white/30 bg-white/10 hover:bg-white/20 font-bold transition">Abbrechen</button>
            <button @click="saveHighscoreEdit" class="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 font-bold transition">Speichern</button>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>
