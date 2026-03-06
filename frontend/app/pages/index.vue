<script setup lang="ts">
const { t } = useI18n()

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

    <!-- Intro -->
    <section id="content" class="container py-10 flex flex-col gap-4">
      <h2>{{ t('home.intro_title') }}</h2>
      <p>{{ t('home.intro_text') }}</p>
    </section>
  </div>
</template>
