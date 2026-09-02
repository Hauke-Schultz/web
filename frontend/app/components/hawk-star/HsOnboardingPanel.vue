<script setup>
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const { onboardingSteps, onboardingComplete } = useHawkStar()
</script>

<template>
  <!-- The early-game guide, and now only the list: the title and the step count
       live on the head of the `hs-empire-card` this sits in, where they stay
       readable while the card is shut. The `v-if` stays — a checklist with
       nothing left on it is only taking up room, and the board asks the same
       question again before it draws the card at all. -->
  <div v-if="!onboardingComplete" class="hs-onboarding">
    <!-- The welcome. It was the card's title and did not fit on one: a lid is a
         label, and this is a sentence addressed to the commander. -->
    <p class="hs-onboarding-intro">{{ t('hawkStar.tile.onboarding.title') }}</p>
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
// The list and nothing else. The frame, the blue tint and the padding belong to
// the `hs-empire-card--guide` this is the body of; drawing them here as well
// would be a box inside its own box.
.hs-onboarding {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-onboarding-intro {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.4;
  color: rgba(150, 180, 255, 0.9);
  letter-spacing: 0.01em;
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
