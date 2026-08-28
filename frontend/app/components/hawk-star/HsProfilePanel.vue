<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { useHawkStarAuth } from '~/composables/useHawkStarAuth.js'
import HsSettingsPanel from "~/components/hawk-star/HsSettingsPanel.vue";

// `locales` is the list from nuxt.config, so the dropdown can never offer a
// language the app has no messages for. `setLocale` navigates as well as it
// switches — the strategy is `prefix_except_default`, so DE lives under /de.
const { t, locale, locales, setLocale } = useI18n()
const { playerName, playerPortrait, playerDisposition, salvagePortraits } = useHawkStar()
const { logout, deleteAccount, saveProfile } = useHawkStarAuth()

const PORTRAITS = ['👨‍🚀','👽️','👾','🤖','🤠','🧠','💀','👻','🧜‍♂️','🧟','🧌','☠️','🥵','🥶','😈','🕷️','🦊','🦄','🌞','⚓️']

// Salvage artefacts add to the picker, they never replace part of it: the
// twenty above stay free, and an unlocked one comes last so a new avatar is
// exactly where you would look for it.
const portraits = computed(() => [...PORTRAITS, ...salvagePortraits.value])

const DISPOSITIONS = ['friendly', 'neutral', 'hostile']
const DISP_ICON = { friendly: '🤝', neutral: '⚖️', hostile: '⚔️' }

const showPicker    = ref(false)
const confirmDelete = ref(false)
const savedFlash    = ref(false)

let savedTimer = null
const flashSaved = () => {
  savedFlash.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedFlash.value = false }, 1500)
}

// The pick shows instantly and is put back if the server refuses it. Flashing
// "gespeichert" on a rejected save is what hid the unlocked-portrait bug for so
// long: the panel said saved, the reload said otherwise, and nothing in between
// ever mentioned a failure.
const selectPortrait = async (p) => {
  const prev = playerPortrait.value
  playerPortrait.value = p
  showPicker.value = false
  if (await saveProfile({ portrait: p })) flashSaved()
  else playerPortrait.value = prev
}

const selectDisposition = async (d) => {
  const prev = playerDisposition.value
  playerDisposition.value = d
  if (await saveProfile({ disposition: d })) flashSaved()
  else playerDisposition.value = prev
}

// Saved before switched, and only switched if the save went through: the
// switch is a route change that remounts this panel, so a rejected save would
// otherwise leave the app speaking a language the profile does not know about.
const selectLocale = async (code) => {
  if (!code || code === locale.value) return
  if (!await saveProfile({ locale: code })) return
  flashSaved()
  await setLocale(code)
}

const saveName = async () => {
  const name = playerName.value.trim()
  if (!name) return
  if (await saveProfile({ username: name })) flashSaved()
}

const handleDelete = async () => {
  if (!confirmDelete.value) { confirmDelete.value = true; return }
  await deleteAccount()
  confirmDelete.value = false
}
</script>

<template>
  <div class="hs-profile">

    <div class="hs-panel-header">
      <span class="hs-panel-icon">👤</span>
      <h2 class="hs-panel-title">{{ t('hawkStar.profile.title') }}</h2>
      <Transition name="hs-saved">
        <span v-if="savedFlash" class="hs-profile-saved">✓ gespeichert</span>
      </Transition>
    </div>

    <div class="hs-profile-body">
      <!-- Portrait -->
      <div class="hs-profile-portrait-wrap">
        <button class="hs-profile-portrait" @click="showPicker = !showPicker">
          {{ playerPortrait }}
        </button>
        <template v-if="showPicker">
          <div class="hs-profile-picker-backdrop" @click="showPicker = false" />
          <div class="hs-profile-picker">
            <button
              v-for="p in portraits"
              :key="p"
              class="hs-profile-picker-btn"
              :class="{ 'hs-profile-picker-btn--active': p === playerPortrait }"
              @click="selectPortrait(p)"
            >{{ p }}</button>
          </div>
        </template>
      </div>

      <!-- Name + Disposition -->
      <div class="hs-profile-info">
        <input
          v-model="playerName"
          class="hs-profile-name-input"
          type="text"
          maxlength="12"
          :placeholder="t('hawkStar.profile.name')"
          @blur="saveName"
        />
        <div class="hs-profile-disp-row">
          <button
            v-for="d in DISPOSITIONS"
            :key="d"
            class="hs-profile-disp-btn"
            :class="[`hs-profile-disp-btn--${d}`, { 'hs-profile-disp-btn--active': d === playerDisposition }]"
            @click="selectDisposition(d)"
          >{{ DISP_ICON[d] }} {{ t('hawkStar.profile.' + d) }}</button>
        </div>
      </div>
    </div>

    <!-- Account actions -->
    <div class="hs-profile-actions">
      <!-- The language belongs to the account, so it sits with the account -->
      <select
        class="hs-profile-lang"
        :value="locale"
        :title="t('hawkStar.profile.language')"
        :aria-label="t('hawkStar.profile.language')"
        @change="selectLocale($event.target.value)"
      >
        <option v-for="l in locales" :key="l.code" :value="l.code">
          🌐 {{ l.code.toUpperCase() }}
        </option>
      </select>
      <button class="hs-profile-btn hs-profile-btn--logout" @click="logout">
        ↩ Logout
      </button>
      <button
        class="hs-profile-btn hs-profile-btn--delete"
        :class="{ 'hs-profile-btn--confirm': confirmDelete }"
        @click="handleDelete"
        @blur="confirmDelete = false"
      >
        {{ confirmDelete ? '⚠ Wirklich löschen?' : '🗑 Profil löschen' }}
      </button>
    </div>

	  <HsSettingsPanel />
  </div>
