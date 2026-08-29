// The hit counter has TWO writers, and this reproduces their ordering rather
// than trusting a reading of the code.
//
//   at impact (700 ms)   hits += 1        the local prediction
//   on the answer (~200) hits = server    the reconciliation
//
// The correction is an ABSOLUTE value, so it is only right when it runs SECOND.
// Applied before the +1 it becomes a base the +1 is then added on top of, and
// one hit reads as two. The visible symptom was the bar reading 1 → 3 → 2. The
// dangerous one was `kills`, computed from `hits` at the trigger: with the count
// inflated the SECOND round satisfied `hits + 1 >= armor`, so the client blew up
// a satellite the server still had alive.
//
// THREE orderings are modelled, because the first fix for this was wrong in a
// way a two-way test could not see:
//
//   response  assign straight from the await — the original bug
//   timer     defer the assignment to a SECOND atImpact() timer. This looks
//             correct and mostly behaves, which is why it shipped: two timeouts
//             armed for the same deadline usually fire in the order they were
//             armed. But the deadlines are not actually the same — both are
//             computed from Date.now(), truncated to whole milliseconds, so the
//             answer's timer can be armed a fraction of a millisecond EARLIER
//             than the impact's own and land first. Sub-millisecond, and so
//             intermittent: same salvo, same latency, and the count jumps by
//             two on maybe one round in several. That is the "sometimes" in the
//             report, and it is what `timerSkew` below dials in.
//   data      what ships now. There is no second timer: the impact sets
//             `landed`, the answer sets `serverHits`, and whichever arrives
//             second runs the reconcile. Ordered by data, not by two clocks.
//
//   node scratchpad/intercept-count-check.mjs
const ARMOR = 3, SHELL_MS = 700, SERVER_MS = 200

// Plays a salvo of all-hits and returns what the bar showed after each round,
// plus the round on which the client believed it had killed the satellite.
//
// `mode`      'response' | 'timer' | 'data'
// `timerSkew` ms the deferred timer lands relative to the impact. Only read in
//             'timer' mode; negative is the sub-millisecond inversion.
// `answerMs`  when the server answers. Only read in 'response' and 'data' mode,
//             where it is the whole point: a fast connection answers long before
//             the bolt lands, a slow one long after, and the shipped ordering
//             has to survive both.
function salvo(mode, timerSkew = +0.5, answerMs = SERVER_MS) {
  let hits = 0
  let server = 0            // what the endpoint would return for this round
  const bar = []
  let clientKillRound = null

  for (let round = 1; round <= ARMOR; round++) {
    // ── trigger: `kills` is read off the count as it stands right now
    const kills = hits + 1 >= ARMOR
    if (kills && clientKillRound === null) clientKillRound = round
    server = Math.min(ARMOR, server + 1)

    // ── the writers, each on the clock its mode gives it
    let landed = false
    let answered = null

    const impact = () => {
      landed = true
      hits = Math.min(ARMOR, hits + 1)
      if (mode === 'data' && answered !== null) hits = answered
    }
    const answer = () => {
      answered = server
      if (mode === 'response') hits = server                       // the bug
      if (mode === 'data' && landed) hits = server                 // gated
    }
    // In 'timer' mode the answer arms a timeout instead of assigning, so it has
    // its own moment on the clock — the one that can invert.
    const events = mode === 'timer'
      ? [{ at: SHELL_MS, run: impact }, { at: SHELL_MS + timerSkew, run: () => { hits = server } }]
      : [{ at: SHELL_MS, run: impact }, { at: answerMs, run: answer }]

    events.sort((a, b) => a.at - b.at)
    for (const e of events) e.run()
    bar.push(hits)
  }
  return { bar, clientKillRound }
}

let fails = 0
const check = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}\n          got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const report = (label, r) =>
  console.log(`  bar after each round: ${JSON.stringify(r.bar)}   client "destroyed" on round ${r.clientKillRound}   (${label})`)

console.log('\n1. reconcile straight from the response — the original bug')
const a = salvo('response')
report('response', a)
check('miscounts every round', a.bar, [2, 3, 3])
check('and calls it destroyed a whole round early', a.clientKillRound, 2)

console.log('\n2. reconcile on its own timer — the fix that mostly worked')
const b1 = salvo('timer', +0.5)
report('timer lands after the impact', b1)
check('correct WHEN THE TIMERS HAPPEN TO ORDER', b1.bar, [1, 2, 3])
const b2 = salvo('timer', -0.5)
report('timer lands before the impact', b2)
check('and identical to the original bug when they do not', b2.bar, [2, 3, 3])
check('same early kill, same cause', b2.clientKillRound, 2)

console.log('\n3. reconcile gated on landed + answered — what ships')
// The gate makes the answer's arrival time irrelevant, so EVERY latency has to
// produce the same salvo. That invariance is the property under test, not the
// numbers on their own — a version that only holds for a fast connection is the
// bug this replaced, wearing a different hat. 1 ms and 5 s bracket anything a
// real connection can do; 700 is the exact tie with the impact.
for (const answerMs of [1, SERVER_MS, SHELL_MS, SHELL_MS + 200, 5000]) {
  const c = salvo('data', +0.5, answerMs)
  report(`answer at ${answerMs} ms`, c)
  check(`${answerMs} ms: the bar counts 1, 2, 3 — one per landed round`, c.bar, [1, 2, 3])
  check(`${answerMs} ms: and it is only destroyed on the third`, c.clientKillRound, ARMOR)
}

console.log(fails ? `\n${fails} FAILED\n` : '\nall assertions hold\n')
process.exit(fails ? 1 : 0)
