// Replays HsInterceptGame's firing sequence for the three server speeds that
// matter, and asserts the one rule the player actually cares about:
//
//   NOTHING COVERS THE FIELD BEFORE THE ROUND HAS LANDED AND BEEN READ.
//
// This exists because that rule was broken twice in opposite directions — once
// by hanging the verdict card on the server's answer (fast connection: the card
// went up mid-flight), once by hanging the WRECK on it (slow connection: the
// flash was on time and the dish flew on for another second). Both are invisible
// in a fast local dev loop, which is exactly why they are worth a script.
//
//   node scratchpad/intercept-timing-check.mjs
const SHELL_MS = 700, VERDICT_MS = 900
const TOL = 80   // ms of slack for timer jitter

const run = (label, serverMs) => new Promise((resolve) => {
  const t0 = Date.now()
  const at = () => Date.now() - t0
  const log = []
  const beat = (fn, ms) => setTimeout(fn, ms)
  const atImpact = (firedAt, fn) => beat(fn, Math.max(0, SHELL_MS - (Date.now() - firedAt)))

  const firedAt = Date.now()
  // The client decides hit AND kill up front — it knows the armour.
  const hit = true, kills = true
  log.push([at(), 'fired'])

  // The frame loop paints the impact mark when the shell arrives.
  beat(() => log.push([at(), 'IMPACT — flash']), SHELL_MS)

  // Scheduled BEFORE the request goes out. This is the fix.
  atImpact(firedAt, () => {
    if (kills) {
      log.push([at(), 'wreck shown'])
      beat(() => {
        log.push([at(), 'verdict card'])
        finish()
      }, VERDICT_MS)
    }
  })

  // The server answers whenever it answers; it only reconciles the number.
  beat(() => log.push([at(), `server answered (${serverMs} ms)`]), serverMs)

  function finish() {
    log.sort((a, b) => a[0] - b[0])
    const t = (p) => log.find(l => l[1].startsWith(p))[0]
    const impact = t('IMPACT'), wreck = t('wreck'), card = t('verdict')
    const ok = wreck <= impact + TOL && card >= impact + VERDICT_MS - TOL
    console.log(`\n${label}  —  ${ok ? 'ok' : 'FAIL'}`)
    for (const [ms, what] of log) console.log(`   ${String(ms).padStart(5)} ms  ${what}`)
    resolve(ok)
  }
})

const results = []
results.push(await run('answer beats the shell home  (120 ms)', 120))
results.push(await run('answer lands with the shell  (700 ms)', 700))
results.push(await run('slow answer, long after impact  (1600 ms)', 1600))

const ok = results.every(Boolean)
console.log('\n' + (ok
  ? 'all orderings correct — the wreck lands with the flash, the card a beat later,\nand the server never gets a vote on either'
  : 'ORDERING BROKEN'))
process.exit(ok ? 0 : 1)
