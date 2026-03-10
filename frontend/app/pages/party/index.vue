<script setup>
definePageMeta({ hideNav: true })

const { t, tm, rt } = useI18n()

// Event-Daten aus den Übersetzungen
const event = computed(() => ({
  title:        t('party.event.title'),
  date:         t('party.event.date'),
  startTime:    t('party.event.startTime'),
  endTime:      t('party.event.endTime'),
  hotelName:    t('party.event.hotelName'),
  hotelWebsite: t('party.event.hotelWebsite'),
  address:      t('party.event.address'),
  description:  t('party.event.description'),
  dresscode:    t('party.event.dresscode'),
}))

const program = computed(() => {
  const items = tm('party.event.program')
  return Array.isArray(items)
    ? items.map(item => ({ time: rt(item.time), icon: rt(item.icon), activity: rt(item.activity) }))
    : []
})

// Countdown
const countdown = ref({ days: 0, hours: 0, minutes: 0 })
let countdownInterval = null

const updateCountdown = () => {
  const diff = new Date(`${event.value.date}T${event.value.startTime}:00`) - new Date()
  if (diff <= 0) { clearInterval(countdownInterval); return }
  countdown.value = {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
  }
}

onMounted(() => { updateCountdown(); countdownInterval = setInterval(updateCountdown, 1000) })
onUnmounted(() => clearInterval(countdownInterval))

// Helpers
const formatDate = (d) => new Date(d).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const calendarMonth = (d) => new Date(d).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
const calendarDay = (d) => new Date(d).getDate()
const calendarWeekday = (d) => new Date(d).toLocaleDateString('de-DE', { weekday: 'long' })
const mapsEmbed = (a) => `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(a)}`

// Calendar exports
const GOOGLE_CAL_LINK = 'https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=N2xiZHFsczZwZTYzdnNxbnRmNGtwMjkxNGogYWYyMDdiNzAxMDg5ZWIyMmYyZDE2NTI2YTg1Njg0M2Q1NTBjMDBjYTViMWJiNjVhNDhmZjJjNjk5OTE4ZDI0YkBn&tmsrc=af207b701089eb22f2d16526a856843d550c00ca5b1bb65a48ff2c699918d24b%40group.calendar.google.com'
const addGoogle = () => window.open(GOOGLE_CAL_LINK, '_blank')

const addOutlook = () => {
  const u = new URL('https://outlook.live.com/calendar/0/deeplink/compose')
  u.searchParams.append('subject', event.value.title)
  u.searchParams.append('startdt', `${event.value.date}T${event.value.startTime}:00`)
  u.searchParams.append('enddt', `${event.value.date}T${event.value.endTime}:00`)
  u.searchParams.append('location', `${event.value.hotelName}, ${event.value.address}`)
  u.searchParams.append('path', '/calendar/action/compose')
  u.searchParams.append('rru', 'addevent')
  window.open(u.toString(), '_blank')
}

const downloadIcs = () => {
  const e = event.value
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${e.date.replace(/-/g,'')}T${e.startTime.replace(':','')}00`,
    `DTEND:${e.date.replace(/-/g,'')}T${e.endTime.replace(':','')}00`,
    `SUMMARY:${e.title}`,
    `LOCATION:${e.hotelName}\\, ${e.address}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'party.ics'
  a.click()
}

useHead({ title: () => t('party.event.title') })
</script>