</template>


<style lang="scss" scoped>
.hs-profile {
  flex: 1;
  min-width: 0;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  overflow: visible;
}

.hs-panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--hs-line-sm);
}

.hs-panel-icon  { font-size: 1.25rem; }
.hs-panel-title { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0; flex: 1; }

.hs-profile-saved {
  font-size: 0.55rem;
  font-weight: 600;
  color: rgba(52,211,153,0.85);
  letter-spacing: 0.03em;
}

.hs-profile-body {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
}

// ── Portrait ──────────────────────────────────────────────────────────────────
.hs-profile-portrait-wrap {
  flex-shrink: 0;
  position: relative;
}

.hs-profile-portrait {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  line-height: 1;

  &:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.25);
  }
}

.hs-profile-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.hs-profile-picker {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 100;
  background: #12122a;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: var(--hs-r-md);
  padding: 0.4rem;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  box-shadow: 0 6px 28px rgba(0,0,0,0.7);
}

.hs-profile-picker-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--hs-r-sm);
  cursor: pointer;
  font-size: 1.35rem;
  line-height: 1;
  padding: 0.3rem 0.2rem;
  text-align: center;
  transition: background 0.1s, transform 0.1s;

  &:hover { background: rgba(255,255,255,0.1); transform: scale(1.15); }
  &--active { border-color: rgba(100,130,220,0.5); background: rgba(100,130,220,0.12); }
}

// ── Name + disposition ────────────────────────────────────────────────────────
.hs-profile-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-profile-name-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(100,130,220,0.25);
  border-radius: var(--hs-r-sm);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.35rem 0.6rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &::placeholder { color: rgba(255,255,255,0.2); }
  &:focus { border-color: rgba(100,130,220,0.6); }
}

.hs-profile-disp-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.hs-profile-disp-btn {
  flex: 1;
  padding: 0.25rem 0.4rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.58rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.3);
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover { color: rgba(255,255,255,0.55); border-color: rgba(255,255,255,0.15); }

  &--friendly.hs-profile-disp-btn--active {
    background: rgba(52,211,153,0.12);
    border-color: rgba(52,211,153,0.4);
    color: #34d399;
  }
  &--neutral.hs-profile-disp-btn--active {
    background: rgba(148,163,184,0.12);
    border-color: rgba(148,163,184,0.4);
    color: #94a3b8;
  }
  &--hostile.hs-profile-disp-btn--active {
    background: rgba(248,113,113,0.12);
    border-color: rgba(248,113,113,0.4);
    color: #f87171;
  }
}

// ── Account actions ───────────────────────────────────────────────────────────
.hs-profile-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.6rem;
  border-top: 1px solid var(--hs-line-sm);
}

// Not `flex: 1` like the buttons beside it — a two-letter code needs no room
// to grow, and letting it stretch would make the language look like the main
// thing on a row whose other half deletes the account.
.hs-profile-lang {
  flex: none;
  padding: 0.3rem 0.4rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.5);
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.8); }

  // The dropdown itself is drawn by the OS and inherits nothing from the page,
  // so light-on-light is the default without this.
  option { background: #0f172a; color: rgba(255,255,255,0.8); }
}

.hs-profile-btn {
  flex: 1;
  padding: 0.3rem 0.5rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &--logout {
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.5);
    &:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.8); }
  }

  &--delete {
    border: 1px solid rgba(248,113,113,0.2);
    background: rgba(248,113,113,0.05);
    color: rgba(248,113,113,0.5);
    &:hover { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.4); color: #f87171; }
  }

  &--confirm {
    border-color: rgba(248,113,113,0.7) !important;
    background: rgba(248,113,113,0.15) !important;
    color: #f87171 !important;
    animation: hs-pulse-danger 0.6s ease;
  }
}

@keyframes hs-pulse-danger {
  0%, 100% { box-shadow: none; }
  50%       { box-shadow: 0 0 8px rgba(248,113,113,0.4); }
}

// ── Saved flash transition ────────────────────────────────────────────────────
.hs-saved-enter-active, .hs-saved-leave-active { transition: opacity 0.2s; }
.hs-saved-enter-from,   .hs-saved-leave-to     { opacity: 0; }
</style>
