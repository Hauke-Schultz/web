<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <nav aria-label="Language">
    <ul role="list" class="flex gap-1 list-none m-0 p-0">
      <li v-for="loc in locales" :key="loc.code">
        <NuxtLink
          :to="switchLocalePath(loc.code)"
          :hreflang="loc.language"
          :aria-current="locale === loc.code ? 'true' : undefined"
          :class="{ active: locale === loc.code }"
          class="inline-block px-2 py-1 border border-border rounded text-[0.8rem] font-semibold tracking-[0.05em] no-underline text-muted transition-colors hover:text-primary hover:border-primary [&.active]:text-primary [&.active]:border-primary"
        >
          {{ loc.code.toUpperCase() }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
