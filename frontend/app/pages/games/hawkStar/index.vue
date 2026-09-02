<script setup>
import { ref, watchEffect, onMounted, onUnmounted } from 'vue'
import { startTick, stopTick, initFromApi, useHawkStar } from '~/composables/useHawkStar.js'
import { useHawkStarAuth } from '~/composables/useHawkStarAuth.js'
import HsResourceBar from '~/components/hawk-star/HsResourceBar.vue'
import HsPlanetGrid from '~/components/hawk-star/HsPlanetGrid.vue'
import HsTilePanel from '~/components/hawk-star/HsTilePanel.vue'
import HsNavBar from '~/components/hawk-star/HsNavBar.vue'
import HsGalaxyMap from '~/components/hawk-star/HsGalaxyMap.vue'
import HsSolarSystem from '~/components/hawk-star/HsSolarSystem.vue'
import HsEmpirePanel from '~/components/hawk-star/HsEmpirePanel.vue'

definePageMeta({ hideHeader: true, forceTheme: 'dark' })

const { locale, setLocale } = useI18n()
const { starMapLevel, gameLoaded, initError, initErrorDetail } = useHawkStar()
const { player, authError, authLoading, isAuthenticated, rememberMe, register, login, verifyToken, logout } = useHawkStarAuth()

// ── Error screen ───────────────────────────────────────────────────────────────
const copied = ref(false)

// The whole point is being able to paste it somewhere. A 500 with an empty body
// tells you nothing on its own — endpoint, status and timestamp together do.
async function copyErrorDetail() {
  const d = initErrorDetail.value
  const text = [
    initError.value,
    d && `endpoint: ${d.endpoint}`,
    d && `status:   ${d.status ?? 'no response'}`,
    d && `time:     ${d.at}`,
    d?.body && `body:\n${d.body}`,
  ].filter(Boolean).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* clipboard blocked — the text is on screen anyway */ }
}

// Retrying a 500 changes nothing. Logging out at least gets you off this screen
// and lets you in with another account.
async function logoutAndReset() {
  await logout()
  initError.value = ''
  initErrorDetail.value = null
}

// Where a session starts — always the empire board, for every commander. It is
// the one view that answers "where did I leave off", it is never gated, and the
// onboarding checklist lives there, so a brand-new single-planet player needs no
// landing of their own. Reassigned on every init and not only at ref creation:
// logging out and back in with another account must not keep the last view.
const LANDING_VIEW = 'empire'

const currentView = ref(LANDING_VIEW)
const activePanel = ref('')
const panelRef    = ref(null)

// ── Language ───────────────────────────────────────────────────────────────────
// The account decides, not the browser and not the URL: a commander who set DE
// on one device reads DE on the next, and a fresh profile reads EN whatever the
// browser asks for. Returns true when it actually switched — that is a route
// change (`prefix_except_default`), so this component is remounted on the other
// side of it and the caller must stop rather than init the game twice.
async function applyProfileLocale() {
  const wanted = player.value?.locale
  if (!wanted || wanted === locale.value) return false
  await setLocale(wanted)
  return true
}

// ── Auth modal state ───────────────────────────────────────────────────────────
const authMode    = ref('login')  // 'register' | 'login'
const authName    = ref('')
const authEmail   = ref('')
const authPass    = ref('')

function switchMode(mode) {
  authMode.value  = mode
  authError.value = ''
}

async function submitAuth() {
  let data = null
  if (authMode.value === 'register') {
    data = await register(authName.value.trim(), authEmail.value.trim(), authPass.value)
  } else {
    data = await login(authEmail.value.trim(), authPass.value)
  }
  if (data) {
    if (await applyProfileLocale()) return
    await initFromApi()
    activePanel.value = ''
    currentView.value = LANDING_VIEW
  }
}

// ── App init ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (isAuthenticated.value) {
    const ok = await verifyToken()
    if (ok) {
      if (await applyProfileLocale()) return
      await initFromApi()
      activePanel.value = ''
      currentView.value = LANDING_VIEW
    }
  }
  startTick()
})
onUnmounted(stopTick)

