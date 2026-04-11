<script setup lang="ts">
const { t, tm, rt } = useI18n()
const localePath = useLocalePath()

useHead({
  title: t('home.title'),
  meta: [{ name: 'description', content: t('home.description') }],
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-surface border-b border-border py-16">
      <div class="container">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
          <h1 class="text-[clamp(2rem,4vw,3rem)] leading-[1.15] m-0">{{ t('home.headline') }}</h1>
          <p class="text-[1.1rem] text-muted leading-relaxed m-0">{{ t('home.lead') }}</p>
        </div>
      </div>
    </section>

    <div class="container py-12">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-14">

        <!-- Projects -->
        <section id="projekte" class="flex flex-col gap-4">
          <h2 class="m-0">{{ t('home.projects_title') }}</h2>
          <NuxtLink
            :to="localePath('/games')"
            class="group flex flex-col gap-3 bg-surface border border-border rounded-2xl p-6 no-underline transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-1"
          >
            <span class="text-4xl leading-none">🎮</span>
            <div>
              <h3 class="text-base font-bold text-fg mb-1 group-hover:text-primary transition-colors">Meine Spiele</h3>
              <p class="text-sm text-muted leading-relaxed m-0">Hawk Fruit, Hawk Double-Up, Hawk Tower und mehr</p>
            </div>
            <span class="text-primary text-sm font-semibold mt-auto">Zu den Spielen →</span>
          </NuxtLink>
        </section>

        <!-- Intro -->
        <section class="flex flex-col justify-center">
          <p class="text-base text-muted leading-relaxed m-0">{{ t('home.intro_text') }}</p>
        </section>

        <!-- Features -->
        <section class="flex flex-col gap-4">
          <h2 class="m-0">{{ t('home.features_title') }}</h2>
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
        <section class="flex flex-col gap-4">
          <h2 class="m-0">{{ t('home.why_title') }}</h2>
          <p class="text-muted leading-relaxed m-0">{{ t('home.why_text1') }}</p>
          <p class="text-muted leading-relaxed m-0">{{ t('home.why_text2') }}</p>
        </section>

        <!-- Note (full width) -->
        <section class="lg:col-span-2 bg-surface-alt border border-border rounded-xl px-6 py-5">
          <h3 class="text-base font-semibold mb-2">{{ t('home.note_title') }}</h3>
          <p class="text-sm text-muted leading-relaxed m-0">{{ t('home.note_text') }}</p>
        </section>

      </div>
    </div>
  </div>
</template>
