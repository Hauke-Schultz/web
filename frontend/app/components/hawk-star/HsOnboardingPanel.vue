<script setup>
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const { onboardingSteps, onboardingDoneCount, onboardingComplete } = useHawkStar()
</script>

<template>
  <!-- The early-game guide. It disappears for good once every step is ticked —
       a checklist with nothing left on it is only taking up room. -->
  <div v-if="!onboardingComplete" class="hs-onboarding">
    <div class="hs-onboarding-head">
      <span class="hs-onboarding-title">{{ t('hawkStar.tile.onboarding.title') }}</span>
      <span class="hs-onboarding-count">{{ onboardingDoneCount }} / {{ onboardingSteps.length }}</span>
    </div>
    <ul class="hs-onboarding-steps">
      <li
        v-for="step in onboardingSteps"
        :key="step.key"
        :class="{ 'hs-onboarding-step--done': step.done }"
      >
        <span class="hs-onboarding-check">{{ step.done ? '✓' : '' }}</span>
        <span class="hs-onboarding-text">{{ t('hawkStar.tile.onboarding.' + step.key) }}</span>
      </li>
    </ul>
  </div>
</template>

<style lang="scss" scoped>
// A card among the planet cards: it shares their corner radius so a row of
// them lines up, and keeps its own blue tint because it is a different kind of
// thing. `align-self: start` stops the grid from stretching it to the height of
// a tall planet card next to it.
.hs-onboarding {
  align-self: start;
  background: rgba(80, 120, 255, 0.07);
  border: 1px solid rgba(80, 120, 255, 0.2);
  border-radius: var(--hs-r-lg);
  padding: 0.7rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-onboarding-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.hs-onboarding-title {
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(150, 180, 255, 0.9);
  letter-spacing: 0.03em;
}

.hs-onboarding-count {
  font-size: 0.66rem;
  font-weight: 700;
  color: rgba(150, 180, 255, 0.75);
  font-variant-numeric: tabular-nums;
}

.hs-onboarding-steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.67rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.45;
  }
}

.hs-onboarding-check {
  flex: none;
  width: 0.85rem;
  height: 0.85rem;
  margin-top: 0.12rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(150, 180, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  line-height: 1;
  color: transparent;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.hs-onboarding-step--done {
  color: rgba(255, 255, 255, 0.32);

  .hs-onboarding-check {
    background: rgba(52, 211, 153, 0.2);
    border-color: rgba(52, 211, 153, 0.55);
    color: #6ee7b7;
  }
  .hs-onboarding-text { text-decoration: line-through; }
}
</style>
