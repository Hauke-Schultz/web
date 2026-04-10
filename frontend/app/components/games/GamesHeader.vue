<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadHawk3Data } from '~/utils/localStores.js'

const { t } = useI18n()
const localePath = useLocalePath()

const props = defineProps({
  title:    { type: String, required: true },
  backTo:   { type: String, default: '/games' },
  homeMode: { type: Boolean, default: false },
})

const localizedBack = computed(() => localePath(props.backTo))

const coins    = ref(0)
const diamonds = ref(0)

onMounted(() => refresh())

function refresh() {
  const data = loadHawk3Data()
  coins.value    = data.player?.coins    ?? 0
  diamonds.value = data.player?.diamonds ?? 0
}

defineExpose({ refresh })
</script>

<template>
  <div class="flex items-center w-full py-3">
    <!-- Back / Home -->
    <NuxtLink
      :to="localizedBack"
      class="text-white/40 hover:text-white/80 text-sm transition-colors shrink-0 min-w-[80px]"
    >
      {{ homeMode ? t('games.header.home') : t('games.header.back') }}
    </NuxtLink>

    <!-- Title -->
    <div class="flex-1 text-center px-2">
      <span class="text-white font-bold text-base leading-none">{{ title }}</span>
    </div>

    <!-- Currency -->
    <div class="flex items-center gap-2.5 shrink-0 min-w-[80px] justify-end text-sm font-semibold tabular-nums">
      <span class="text-yellow-400">💰 {{ coins.toLocaleString() }}</span>
      <span class="text-cyan-400">💎 {{ diamonds.toLocaleString() }}</span>
    </div>
  </div>
</template>
