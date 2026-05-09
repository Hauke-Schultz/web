<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

defineProps({ active: { type: Boolean, default: false } })

const { planetName, systemName, planetType, PLANET_TYPES, homePlanetId, activePlanetId, playerName } = useHawkStar()
const currentPlanetType = computed(() => PLANET_TYPES[planetType.value])

const { t } = useI18n()
</script>

<template>
  <div
	  class="hs-planet-header"
    :class="{
			'hs-planet-header--active': active,
			[`hs-planet-type-badge--${planetType}`]: true
		}"
  >
	  <span class="hs-player-name">{{ playerName }}</span>
	  <span
		  v-if="currentPlanetType"
		  class="hs-planet-type-badge"
		  :title="t('hawkStar.planetTypes.' + planetType + '.desc')"
	  >{{ currentPlanetType.icon }} {{ planetName }}</span>
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
  width: 100%;
  border: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-sm);
  border-radius: var(--hs-r-sm);
  padding: 0.15rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;

  &:hover {
	  border-color: var(--hs-active-border) !important;
  }

  &--active {
	  background: var(--hs-active-bg) !important;
	  border-color: var(--hs-active-border) !important;
	  box-shadow: 0 0 20px var(--hs-active-glow) !important;
  }
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
