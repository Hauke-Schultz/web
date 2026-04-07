<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadHawk3Data } from '~/utils/localStores.js'

const localePath = useLocalePath()

useHead({
  title: 'Games',
  meta: [{ name: 'description', content: 'Alle Spiele auf einem Blick.' }],
})

const highScores = ref({
  hawkFruit:    0,
  memory:       0,
  hawkDoubleUp: 0,
  hawkTower:    0,
})

onMounted(() => {
  const data = loadHawk3Data()
  highScores.value.hawkFruit    = data.games.hawkFruit?.highScore    ?? 0
  highScores.value.memory       = data.games.memory?.highScore       ?? 0
  highScores.value.hawkDoubleUp = data.games.hawkDoubleUp?.highScore ?? 0
  highScores.value.hawkTower    = data.games.hawkTower?.highScore    ?? 0
})

const games = [
  {
    key:         'hawkFruit',
    title:       'Hawk Fruit',
    description: 'Merge-Spiel im Suika-Stil – kombiniere Früchte zu immer größeren!',
    emoji:       '🍉',
    route:       '/games/hawkFruit',
    active:      true,
  },
  {
    key:         'hawkMemory',
    title:       'Hawk Memory',
    description: 'Finde alle Paare so schnell und mit so wenigen Zügen wie möglich.',
    emoji:       '🧠',
	  route:       '/games/hawkMemory',
	  active:      false,
  },
  {
    key:         'hawkDoubleUp',
    title:       'Hawk Double-Up',
    description: 'Verdopple deinen Einsatz – aber wann ist genug genug?',
    emoji:       '🎰',
	  route:       '/games/hawkDoubleUp',
	  active:      false,
  },
  {
    key:         'hawkTower',
    title:       'Hawk Tower',
    description: 'Stapele Blöcke so hoch wie möglich ohne umzufallen.',
    emoji:       '🏗️',
	  route:       '/games/hawkTower',
	  active:      false,
  },
]
</script>

<template>
  <div>
    <section class="bg-surface border-b border-border py-16">
      <div class="container">
        <div class="flex flex-col gap-4 max-w-[720px]">
          <h1>Games</h1>
          <p class="text-[1.1rem] text-muted max-w-[55ch]">Alle Spiele auf einem Blick.</p>
        </div>
      </div>
    </section>

    <div class="container py-12">
      <div class="flex flex-wrap gap-4">
	      <NuxtLink
          v-for="g in games"
          :key="g.key"
          :to="localePath(g.route)"
          class="group relative flex flex-col gap-3 bg-surface border border-border rounded-2xl p-6 no-underline w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]"
          :class="g.active
            ? 'transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-1 cursor-pointer'
            : 'opacity-60 cursor-default select-none'"
        >
          <!-- Lock overlay -->
          <div
            v-if="!g.active"
            class="absolute inset-0 rounded-2xl flex items-center justify-center bg-surface/40 backdrop-blur-[1px] z-10"
          >
            <span class="text-xs font-bold uppercase tracking-widest text-muted bg-surface border border-border px-3 py-1 rounded-full">Coming Soon</span>
          </div>

          <div class="flex items-start justify-between gap-2">
            <span class="text-4xl leading-none">{{ g.emoji }}</span>
            <span
              v-if="g.active"
              class="text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-500"
            >Beta</span>
          </div>

          <div>
            <h3 class="text-base font-bold text-fg mb-1 group-hover:text-primary transition-colors">{{ g.title }}</h3>
            <p class="text-sm text-muted leading-relaxed m-0">{{ g.description }}</p>
          </div>

          <div class="mt-auto flex items-center justify-between">
            <span v-if="g.active" class="text-primary text-sm font-semibold">Spielen →</span>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
