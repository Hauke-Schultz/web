<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { planetName, systemName, planetType, PLANET_TYPES, homePlanetId, activePlanetId, playerName } = useHawkStar()
const currentPlanetType = computed(() => PLANET_TYPES[planetType.value])

const { t } = useI18n()
</script>

<template>
  <div class="hs-planet-header">
	  <span class="hs-player-name">{{ playerName }}</span>
	  <span class="hs-planet-name">
      🪐 {{ planetName }}
    </span>
	  <span
		  v-if="currentPlanetType"
		  class="hs-planet-type-badge"
		  :class="`hs-planet-type-badge--${planetType}`"
		  :title="t('hawkStar.planetTypes.' + planetType + '.desc')"
	  >{{ currentPlanetType.icon }} {{ t('hawkStar.planetTypes.' + planetType + '.name') }}</span>
  </div>
</template>

<style lang="scss" scoped>
.hs-planet-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
	flex-wrap: wrap;
  gap: 2px;
  flex-shrink: 0;
  width: calc((28rem - 3 * 0.375rem) / 4);
  border: 1px solid var(--hs-line-lg);
	background: var(--hs-glass-xl);
  border-radius: var(--hs-r-md);
	border-color: var(--hs-active-border);
	box-shadow: 0 0 20px var(--hs-active-glow);
  padding: 0.375rem 0.15rem;

  @media (min-width: 640px) {
    gap: 3px;
    width: calc((28rem - 3 * 0.5rem) / 3);
    padding: 0.5rem 0.25rem;
  }
}

.hs-planet-header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
}

.hs-player-name {
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.04em;
	color: #a5b4fc;
	white-space: nowrap;
}

.hs-planet-name {
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	opacity: 0.6;
	display: flex;
	align-items: center;
	gap: 0.3rem;
}

.hs-planet-colony-badge {
	font-size: 0.5rem;
	font-weight: 700;
	letter-spacing: 0.03em;
	text-transform: uppercase;
	color: #34d399;
	background: rgba(52,211,153,0.15);
	border: 1px solid rgba(52,211,153,0.35);
	padding: 1px 5px;
	border-radius: 999px;
}

.hs-planet-type-badge {
	font-size: 0.6rem;
	font-weight: 700;
	letter-spacing: 0.03em;
	padding: 2px 7px;
	border-radius: 999px;
	border: 1px solid;
	white-space: nowrap;
	cursor: default;

	&--terrestrial {
		color: #86efac;
		border-color: rgba(134, 239, 172, 0.35);
		background: rgba(134, 239, 172, 0.08);
	}
	&--volcanic {
		color: #fca5a5;
		border-color: rgba(252, 165, 165, 0.35);
		background: rgba(252, 165, 165, 0.08);
	}
	&--frozen {
		color: #93c5fd;
		border-color: rgba(147, 197, 253, 0.35);
		background: rgba(147, 197, 253, 0.08);
	}
	&--ocean {
		color: #67e8f9;
		border-color: rgba(103, 232, 249, 0.35);
		background: rgba(103, 232, 249, 0.08);
	}
}

</style>
