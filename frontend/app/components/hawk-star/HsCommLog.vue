<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const props = defineProps({
  systemId: { type: String, required: true },
})

const { t } = useI18n()
const {
  commLog, sendMessage, canMessageSystem,
  COMM_EMOJIS, now, formatTime,
  galaxySystems, markSystemRead,
} = useHawkStar()

const formatMsgTime = (timestamp) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mo}. ${hh}:${mm}`
}

const MAX_VISIBLE = 10
const MAX_STAGED  = 5
const showOlder   = ref(false)
const messagesRef = ref(null)

// ── Log filtering & grouping ──────────────────────────────────────────────────

const systemLog = computed(() =>
  commLog.value
    .filter(e => String(e.systemId) === String(props.systemId))
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
)

const allGrouped = computed(() => {
  const groups = []
  for (const entry of systemLog.value) {
    const last = groups.at(-1)
    if (last && last.direction === entry.direction) {
      last.entries.push(entry)
    } else {
      groups.push({ id: entry.id, direction: entry.direction, entries: [entry] })
    }
  }
  return groups
})

const groupedLog = computed(() =>
  !showOlder.value && allGrouped.value.length > MAX_VISIBLE
    ? allGrouped.value.slice(-MAX_VISIBLE)
    : allGrouped.value
)

const hasOlder = computed(() =>
  !showOlder.value && allGrouped.value.length > MAX_VISIBLE
)

// ── Send controls ─────────────────────────────────────────────────────────────

const systemData  = computed(() => galaxySystems.value.find(s => s.id === props.systemId))
// System-level, not per planet: which planets are theirs stays hidden until a
// spy drone lands, but the scan already told us that somebody lives here.
const hasPlayers  = computed(() => (systemData.value?.inhabitants?.length ?? 0) > 0)
const showSendBar = computed(() => hasPlayers.value && canMessageSystem(props.systemId))

const hasMessageInTransit = computed(() =>
  systemLog.value.some(e => e.direction === 'sent' && e.travelEndsAt && e.travelEndsAt > now.value)
)

const showPicker  = ref(false)
const staged      = ref([])

watch(hasMessageInTransit, (blocked) => { if (blocked) showPicker.value = false })

const addEmoji = (emoji) => {
  if (staged.value.length >= MAX_STAGED) return
  staged.value.push(emoji)
}

const removeEmoji = (idx) => {
  staged.value.splice(idx, 1)
}

const isFull = computed(() => staged.value.length >= MAX_STAGED)

const sending = ref(false)
const sendStaged = async () => {
  if (staged.value.length === 0 || sending.value || hasMessageInTransit.value) return
  const keys = [...staged.value]
  staged.value  = []
  showPicker.value = false
  sending.value = true
  await sendMessage(props.systemId, keys)
  sending.value = false
}

// ── Scroll ────────────────────────────────────────────────────────────────────

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

onMounted(() => { markSystemRead(props.systemId); scrollToBottom() })
watch(groupedLog, scrollToBottom, { flush: 'post' })

watch(() => props.systemId, () => {
  markSystemRead(props.systemId)
  showOlder.value  = false
  showPicker.value = false
  staged.value     = []
  scrollToBottom()
})
</script>

<template>
  <div class="hs-clog">
    <div class="hs-clog-header">📡 {{ t('hawkStar.comm.commLog') }}</div>

    <!-- Messages -->
    <div ref="messagesRef" class="hs-clog-messages">
      <button v-if="hasOlder" class="hs-clog-older-btn" @click="showOlder = true">
        ↑ {{ t('hawkStar.comm.olderMessages') }}
      </button>

      <p v-if="groupedLog.length === 0" class="hs-clog-empty">
        {{ t('hawkStar.comm.noMessages') }}
      </p>

      <div
        v-for="group in groupedLog"
        :key="group.id"
        class="hs-chat-row"
        :class="group.direction === 'sent' ? 'hs-chat-row--sent' : 'hs-chat-row--received'"
      >
        <span v-if="group.direction === 'received'" class="hs-chat-avatar">
          {{ group.entries[0].owners?.[0]?.portrait ?? '👤' }}
        </span>

        <div
          class="hs-chat-content"
          :class="group.direction === 'received' ? 'hs-chat-content--received' : ''"
        >
          <span v-if="group.direction === 'received'" class="hs-chat-from">
            {{ group.entries[0].owners?.[0]?.username ?? '?' }}
          </span>
          <div class="hs-chat-bubbles">
            <div
              v-for="entry in group.entries"
              :key="entry.id"
              class="hs-chat-bubble"
              :class="[
                group.direction === 'sent' ? 'hs-chat-bubble--sent' : 'hs-chat-bubble--received',
                { 'hs-chat-bubble--transit': entry.travelEndsAt > now },
              ]"
            >
              <!-- Split space-separated emoji row -->
              <div class="hs-chat-emoji-row">
                <span
                  v-for="(emoji, i) in entry.messageKey.split(' ')"
                  :key="i"
                  class="hs-chat-emoji"
                  :class="{ 'hs-chat-emoji--transit': entry.travelEndsAt > now }"
                >{{ emoji }}</span>
              </div>
              <span class="hs-chat-time">
	              <span v-if="entry.travelEndsAt > now" class="hs-chat-transit-timer">
	                {{ formatTime(Math.max(0, Math.ceil((entry.travelEndsAt - now) / 1000))) }}
	              </span>
                {{ formatMsgTime(entry.timestamp) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Send bar -->
    <div v-if="showSendBar" class="hs-clog-send-bar">

      <!-- Staging tray + send button -->
      <div class="hs-clog-tray-row" :class="{ 'hs-clog-tray-row--blocked': hasMessageInTransit }">
        <button
          class="hs-clog-picker-toggle"
          :class="{ 'is-active': showPicker }"
          :disabled="hasMessageInTransit"
          @click="showPicker = !showPicker"
        >📡</button>
        <div class="hs-clog-tray" @click="!hasMessageInTransit && !isFull && (showPicker = true)">
          <span v-if="hasMessageInTransit" class="hs-clog-tray-hint hs-clog-tray-hint--transit">
            ⏳ {{ t('hawkStar.comm.inTransit') }}
          </span>
          <template v-else>
            <span v-if="staged.length === 0" class="hs-clog-tray-hint">{{ isFull ? '' : t('hawkStar.comm.stagingHint') }}</span>
            <button
              v-for="(emoji, idx) in staged"
              :key="idx"
              class="hs-clog-staged-chip"
              @click="removeEmoji(idx)"
            >{{ emoji }}<span class="hs-clog-staged-remove">×</span></button>
          </template>
        </div>
        <button
          class="hs-clog-send-btn"
          :disabled="staged.length === 0 || sending || hasMessageInTransit"
          @click="sendStaged"
        >{{ t('hawkStar.comm.sendBtn') }} →</button>
      </div>

      <!-- Emoji picker -->
      <Transition name="hs-picker">
        <div v-if="showPicker" class="hs-clog-emoji-picker">
          <button
            v-for="emoji in COMM_EMOJIS"
            :key="emoji"
            class="hs-clog-emoji-btn"
            :class="{ 'hs-clog-emoji-btn--full': isFull }"
            :disabled="isFull"
            @click="addEmoji(emoji)"
          >{{ emoji }}</button>
        </div>
      </Transition>

    </div>
  </div>
</template>


<style lang="scss" scoped>
.hs-clog {
  display: flex;
  flex-direction: column;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

// ── Header ────────────────────────────────────────────────────────────────────
.hs-clog-header {
  flex-shrink: 0;
  padding: 0.4rem 0.75rem;
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

// ── Messages area ─────────────────────────────────────────────────────────────
.hs-clog-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 200px;
  max-height: 300px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.08) transparent;

  &::-webkit-scrollbar        { width: 4px; }
  &::-webkit-scrollbar-track  { background: transparent; }
  &::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.08); border-radius: 9999px; }
}

// ── Older button ──────────────────────────────────────────────────────────────
.hs-clog-older-btn {
  align-self: center;
  padding: 3px 12px;
  border-radius: 9999px;
  font-size: 0.56rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.35);
  transition: background 0.15s, color 0.15s;
  margin-bottom: 0.1rem;
  flex-shrink: 0;

  &:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }
}

// ── Empty ─────────────────────────────────────────────────────────────────────
.hs-clog-empty {
  flex: 1;
  font-size: 0.6rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
  margin: 0;
  text-align: center;
  padding: 1.5rem 0;
}

// ── Chat row ──────────────────────────────────────────────────────────────────
.hs-chat-row {
  display: flex;
  align-items: flex-end;
  gap: 0.4rem;
  width: 100%;

  &--sent     { flex-direction: row-reverse; }
  &--received { flex-direction: row; }
}

// ── Avatar ────────────────────────────────────────────────────────────────────
.hs-chat-avatar {
  flex-shrink: 0;
  font-size: 1.25rem;
  line-height: 1;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(52,211,153,0.07);
  border: 1px solid rgba(52,211,153,0.15);
  border-radius: 50%;
}

// ── Content area ──────────────────────────────────────────────────────────────
.hs-chat-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 75%;
  min-width: 0;
  align-items: flex-end;

  &--received { align-items: flex-start; }
}

.hs-chat-from {
  font-size: 0.5rem;
  font-weight: 700;
  color: rgba(52,211,153,0.65);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hs-chat-bubbles {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;

  .hs-chat-row--received & { align-items: flex-start; }
}

.hs-chat-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.4rem 0.5rem;
  border-radius: var(--hs-r-md);

  &--sent {
    background: rgba(79,110,247,0.18);
    border: 1px solid rgba(79,110,247,0.3);
    border-bottom-right-radius: 3px;
  }

  &--received {
    background: rgba(52,211,153,0.1);
    border: 1px solid rgba(52,211,153,0.2);
    border-bottom-left-radius: 3px;
  }

  &--transit { opacity: 0.7; }
}

.hs-chat-emoji-row {
  display: flex;
  flex-direction: row;
  gap: 0.15rem;
}

.hs-chat-emoji {
  font-size: 1.6rem;
  line-height: 1;
  display: block;

  &--transit { filter: grayscale(0.4); }
}

.hs-chat-transit-timer {
  font-size: 0.6rem;
  color: rgba(251,191,36,1);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
	padding-right: 1rem;
}

.hs-chat-time {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.8);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  align-self: flex-end;

  .hs-chat-row--received & { align-self: flex-start; }
}

// ── Send bar ──────────────────────────────────────────────────────────────────
.hs-clog-send-bar {
  flex-shrink: 0;
  padding: 0.4rem 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.02);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

// ── Tray row ──────────────────────────────────────────────────────────────────
.hs-clog-tray-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.hs-clog-picker-toggle {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(52,211,153,0.3);
  background: rgba(52,211,153,0.07);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s;

  &:hover, &.is-active {
    background: rgba(52,211,153,0.18);
    border-color: rgba(52,211,153,0.55);
  }
}

.hs-clog-tray {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 2rem;
  padding: 0.1rem 0.3rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--hs-r-sm);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover { border-color: rgba(52,211,153,0.3); background: rgba(52,211,153,0.04); }
}

.hs-clog-tray-row--blocked {
  opacity: 0.6;
  pointer-events: none;
}

.hs-clog-tray-hint {
  font-size: 0.58rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;

  &--transit {
    color: rgba(251,191,36,0.7);
    font-style: normal;
    font-weight: 600;
  }
}

.hs-clog-staged-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px;
  border-radius: 5px;
  background: rgba(79,110,247,0.2);
  border: 1px solid rgba(79,110,247,0.4);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.1s;

  &:hover { background: rgba(220,80,80,0.2); border-color: rgba(220,80,80,0.4); }
}

.hs-clog-staged-remove {
  font-size: 0.55rem;
  color: rgba(255,255,255,0.4);
  font-style: normal;
  line-height: 1;
}

.hs-clog-send-btn {
  flex-shrink: 0;
  padding: 0.3rem 0.625rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(79,110,247,0.4);
  background: rgba(79,110,247,0.12);
  color: rgba(150,175,255,0.9);
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) { background: rgba(79,110,247,0.25); border-color: rgba(79,110,247,0.65); }
  &:disabled { opacity: 0.3; cursor: default; }
}

// ── Emoji picker ──────────────────────────────────────────────────────────────
.hs-clog-emoji-picker {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 2px;
  padding: 0.35rem;
  background: rgba(10,10,28,0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--hs-r-md);
}

.hs-clog-emoji-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--hs-r-sm);
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  padding: 0.25rem 0.1rem;
  text-align: center;
  transition: background 0.1s, transform 0.1s;

  &:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    transform: scale(1.15);
  }

  &--full, &:disabled {
    opacity: 0.25;
    cursor: default;
    transform: none;
  }
}

// ── Picker slide transition ───────────────────────────────────────────────────
.hs-picker-enter-active,
.hs-picker-leave-active { transition: opacity 0.15s, transform 0.15s; }
.hs-picker-enter-from,
.hs-picker-leave-to     { opacity: 0; transform: translateY(-4px); }
</style>
