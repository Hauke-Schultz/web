<script setup>
import { useHawkStar, resetGame } from '~/composables/useHawkStar.js'
import HsLangSwitcher from '~/components/hawk-star/HsLangSwitcher.vue'

const { tickRateMs, buildTimeFactor, saveDevSettings } = useHawkStar()
</script>

<template>
  <div class="hs-settings-panel">
    <div class="hs-settings-section">
      <HsLangSwitcher />
    </div>

    <div class="hs-dev-panel">
      <span class="hs-dev-label">DEV</span>
      <label class="hs-dev-field">
        <span>Prod tick (ms)</span>
        <input v-model.number="tickRateMs" type="number" min="1000" max="60000" step="1000" class="hs-dev-input" />
      </label>
      <label class="hs-dev-field">
        <span>Build factor</span>
        <input v-model.number="buildTimeFactor" type="number" min="0.01" max="10" step="0.1" class="hs-dev-input" />
      </label>
      <button class="hs-dev-save" @click="saveDevSettings">Save</button>
      <button class="hs-dev-reset" title="Reset game (clears save)" @click="resetGame">↺ Reset</button>
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
  align-items: center;
  gap: 1rem;
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
</style>
