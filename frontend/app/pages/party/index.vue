<script setup>
// Party data — later sourced from Kirby CMS
const party = {
  title: 'Toni & Hauke Ehe-Challenge Party',
  date: '2026-07-25',
  startTime: '16:00',
  endTime: '03:00',
  hotelName: 'Hotel Hafen Hamburg',
  hotelWebsite: 'https://www.hotel-hafen-hamburg.de/',
  address: 'Seewartenstraße 9, 20459 Hamburg',
  description: 'Wir haben nicht nur 15 Jahre Ehe-Challenge gemeistert, sondern feiern auch einen weiteren Meilenstein!\n\nToni wurde 50, oder wie sie es ausdrückt: Sie steigt im Wert.\n\nJetzt kommt das Bonuslevel:\nParty! 🥳\n\nKommt und feiert mit uns, wenn wir zusammen weiterleveln – mit Musik, Spaß und ganz viel Konfetti! 🎊',
  dresscode: 'Nach Belieben – Hauptsache ihr fühlt euch wohl!',
  program: [
    { time: '16:00', icon: '🍾', activity: 'Welcome-Drink & Anstoßen' },
    { time: '17:00', icon: '🍽️', activity: 'Feines Dinner mit guter Gesellschaft' },
    { time: '19:00', icon: '🎶', activity: "Let's dance! Die Party startet" },
    { time: '03:00', icon: '😎', activity: 'Last Call – wer bis hier bleibt, ist Legende' },
  ],
}

// Countdown
const countdown = ref({ days: 0, hours: 0, minutes: 0 })
let countdownInterval = null

const updateCountdown = () => {
  const diff = new Date(`${party.date}T${party.startTime}:00`) - new Date()
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
  u.searchParams.append('subject', party.title)
  u.searchParams.append('startdt', `${party.date}T${party.startTime}:00`)
  u.searchParams.append('enddt', `${party.date}T${party.endTime}:00`)
  u.searchParams.append('location', `${party.hotelName}, ${party.address}`)
  u.searchParams.append('path', '/calendar/action/compose')
  u.searchParams.append('rru', 'addevent')
  window.open(u.toString(), '_blank')
}

const downloadIcs = () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${party.date.replace(/-/g,'')}T${party.startTime.replace(':','')}00`,
    `DTEND:${party.date.replace(/-/g,'')}T${party.endTime.replace(':','')}00`,
    `SUMMARY:${party.title}`,
    `LOCATION:${party.hotelName}\\, ${party.address}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'party.ics'
  a.click()
}

useHead({ title: party.title })
</script>

<template>
  <div class="party-page">

    <!-- Hero -->
    <section class="party-hero">
      <h1 class="party-hero__title">{{ party.title }}</h1>
      <p class="party-hero__date">{{ formatDate(party.date) }}</p>
    </section>

    <!-- Cards Grid -->
    <main class="party-grid container">

      <!-- Datum & Countdown -->
      <section class="card card--highlight">
        <div class="cal-visual">
          <div class="cal-month">{{ calendarMonth(party.date) }}</div>
          <div class="cal-day">{{ calendarDay(party.date) }}</div>
          <div class="cal-weekday">{{ calendarWeekday(party.date) }}</div>
          <div class="cal-time">{{ party.startTime }} – {{ party.endTime }} Uhr</div>
          <div class="countdown">
            <div class="countdown__item">
              <span class="countdown__val">{{ countdown.days }}</span>
              <span class="countdown__label">Tage</span>
            </div>
            <div class="countdown__item">
              <span class="countdown__val">{{ String(countdown.hours).padStart(2,'0') }}</span>
              <span class="countdown__label">Stunden</span>
            </div>
            <div class="countdown__item">
              <span class="countdown__val">{{ String(countdown.minutes).padStart(2,'0') }}</span>
              <span class="countdown__label">Minuten</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Ort -->
      <section class="card">
        <h2 class="card__title">📍 Ort</h2>
        <h3 class="card__subtitle">{{ party.hotelName }}</h3>
        <p class="card__text">{{ party.address }}</p>
        <a :href="party.hotelWebsite" target="_blank" rel="noopener" class="card__link">
          {{ party.hotelWebsite }}
        </a>
        <div class="maps-wrap">
          <iframe
            :src="mapsEmbed(party.address)"
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
        <h2 class="card__title">🎉 Intro</h2>
        <p class="card__text card__text--pre">{{ party.description }}</p>
      </section>

      <!-- Programm -->
      <section class="card">
        <h2 class="card__title">📋 Programm</h2>
        <ul class="program">
          <li v-for="item in party.program" :key="item.time" class="program__item">
            <span class="program__time">{{ item.time }}</span>
            <span class="program__icon">{{ item.icon }}</span>
            <span>{{ item.activity }}</span>
          </li>
        </ul>
      </section>

      <!-- Dresscode -->
      <section class="card">
        <h2 class="card__title">👔 Dresscode</h2>
        <p class="card__text">{{ party.dresscode }}</p>
      </section>

      <!-- Hotel -->
      <section class="card">
        <h2 class="card__title">🏨 Hotel</h2>
        <p class="card__text">Ihr möchtet vor Ort übernachten? Das Hotel Hafen Hamburg bietet Zimmer direkt am Veranstaltungsort.</p>
        <p class="card__text">Aktuelle Preise findet ihr auf der Hotel-Website.</p>
      </section>

      <!-- Anreise -->
      <section class="card">
        <h2 class="card__title">🚗 Anreise</h2>
        <p class="card__text">Das Hotel verfügt über Parkplätze (ca. 25 € / Tag).</p>
        <p class="card__text">Empfohlen: Anreise mit S-Bahn — Haltestelle Landungsbrücken, 5 Minuten Fußweg.</p>
      </section>

      <!-- Geschenke -->
      <section class="card">
        <h2 class="card__title">🎁 Geschenke</h2>
        <p class="card__text">Das größte Geschenk ist eure Anwesenheit!</p>
        <p class="card__text">Wer trotzdem etwas mitbringen möchte: ein Umschlag freut uns sehr. 🫶</p>
      </section>

      <!-- Kalender -->
      <section class="card">
        <h2 class="card__title">📅 Termin speichern</h2>
        <p class="card__text">Damit du den Tag nicht vergisst:</p>
        <div class="cal-buttons">
          <button class="cal-btn cal-btn--google" @click="addGoogle">Google</button>
          <button class="cal-btn cal-btn--outlook" @click="addOutlook">Outlook</button>
          <button class="cal-btn cal-btn--apple" @click="downloadIcs">Apple</button>
        </div>
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
  padding: 64px 24px;
  text-align: center;
  color: #fff;
}

