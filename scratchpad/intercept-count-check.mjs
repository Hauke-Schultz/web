// The hit counter had TWO writers racing each other, and this reproduces the
// race rather than trusting a reading of the code.
//
//   at impact (700 ms)   hits += 1        the local prediction
//   on the answer (~200) hits = server    the reconciliation
//
// The server almost always wins the race, so one hit was counted twice: the
// answer set the bar to 1, then the impact handler added its own +1 on top. The
// visible symptom was the bar reading 1 → 3 → 2. The dangerous one was `kills`,
// computed from `hits` at the trigger: with the count inflated the SECOND round
// satisfied `hits + 1 >= armor`, so the client destroyed a satellite the server
// still had alive.
//
//   node scratchpad/intercept-count-check.mjs
const ARMOR = 3, SHELL_MS = 700, SERVER_MS = 200

// Plays a salvo of all-hits and returns what the bar showed after each round,
// plus the round on which the client believed it had killed the satellite.
function salvo({ reconcileAtImpact }) {
  let hits = 0
  let serverHits = 0
  const bar = []
  let clientKillRound = null

  for (let round = 1; round <= ARMOR; round++) {
    // ── trigger
    const kills = hits + 1 >= ARMOR
    if (kills && clientKillRound === null) clientKillRound = round

    // ── the two writes, in the order their clocks put them
    const events = [
      { at: SHELL_MS,  apply: () => { hits = Math.min(ARMOR, hits + 1) } },   // impact
      { at: SERVER_MS, apply: () => { serverHits = Math.min(ARMOR, serverHits + 1) },
        // The buggy version assigned straight from the response; the fixed one
        // defers the same assignment to the impact.
        reconcile: true },
    ]
    for (const e of events) if (e.reconcile) e.at = reconcileAtImpact ? SHELL_MS + 0.5 : SERVER_MS
    events.sort((a, b) => a.at - b.at)

    for (const e of events) {
      e.apply?.()
      if (e.reconcile) {
        // the server's count is what the endpoint would return for this round
        if (reconcileAtImpact) hits = serverHits
        else hits = serverHits            // applied early — this is the bug
      }
    }
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

console.log('\nthe old ordering (reconcile straight from the response)')
const before = salvo({ reconcileAtImpact: false })
console.log(`  bar after each round: ${JSON.stringify(before.bar)}   client "destroyed" on round ${before.clientKillRound}`)
check('...miscounts, which is why this check exists', before.bar, [2, 3, 3])

console.log('\nthe fixed ordering (reconcile deferred to the impact)')
const after = salvo({ reconcileAtImpact: true })
check('the bar counts 1, 2, 3 — one per landed round', after.bar, [1, 2, 3])
check('the client only calls it destroyed on the third round', after.clientKillRound, ARMOR)

console.log(fails ? `\n${fails} FAILED\n` : '\nboth assertions hold\n')
process.exit(fails ? 1 : 0)