// Fall back if a view becomes locked again (e.g. game reset)
watchEffect(() => {
  if (currentView.value === 'solar-system' && starMapLevel.value < 1) {
    currentView.value = 'planet'
  }
  if (currentView.value === 'galaxy' && starMapLevel.value < 2) {
    currentView.value = starMapLevel.value >= 1 ? 'solar-system' : 'planet'
  }
})
</script>

<template>
  <div class="hs-page">
    <div class="hs-top-wrap">
      <div class="hs-top">
        <HsNavBar v-model:currentView="currentView" />
        <HsResourceBar />
      </div>
    </div>

    <!-- ── Loading / error state ── -->
    <div v-if="isAuthenticated && !gameLoaded" class="hs-init-state">
      <p v-if="initError" class="hs-init-error">{{ initError }}</p>
      <p v-else class="hs-init-loading">Loading galaxy data…</p>

      <!-- What actually broke. A 500 is a server problem no amount of retrying
           fixes, so the screen has to say so instead of offering Retry twice. -->
      <details v-if="initErrorDetail" class="hs-init-detail">
        <summary>Details</summary>
        <dl class="hs-init-detail-list">
          <dt>Endpoint</dt><dd>{{ initErrorDetail.endpoint }}</dd>
          <dt>Status</dt><dd>{{ initErrorDetail.status ?? 'no response' }}</dd>
          <dt>Zeit</dt><dd>{{ initErrorDetail.at }}</dd>
        </dl>
        <pre v-if="initErrorDetail.body" class="hs-init-detail-body">{{ initErrorDetail.body }}</pre>
        <p v-else class="hs-init-detail-hint">
          Leere Antwort — der Server ist abgestürzt (PHP-Fatal). Der Grund steht im Server-Log,
          nicht im Browser.
        </p>
        <button class="hs-init-copy" @click="copyErrorDetail">
          {{ copied ? '✓ Kopiert' : 'Fehler kopieren' }}
        </button>
      </details>

      <div class="hs-init-actions">
        <button class="hs-setup-btn hs-init-retry" @click="initFromApi()">
          {{ initError ? 'Retry' : 'Reload' }}
        </button>
        <!-- The way out when retrying cannot help: a broken session or an
             account whose data the server chokes on leaves you stuck here. -->
        <button v-if="initError" class="hs-setup-btn hs-init-logout" @click="logoutAndReset">
          Logout
        </button>
      </div>
    </div>

    <div class="hs-main" v-else-if="isAuthenticated && gameLoaded">
      <template v-if="currentView === 'planet'">
        <div class="hs-planet-wrap">
          <!-- One-way now: the grid closes whatever panel is open when you pick
               a tile or switch planet, and no longer opens one of its own. -->
          <HsPlanetGrid @update:activePanel="activePanel = $event ?? ''" />
        </div>
        <div ref="panelRef" class="hs-grid-right">
          <HsTilePanel :activePanel="activePanel" />
        </div>
      </template>
      <HsSolarSystem v-else-if="currentView === 'solar-system'" @go-planet="currentView = 'planet'; activePanel = ''" />
      <HsGalaxyMap v-else-if="currentView === 'galaxy'" />
      <!-- Every row on the board sets planet + tile itself, then asks the page
           to turn to the planet view — that jump is what makes it a board and
           not a list. Every one of them is a tile now; the crest no longer jumps
           anywhere, it unfolds the profile in the board's own header. -->
      <HsEmpirePanel
        v-else-if="currentView === 'empire'"
        @go-planet="currentView = 'planet'; activePanel = ''"
      />
    </div>

    <!-- ── Auth overlay ── -->
    <Teleport to="body">
      <div v-if="!isAuthenticated" class="hs-setup-backdrop">
        <div class="hs-setup-modal">
          <div class="hs-setup-logo">🪐</div>
          <h1 class="hs-setup-title">Hawk-Star</h1>

          <!-- Tabs -->
          <div class="hs-auth-tabs">
            <button
              class="hs-auth-tab"
              :class="{ 'hs-auth-tab--active': authMode === 'register' }"
              @click="switchMode('register')"
            >Register</button>
            <button
              class="hs-auth-tab"
              :class="{ 'hs-auth-tab--active': authMode === 'login' }"
              @click="switchMode('login')"
            >Login</button>
          </div>

          <!-- Register fields -->
          <template v-if="authMode === 'register'">
            <p class="hs-setup-label">Commander name</p>
            <input
              v-model="authName"
              class="hs-setup-input"
              type="text"
              placeholder="Username…"
              maxlength="64"
              autocomplete="username"
              @keydown.enter="submitAuth"
            />
            <p class="hs-setup-label">E-Mail</p>
            <input
              v-model="authEmail"
              class="hs-setup-input"
              type="email"
              placeholder="commander@galaxy.net"
              autocomplete="email"
              @keydown.enter="submitAuth"
            />
            <p class="hs-setup-label">Password</p>
            <input
              v-model="authPass"
              class="hs-setup-input"
              type="password"
              placeholder="Min. 6 characters"
              autocomplete="new-password"
              @keydown.enter="submitAuth"
            />
          </template>

          <!-- Login fields -->
          <template v-else>
            <p class="hs-setup-label">E-Mail</p>
            <input
              v-model="authEmail"
              class="hs-setup-input"
              type="email"
              placeholder="commander@galaxy.net"
              autocomplete="email"
              @keydown.enter="submitAuth"
            />
            <p class="hs-setup-label">Password</p>
            <input
              v-model="authPass"
              class="hs-setup-input"
              type="password"
              placeholder="Password"
              autocomplete="current-password"
              @keydown.enter="submitAuth"
            />
            <label class="hs-remember-row">
              <input v-model="rememberMe" type="checkbox" class="hs-remember-check" />
              <span>Remember me</span>
            </label>
          </template>

          <!-- Error -->
          <p v-if="authError" class="hs-auth-error">{{ authError }}</p>

          <button
            class="hs-setup-btn"
            :class="{ 'hs-setup-btn--disabled': authLoading }"
            :disabled="authLoading"
            @click="submitAuth"
          >
            <span v-if="authLoading">…</span>
            <span v-else-if="authMode === 'register'">Begin Colony</span>
            <span v-else>Enter Command</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss">
