<script setup lang="ts">
const { t, tm, rt } = useI18n()
const localePath = useLocalePath()

useHead({
  title: t('home.title'),
  meta: [{ name: 'description', content: t('home.description') }],
})

const projects = [
  {
    title:       'Hawk Fruit',
    description: 'Merge-Spiel im Suika-Stil – kombiniere Früchte zu immer größeren!',
    emoji:       '🍉',
    route:       '/hawk-fruit',
    tag:         'Spiel',
  },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-surface border-b border-border py-16">
      <div class="container">
        <div class="flex flex-col gap-6 max-w-[720px]">
          <h1 class="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.15]">{{ t('home.headline') }}</h1>
          <p class="text-[1.2rem] text-muted max-w-[55ch]">{{ t('home.lead') }}</p>
          <a
            href="#projekte"
            class="inline-block px-6 py-2 bg-primary text-white no-underline rounded-lg font-semibold w-fit transition-colors hover:bg-primary-h"
          >{{ t('home.cta') }}</a>
        </div>
      </div>
    </section>

    <div class="container py-12 flex flex-col gap-14">

      <!-- Projects -->
      <section id="projekte">
        <h2 class="mb-6">{{ t('home.projects_title') }}</h2>
        <div class="flex flex-wrap gap-4">
          <NuxtLink
            v-for="p in projects"
            :key="p.route"
            :to="localePath(p.route)"
            class="group flex flex-col gap-3 bg-surface border border-border rounded-2xl p-6 no-underline transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-1 w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-4xl leading-none">{{ p.emoji }}</span>
              <span class="text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{{ p.tag }}</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-fg mb-1 group-hover:text-primary transition-colors">{{ p.title }}</h3>
              <p class="text-sm text-muted leading-relaxed m-0">{{ p.description }}</p>
            </div>
            <span class="text-primary text-sm font-semibold mt-auto">Spielen →</span>
          </NuxtLink>
        </div>
      </section>

      <!-- Intro -->
      <section class="max-w-[70ch]">
        <p class="text-base text-muted leading-relaxed">{{ t('home.intro_text') }}</p>
      </section>

      <!-- Features -->
      <section class="flex flex-col gap-4">
        <h2>{{ t('home.features_title') }}</h2>
        <ul class="flex flex-col gap-3 list-none p-0 m-0">
          <li
            v-for="(feature, i) in tm('home.features')"
            :key="i"
            class="flex items-center gap-3 text-base"
          >
            <span class="text-xl leading-none">{{ rt(feature.icon) }}</span>
            <span>{{ rt(feature.text) }}</span>
          </li>
        </ul>
      </section>

      <!-- Why -->
      <section class="flex flex-col gap-4 max-w-[70ch]">
        <h2>{{ t('home.why_title') }}</h2>
        <p class="text-muted leading-relaxed">{{ t('home.why_text1') }}</p>
        <p class="text-muted leading-relaxed">{{ t('home.why_text2') }}</p>
      </section>

      <!-- Note -->
      <section class="bg-surface-alt border border-border rounded-xl px-6 py-5 max-w-[70ch]">
        <h3 class="text-base font-semibold mb-2">{{ t('home.note_title') }}</h3>
        <p class="text-sm text-muted leading-relaxed">{{ t('home.note_text') }}</p>
      </section>

    </div>
  </div>
</template>
