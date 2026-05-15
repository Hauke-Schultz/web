import { ref, computed } from 'vue'

const TOKEN_KEY    = 'hawk-star-token'
const REMEMBER_KEY = 'hawk-star-remember'
const API_BASE     = '/api/star'

// ── Singleton state ────────────────────────────────────────────────────────────
// Try localStorage first (remember-me), fall back to sessionStorage (session-only)
const _storedToken = typeof window !== 'undefined'
  ? (localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY))
  : null

const token        = ref(_storedToken)
const player       = ref(null)
const homePlanetId = ref(null)
const authError    = ref('')
const authLoading  = ref(false)
// Remember-me: defaults to true, persists preference
const rememberMe   = ref(typeof window !== 'undefined'
  ? localStorage.getItem(REMEMBER_KEY) !== 'false'
  : true
)

const isAuthenticated = computed(() => !!token.value)

// ── Internal helpers ───────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token.value) headers['Authorization'] = `Bearer ${token.value}`
  const res  = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Server error')
  return json.data
}

function applyAuth(data) {
  token.value        = data.token
  player.value       = data.player
  homePlanetId.value = data.homePlanetId ?? null
  localStorage.setItem(REMEMBER_KEY, rememberMe.value ? 'true' : 'false')
  if (rememberMe.value) {
    localStorage.setItem(TOKEN_KEY, data.token)
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, data.token)
    localStorage.removeItem(TOKEN_KEY)
  }
}

function clearAuth() {
  token.value        = null
  player.value       = null
  homePlanetId.value = null
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

// ── Public API ─────────────────────────────────────────────────────────────────

async function register(username, email, password) {
  authLoading.value = true
  authError.value   = ''
  try {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    })
    applyAuth(data)
    return data
  } catch (e) {
    authError.value = e.message
    return null
  } finally {
    authLoading.value = false
  }
}

async function login(email, password) {
  authLoading.value = true
  authError.value   = ''
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    applyAuth(data)
    return data
  } catch (e) {
    authError.value = e.message
    return null
  } finally {
    authLoading.value = false
  }
}

async function logout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
  clearAuth()
}

async function deleteAccount() {
  try { await apiFetch('/auth/delete', { method: 'POST' }) } catch { /* ignore */ }
  clearAuth()
}

// Verify existing token on app start — clears token if expired/invalid
async function verifyToken() {
  if (!token.value) return false
  try {
    const data = await apiFetch('/auth/me')
    player.value       = data.player
    homePlanetId.value = data.homePlanetId ?? null
    return true
  } catch {
    clearAuth()
    return false
  }
}

export function useHawkStarAuth() {
  return {
    token,
    player,
    homePlanetId,
    authError,
    authLoading,
    isAuthenticated,
    rememberMe,
    register,
    login,
    logout,
    deleteAccount,
    verifyToken,
  }
}
