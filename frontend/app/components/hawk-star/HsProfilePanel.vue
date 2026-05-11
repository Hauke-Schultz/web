<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const { playerName, playerPortrait, playerDisposition } = useHawkStar()

const PORTRAITS = ['👨‍🚀', '👩‍🚀', '🧑‍🚀', '🤖', '👾', '🧠', '💀', '🦾', '⭐', '🪐', '🔭', '⚡']
const DISPOSITIONS = ['friendly', 'neutral', 'hostile']
const DISP_ICON = { friendly: '🤝', neutral: '⚖️', hostile: '⚔️' }

const showPicker = ref(false)

const selectPortrait = (p) => {
  playerPortrait.value = p
  showPicker.value = false
}
</script>

<template>
  <div class="hs-profile">
    <div class="hs-profile-header">👤 {{ t('hawkStar.profile.title') }}</div>

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
              v-for="p in PORTRAITS"
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
        />
        <div class="hs-profile-disp-row">
          <button
            v-for="d in DISPOSITIONS"
            :key="d"
            class="hs-profile-disp-btn"
            :class="[`hs-profile-disp-btn--${d}`, { 'hs-profile-disp-btn--active': d === playerDisposition }]"
            @click="playerDisposition = d"
          >{{ DISP_ICON[d] }} {{ t('hawkStar.profile.' + d) }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-profile {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  overflow: visible;
}

.hs-profile-header {
  padding: 0.4rem 0.75rem;
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(255,255,255,0.06);
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
</style>