@use './hawk-star' as *;
</style>

<style lang="scss">
// ── Auth overlay (not scoped — uses Teleport to body) ─────────────────────────
.hs-setup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(5, 5, 20, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.hs-setup-modal {
  background: rgba(15, 20, 40, 0.95);
  border: 1px solid rgba(100, 130, 220, 0.25);
  border-radius: 1rem;
  padding: 2rem 1.75rem;
  width: 100%;
  max-width: 22rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 0 60px rgba(80, 120, 255, 0.12);
}

.hs-setup-logo  { font-size: 3rem; line-height: 1; }
.hs-setup-title { font-size: 1.5rem; font-weight: 800; letter-spacing: 0.08em; margin: 0; color: #fff; }
.hs-setup-sub   { font-size: 0.72rem; opacity: 0.4; margin: 0; text-align: center; }

.hs-setup-planet-card {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(100, 130, 220, 0.2);
  border-radius: 0.625rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.hs-auth-tabs {
  display: flex;
  width: 100%;
  gap: 0.25rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(100, 130, 220, 0.15);
  border-radius: 0.5rem;
  padding: 0.2rem;
}

.hs-auth-tab {
  flex: 1;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.4rem 0.5rem;
  border-radius: 0.35rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &--active {
    background: rgba(100, 130, 220, 0.2);
    color: #fff;
  }

  &:hover:not(&--active) {
    color: rgba(255,255,255,0.7);
  }
}

.hs-auth-error {
  font-size: 0.72rem;
  color: #f87171;
  margin: 0;
  align-self: flex-start;
  line-height: 1.4;
}

.hs-remember-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  cursor: pointer;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 0.1rem;
}

.hs-remember-check {
  accent-color: #4f6ef7;
  width: 0.85rem;
  height: 0.85rem;
  cursor: pointer;
}

.hs-setup-label {
  font-size: 0.7rem;
  opacity: 0.45;
  margin: 0.25rem 0 0;
  align-self: flex-start;
}

.hs-setup-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(100, 130, 220, 0.3);
  border-radius: 0.5rem;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.6rem 0.875rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &::placeholder { color: rgba(255,255,255,0.2); }
  &:focus { border-color: rgba(100, 130, 220, 0.7); }
}

.hs-setup-btn {
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.65rem 1rem;
  border-radius: 0.5rem;
  border: none;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, #4f6ef7, #7c3aed);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover:not(:disabled) { opacity: 0.9; }

  &--disabled, &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.hs-init-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 1rem;
  width: 100%;
}

.hs-init-loading {
  font-size: 0.85rem;
  opacity: 0.45;
  margin: 0;
  animation: hs-pulse 1.6s ease-in-out infinite;
}

.hs-init-error {
  font-size: 0.82rem;
  color: #f87171;
  margin: 0;
  text-align: center;
}

.hs-init-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.hs-init-retry {
  width: auto;
  padding: 0.5rem 1.5rem;
  font-size: 0.8rem;
}

// Deliberately quiet next to Retry: leaving is the fallback, not the suggestion.
.hs-init-logout {
  width: auto;
  padding: 0.5rem 1.25rem;
  font-size: 0.8rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.18);
  color: rgba(255,255,255,0.6);

  &:hover { color: #fff; border-color: rgba(255,255,255,0.35); }
}

// Collapsed by default — a stack trace is not what you want to look at first,
// but it is exactly what you need when you report the problem.
.hs-init-detail {
  width: 100%;
  max-width: 34rem;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  background: rgba(255,255,255,0.03);

  summary { cursor: pointer; opacity: 0.7; }
}

.hs-init-detail-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 0.75rem;
  margin: 0.5rem 0 0;

  dt { opacity: 0.45; }
  dd { margin: 0; font-family: ui-monospace, monospace; word-break: break-all; }
}