<template>
  <div class="party-page relative min-h-dvh">

    <!-- Hero -->
    <section class="py-16 px-6 text-center text-white bg-gradient-to-br from-primary to-success">
      <h1 class="text-[clamp(1.5rem,4vw,2.25rem)] text-white mb-3">{{ event.title }}</h1>
    </section>

    <!-- Cards Grid -->
    <main class="container flex flex-wrap gap-4 py-8">

      <!-- Datum & Countdown -->
      <section class="card card--highlight">
        <div class="text-center flex flex-col gap-2 text-white">
          <div class="text-xs font-bold uppercase tracking-[1px] bg-white/15 rounded px-2 py-[6px]">
            {{ calendarMonth(event.date) }}
          </div>
          <div class="text-[5rem] font-bold leading-none">{{ calendarDay(event.date) }}</div>
          <div class="text-lg opacity-90">{{ calendarWeekday(event.date) }}</div>
          <div class="text-sm bg-white/15 rounded py-[6px] px-3 inline-block mx-auto">
            {{ event.startTime }} – {{ event.endTime }} {{ t('party.countdown.timeUnit') }}
          </div>
          <div class="flex justify-center gap-4 mt-4 pt-4 border-t border-white/20">
            <div class="flex flex-col items-center gap-1">
              <span class="text-[1.75rem] font-bold leading-none">{{ countdown.days }}</span>
              <span class="text-[0.65rem] uppercase tracking-[1px] opacity-85">{{ t('party.countdown.days') }}</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <span class="text-[1.75rem] font-bold leading-none">{{ String(countdown.hours).padStart(2,'0') }}</span>
              <span class="text-[0.65rem] uppercase tracking-[1px] opacity-85">{{ t('party.countdown.hours') }}</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <span class="text-[1.75rem] font-bold leading-none">{{ String(countdown.minutes).padStart(2,'0') }}</span>
              <span class="text-[0.65rem] uppercase tracking-[1px] opacity-85">{{ t('party.countdown.minutes') }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Ort -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.location.title') }}</h2>
        <h3 class="card__subtitle">{{ event.hotelName }}</h3>
        <p class="card__text">{{ event.address }}</p>
        <a :href="event.hotelWebsite" target="_blank" rel="noopener" class="card__link">
          {{ event.hotelWebsite }}
        </a>
        <div class="relative mt-4 pb-[56.25%] rounded-lg overflow-hidden">
          <iframe
            :src="mapsEmbed(event.address)"
            class="absolute inset-0 w-full h-full border-0"
            allowfullscreen
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      <!-- Hotel Bilder -->
      <section class="card card--flush">
        <PartyHotelFade />
      </section>

      <!-- Intro -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.intro.title') }}</h2>
        <p class="card__text card__text--pre">{{ event.description }}</p>
      </section>

      <!-- Level-Up Klickspiel -->
      <section class="card card--flush card--game">
        <PartyLevelUp />
      </section>

      <!-- Programm -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.program.title') }}</h2>
        <ul class="list-none flex flex-col gap-3 p-0 m-0">
          <li
            v-for="item in program"
            :key="item.time"
            class="flex gap-3 items-start border-l-[3px] border-accent pl-3 text-sm"
          >
            <span class="font-bold text-accent min-w-[40px] shrink-0">{{ item.time }}</span>
            <span class="shrink-0">{{ item.icon }}</span>
            <span>{{ item.activity }}</span>
          </li>
        </ul>
      </section>

      <!-- Dresscode -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.dresscode.title') }}</h2>
        <p class="card__text">{{ event.dresscode }}</p>
      </section>

      <!-- Hotel -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.hotel.title') }}</h2>
        <p class="card__text">{{ t('party.cards.hotel.text1') }}</p>
        <p class="card__text">{{ t('party.cards.hotel.text2') }}</p>
      </section>

      <!-- Anreise -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.travel.title') }}</h2>
        <p class="card__text">{{ t('party.cards.travel.parking') }}</p>
        <p class="card__text">{{ t('party.cards.travel.public') }}</p>
      </section>

      <!-- Geschenke -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.gifts.title') }}</h2>
        <p class="card__text">{{ t('party.cards.gifts.text1') }}</p>
        <p class="card__text">{{ t('party.cards.gifts.text2') }}</p>
      </section>

      <!-- Kalender -->
      <section class="card">
        <h2 class="card__title">{{ t('party.cards.save.title') }}</h2>
        <p class="card__text">{{ t('party.cards.save.lead') }}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button
            class="px-5 py-2 border-0 rounded-lg font-semibold cursor-pointer text-white transition-all hover:brightness-110 hover:-translate-y-px bg-[#4285f4]"
            @click="addGoogle"
          >{{ t('party.cards.save.google') }}</button>
          <button
            class="px-5 py-2 border-0 rounded-lg font-semibold cursor-pointer text-white transition-all hover:brightness-110 hover:-translate-y-px bg-[#0078d4]"
            @click="addOutlook"
          >{{ t('party.cards.save.outlook') }}</button>
          <button
            class="px-5 py-2 border-0 rounded-lg font-semibold cursor-pointer text-white transition-all hover:brightness-110 hover:-translate-y-px bg-[#555]"
            @click="downloadIcs"
          >{{ t('party.cards.save.apple') }}</button>
        </div>
      </section>

      <!-- RSVP -->
      <section class="card card--wide card--flush">
        <PartyRsvp />
      </section>

      <!-- Bilder Slider -->
      <section class="card card--wide card--flush">
        <PartySlider />
      </section>

    </main>

    <!-- Konfetti -->
    <PartyConfetti />

  </div>
</template>

<style lang="scss" scoped>
	.container {
		max-width: 1200px;
	}
</style>