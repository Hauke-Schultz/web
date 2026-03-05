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
    <section class="hero">
      <div class="container hero__inner">
        <h1 class="hero__headline">{{ t('home.headline') }}</h1>
        <p class="hero__lead">{{ t('home.lead') }}</p>
        <a href="#content" class="btn">{{ t('home.cta') }}</a>
      </div>
    </section>

    <!-- Intro -->
    <section id="content" class="intro container">
      <h2>{{ t('home.intro_title') }}</h2>
      <p>{{ t('home.intro_text') }}</p>
    </section>
  </div>
</template>

<style scoped>
/* --- Hero ------------------------------------------------- */
.hero {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding-block: var(--space-2xl);
}

.hero__inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 720px;
}

.hero__headline {
  font-size: clamp(2.25rem, 5vw, 3.5rem);
  line-height: 1.15;
}

.hero__lead {
  font-size: 1.2rem;
  color: var(--color-text-muted);
  max-width: 55ch;
}

/* --- Button ----------------------------------------------- */
.btn {
  display: inline-block;
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-primary);
  color: var(--color-white);
  text-decoration: none;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-base);
  width: fit-content;
  transition: background var(--transition-fast);
}

.btn:hover {
  background: var(--color-primary-hover);
  color: var(--color-white);
}

/* --- Intro ------------------------------------------------- */
.intro {
  padding-block: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
</style>