.party-hero__title {
  font-size: clamp(1.75rem, 4vw, 3rem);
  color: #fff;
  margin-bottom: 12px;
}

.party-hero__date {
  font-size: 1.1rem;
  opacity: 0.9;
}

/* Grid */
.party-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-block: 32px;
}

/* Cards */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 100%;
  transition: box-shadow var(--transition-fast), translate var(--transition-fast);
}

.card:hover {
  box-shadow: var(--shadow-md);
  translate: 0 -2px;
}

.card--flush   { padding: 0; overflow: hidden; }
.card--highlight {
  background: linear-gradient(135deg, var(--color-primary), var(--color-success));
  border: none;
  color: #fff;
}

@media (min-width: 640px) {
  .card       { width: calc(50% - 8px); }
  .card--wide { width: 100%; }
}

@media (min-width: 1024px) {
  .card       { width: calc(33.333% - 11px); }
  .card--wide { width: calc(66.666% - 5px); }
}

/* Card content */
.card__title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.card--highlight .card__title { color: #fff; }

.card__subtitle {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.card__text {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.card__text--pre { white-space: pre-line; }

.card__link {
  font-size: 0.85rem;
  word-break: break-all;
}

/* Calendar visual */
.cal-visual {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #fff;
}

.cal-month {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  background: rgba(255 255 255 / 0.15);
  border-radius: var(--radius-sm);
  padding: 6px;
}

.cal-day     { font-size: 5rem; font-weight: 700; line-height: 1; }
.cal-weekday { font-size: 1.1rem; opacity: 0.9; }

.cal-time {
  font-size: 0.9rem;
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
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255 255 255 / 0.2);
}

.countdown__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.countdown__val   { font-size: 1.75rem; font-weight: 700; line-height: 1; }
.countdown__label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }

/* Maps */
.maps-wrap {
  position: relative;
  margin-top: 16px;
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
.program { list-style: none; display: flex; flex-direction: column; gap: 12px; }

.program__item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border-left: 3px solid var(--color-accent);
  padding-left: 12px;
  font-size: 0.95rem;
}

.program__time  { font-weight: 700; color: var(--color-accent); min-width: 40px; flex-shrink: 0; }
.program__icon  { flex-shrink: 0; }

/* Calendar buttons */
.cal-buttons { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }

.cal-btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  transition: filter var(--transition-fast), translate var(--transition-fast);
}

.cal-btn:hover    { filter: brightness(1.1); translate: 0 -1px; }
.cal-btn--google  { background: #4285f4; }
.cal-btn--outlook { background: #0078d4; }
.cal-btn--apple   { background: #555; }
</style>
