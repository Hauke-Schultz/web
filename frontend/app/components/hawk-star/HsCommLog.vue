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
  galaxySystems,
} = useHawkStar()

// NPC response key → emoji
const NPC_EMOJI = {
  npc_welcome:        '👋',
  npc_glad:           '😊',
  npc_peace_back:     '🕊️',
  npc_acknowledged:   '✅',
  npc_received:       '📨',
  npc_noted:          '📝',
  npc_stay_away:      '✋',
  npc_not_interested: '🚫',
  npc_channel_closed: '🔒',
}
const npcEmoji = (key) => NPC_EMOJI[key] ?? '💬'

const MAX_VISIBLE = 10
const showOlder   = ref(false)
const messagesRef = ref(null)

// Filtered + sorted oldest→newest
const systemLog = computed(() =>
  commLog.value
    .filter(e => e.systemId === props.systemId)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
)

// Group ALL messages first, then limit to last MAX_VISIBLE rows
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

// Send controls
const systemData  = computed(() => galaxySystems.value.find(s => s.id === props.systemId))
const hasFactions = computed(() => (systemData.value?.factions?.length ?? 0) > 0)
const showSendBar = computed(() => hasFactions.value && canMessageSystem(props.systemId))

const showEmojiPicker = ref(false)

const sendEmoji = (emoji) => {
  sendMessage(props.systemId, emoji)
  showEmojiPicker.value = false
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

onMounted(scrollToBottom)
watch(groupedLog, scrollToBottom, { flush: 'post' })

watch(() => props.systemId, () => {
  showOlder.value       = false
  showEmojiPicker.value = false
  scrollToBottom()
})
</script>

<template>
  <div class="hs-clog">
    <div class="hs-clog-header">📡 {{ t('hawkStar.comm.commLog') }}</div>

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
        <!-- Avatar (received only) -->
        <span v-if="group.direction === 'received'" class="hs-chat-avatar">
          {{ group.entries[0].factions?.[0]?.portrait ?? '👤' }}
        </span>

        <!-- Content: faction label + bubble row -->
        <div
          class="hs-chat-content"
          :class="group.direction === 'received' ? 'hs-chat-content--received' : ''"
        >
          <span v-if="group.direction === 'received'" class="hs-chat-from">
            {{ group.entries[0].factions?.[0]?.name ?? '?' }}
          </span>
          <div class="hs-chat-bubbles">
            <div
              v-for="entry in group.entries"
              :key="entry.id"
              class="hs-chat-bubble"
              :class="[
                group.direction === 'sent' ? 'hs-chat-bubble--sent' : 'hs-chat-bubble--received',
                { 'hs-chat-bubble--transit': entry.travelEndsAt > now.value },
              ]"
            >
              <span v-if="entry.travelEndsAt > now.value" class="hs-chat-emoji hs-chat-emoji--transit">
                {{ group.direction === 'sent' ? entry.messageKey : npcEmoji(entry.messageKey) }}
              </span>
              <span v-else class="hs-chat-emoji">
                {{ group.direction === 'sent' ? entry.messageKey : npcEmoji(entry.messageKey) }}
              </span>
              <span v-if="entry.travelEndsAt > now.value" class="hs-chat-transit-timer">
                {{ formatTime(Math.max(0, Math.ceil((entry.travelEndsAt - now.value) / 1000))) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Send bar: emoji picker only, click sends directly -->
    <div v-if="showSendBar" class="hs-clog-send-bar">
      <button class="hs-clog-emoji-trigger" @click="showEmojiPicker = !showEmojiPicker">
        📡 {{ t('hawkStar.comm.sendMessage') }} ▾
      </button>
      <template v-if="showEmojiPicker">
        <div class="hs-clog-emoji-backdrop" @click="showEmojiPicker = false" />
        <div class="hs-clog-emoji-picker">
          <button
            v-for="emoji in COMM_EMOJIS"
            :key="emoji"
            class="hs-clog-emoji-btn"
            @click="sendEmoji(emoji)"
          >{{ emoji }}</button>
        </div>
      </template>
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
  min-height: 120px;
  max-height: 340px;
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
  align-items: flex-end;

  &--received { align-items: flex-start; }
}

// ── Faction name ──────────────────────────────────────────────────────────────
.hs-chat-from {
  font-size: 0.5rem;
  font-weight: 700;
  color: rgba(52,211,153,0.65);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

// ── Bubble row ────────────────────────────────────────────────────────────────
.hs-chat-bubbles {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.3rem;
}

// ── Single bubble ─────────────────────────────────────────────────────────────
.hs-chat-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.45rem 0.5rem;
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

  &--transit { opacity: 0.45; }
}

// ── Emoji ─────────────────────────────────────────────────────────────────────
.hs-chat-emoji {
  font-size: 1.75rem;
  line-height: 1;
  display: block;

  &--transit { filter: grayscale(0.4); }
}

// ── Transit countdown ─────────────────────────────────────────────────────────
.hs-chat-transit-timer {
  font-size: 0.48rem;
  color: rgba(251,191,36,0.6);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

// ── Send bar ──────────────────────────────────────────────────────────────────
.hs-clog-send-bar {
  flex-shrink: 0;
  position: relative;
  padding: 0.4rem 0.625rem;
  border-top: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.02);
}

.hs-clog-emoji-trigger {
  width: 100%;
  padding: 0.3rem 0.625rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(52,211,153,0.3);
  background: rgba(52,211,153,0.07);
  color: rgba(52,211,153,0.85);
  transition: background 0.15s, border-color 0.15s;
  text-align: center;

  &:hover { background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.55); }
}

.hs-clog-emoji-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.hs-clog-emoji-picker {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0.625rem;
  right: 0.625rem;
  z-index: 100;
  background: #12122a;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: var(--hs-r-md);
  padding: 0.5rem;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  box-shadow: 0 4px 28px rgba(0,0,0,0.6);
}

.hs-clog-emoji-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--hs-r-sm);
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0.35rem 0.2rem;
  text-align: center;
  transition: background 0.1s, transform 0.1s;

  &:hover {
    background: rgba(255,255,255,0.1);
    transform: scale(1.15);
  }
}
</style>
