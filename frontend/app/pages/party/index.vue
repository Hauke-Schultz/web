<script setup>
definePageMeta({ hideHeader: true, forceTheme: 'dark' })

const { t } = useI18n()

useHead({ title: () => t('party.event.title') })
</script>

<template>
  <div class="party-page relative min-h-dvh">

    <!-- Hero -->
    <section class="py-8 px-6 text-center text-white card--highlight">
      <h1 class="text-[clamp(1.5rem,4vw,2.25rem)] text-white mb-3">{{ t('party.event.title') }}</h1>
    </section>

    <!-- Galerie -->
    <main class="container py-8">
      <section class="card card--full">
        <PartyGallery />
      </section>
    </main>

    <!-- Konfetti -->
    <ClientOnly>
      <PartyConfetti />
    </ClientOnly>

  </div>
</template>

<style lang="scss" scoped>
.container {
	width: 100%;
	max-width: 72rem;
	margin: 0 auto;
}
</style>