.hs-init-detail-body {
  margin: 0.5rem 0 0;
  padding: 0.5rem;
  max-height: 11rem;
  overflow: auto;
  font-size: 0.62rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0,0,0,0.35);
  border-radius: 4px;
  color: rgba(252,165,165,0.85);
}

.hs-init-detail-hint {
  margin: 0.5rem 0 0;
  line-height: 1.45;
  opacity: 0.6;
}

.hs-init-copy {
  margin-top: 0.5rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.65rem;
  border-radius: 4px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.7);
  cursor: pointer;

  &:hover { color: #fff; }
}

@keyframes hs-pulse {
  0%, 100% { opacity: 0.45; }
  50%       { opacity: 0.9;  }
}

.hs-planet-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;

  @media (min-width: 640px) {
    width: auto;
    flex-shrink: 0;
  }
}

.hs-grid-right {
  width: 100%;
}
</style>

<style lang="scss" scoped>
.hs-page {
  min-height: 100dvh;
  background: linear-gradient(to bottom, #0a0a1a, #0d1a2e);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0.75rem 8rem;
  color: #fff;
  user-select: none;

  @media (min-width: 640px) {
    padding: 0 1rem 8rem;
  }
}

.hs-top-wrap {
  z-index: 50;
  width: 100%;
  background: rgba(10, 10, 26, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid transparent;
  padding: 0.4rem 0;
  margin-bottom: .5rem;

  @media (min-width: 640px) {
    padding: 0.5rem 0;
  }
}

.hs-top {
  display: flex;
  gap: 0.375rem;
  width: 100%;
  max-width: 52rem;
  align-items: stretch;
  justify-content: center;
  margin: 0 auto;

  @media (min-width: 640px) {
    gap: 0.5rem;
  }
}

.hs-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 52rem;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: flex-start;
  }
}
</style>
