<script setup lang="ts">
const { t, tm, rt } = useI18n()

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
        <div class="flex flex-col gap-6 max-w-[720px]">
          <h1 class="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.15]">{{ t('home.headline') }}</h1>
          <p class="text-[1.2rem] text-muted max-w-[55ch]">{{ t('home.lead') }}</p>
          <a
            href="#content"
            class="inline-block px-6 py-2 bg-primary text-white no-underline rounded-lg font-semibold w-fit transition-colors hover:bg-primary-h"
          >{{ t('home.cta') }}</a>
        </div>
      </div>
    </section>

    <div id="content" class="container py-12 flex flex-col gap-12">

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
