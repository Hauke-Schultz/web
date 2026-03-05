<script setup>
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
  <div class="party-page">

    <!-- Hero -->
    <section class="party-hero">
      <h1 class="party-hero__title">{{ event.title }}</h1>
      <p class="party-hero__date">{{ formatDate(event.date) }}</p>
    </section>

    <!-- Cards Grid -->
    <main class="party-grid container">

      <!-- Datum & Countdown -->
      <section class="card card--highlight">
        <div class="cal-visual">
          <div class="cal-month">{{ calendarMonth(event.date) }}</div>
          <div class="cal-day">{{ calendarDay(event.date) }}</div>
          <div class="cal-weekday">{{ calendarWeekday(event.date) }}</div>
          <div class="cal-time">{{ event.startTime }} – {{ event.endTime }} {{ t('party.countdown.timeUnit') }}</div>
          <div class="countdown">
            <div class="countdown__item">
              <span class="countdown__val">{{ countdown.days }}</span>
              <span class="countdown__label">{{ t('party.countdown.days') }}</span>
            </div>
            <div class="countdown__item">
              <span class="countdown__val">{{ String(countdown.hours).padStart(2,'0') }}</span>
              <span class="countdown__label">{{ t('party.countdown.hours') }}</span>
            </div>
            <div class="countdown__item">
              <span class="countdown__val">{{ String(countdown.minutes).padStart(2,'0') }}</span>
              <span class="countdown__label">{{ t('party.countdown.minutes') }}</span>
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
        <div class="maps-wrap">
          <iframe
            :src="mapsEmbed(event.address)"
            class="maps-iframe"
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
        <ul class="program">
          <li v-for="item in program" :key="item.time" class="program__item">
            <span class="program__time">{{ item.time }}</span>
            <span class="program__icon">{{ item.icon }}</span>
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
        <div class="cal-buttons">
          <button class="cal-btn cal-btn--google" @click="addGoogle">{{ t('party.cards.save.google') }}</button>
          <button class="cal-btn cal-btn--outlook" @click="addOutlook">{{ t('party.cards.save.outlook') }}</button>
          <button class="cal-btn cal-btn--apple" @click="downloadIcs">{{ t('party.cards.save.apple') }}</button>
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

<style scoped>
.party-page {
  min-height: 100dvh;
  position: relative;
}

/* Hero */
.party-hero {
  background: linear-gradient(135deg, var(--color-primary), var(--color-success));
  padding: var(--space-2xl) var(--space-lg);
  text-align: center;
  color: var(--color-white);
}

.party-hero__title {
  font-size: clamp(var(--font-size-2xl), 4vw, var(--font-size-4xl));
  color: var(--color-white);
  margin-bottom: var(--space-3);
}

.party-hero__date {
  font-size: var(--font-size-lg);
  opacity: 0.9;
}

/* Grid */
.party-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  padding-block: 32px;
}

/* Cards */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  width: 100%;
  transition: box-shadow var(--transition-fast), translate var(--transition-fast);
}

.card:hover {
  box-shadow: var(--shadow-md);
  translate: 0 -2px;
}

.card--flush,
.card--game    { padding: 0; }
.card--highlight {
  background: linear-gradient(135deg, var(--color-primary), var(--color-success));
  border: none;
  color: var(--color-white);
}

@media (min-width: 640px) {
  .card       { width: calc(50% - 8px); }
  .card--wide { width: 100%; }
}

@media (min-width: 1024px) {
  .card       { width: calc(33.333% - 11px); }
  .card--wide { width: calc(50% - 8px); }
}

/* Card content */
.card__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-3);
}

.card--highlight .card__title { color: var(--color-white); }

.card__subtitle {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-xs);
}

.card__text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
}

.card__text--pre { white-space: pre-line; }

.card__link {
  font-size: var(--font-size-sm);
  word-break: break-all;
}

/* Calendar visual */
.cal-visual {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  color: var(--color-white);
}

.cal-month {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 1px;
  background: rgba(255 255 255 / 0.15);
  border-radius: var(--radius-sm);
  padding: 6px;
}

.cal-day     { font-size: 5rem; font-weight: var(--font-weight-bold); line-height: 1; }
.cal-weekday { font-size: var(--font-size-lg); opacity: 0.9; }

.cal-time {
  font-size: var(--font-size-sm);
  background: rgba(255 255 255 / 0.15);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  display: inline-block;
  margin: 0 auto;
}

/* Countdown */
.countdown {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid rgba(255 255 255 / 0.2);
}

.countdown__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.countdown__val   { font-size: 1.75rem; font-weight: var(--font-weight-bold); line-height: 1; }
.countdown__label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }

/* Maps */
.maps-wrap {
  position: relative;
  margin-top: var(--space-md);
  padding-bottom: 56.25%;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.maps-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* Program */
.program { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); }

.program__item {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  border-left: 3px solid var(--color-accent);
  padding-left: var(--space-3);
  font-size: var(--font-size-sm);
}

.program__time  { font-weight: var(--font-weight-bold); color: var(--color-accent); min-width: 40px; flex-shrink: 0; }
.program__icon  { flex-shrink: 0; }

/* Calendar buttons */
.cal-buttons { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-3); }

.cal-btn {
  padding: var(--space-sm) var(--space-5);
  border: none;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  color: var(--color-white);
  transition: filter var(--transition-fast), translate var(--transition-fast);
}

.cal-btn:hover    { filter: brightness(1.1); translate: 0 -1px; }
.cal-btn--google  { background: #4285f4; }
.cal-btn--outlook { background: #0078d4; }
.cal-btn--apple   { background: #555; }
</style>
