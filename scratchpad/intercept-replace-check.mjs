// The reported bug, end to end against the live dev API: shoot a satellite down,
// let the spy put a new one in the same orbit, and check the replacement starts
// undamaged instead of inheriting the wreck's record.
const T = process.argv[2]
const PLANET = 209, SPY = 2
const API = 'http://localhost:8000/api/star'
const H = { 'Authorization': `Bearer ${T}`, 'Content-Type': 'application/json' }
const pause = (ms) => new Promise(r => setTimeout(r, ms))

const post = async (path, body) =>
  (await fetch(API + path, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()

const state = async () =>
  (await post('/dev/cheat', { action: 'noop' }).catch(() => null), null)

let fails = 0
const check = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)
}

const shoot = async () => {
  const r = await post('/game/defense/intercept', { planetId: PLANET, targetPlayerId: SPY, hit: true })
  await pause(400)                      // clear of INTERCEPT_MIN_SHOT_MS
  return r
}

console.log('\nplant the first satellite')
await post('/dev/cheat', { action: 'spy_on_me', planetId: PLANET })
await pause(400)

console.log('shoot it down')
let last
for (let i = 1; i <= 3; i++) {
  last = await shoot()
  if (!last.ok) { console.log('  round', i, 'refused:', last.error); continue }
  console.log(`  round ${i}: hits ${last.data.hits}/${last.data.armor}` +
              (last.data.destroyed ? '  → DESTROYED' : ''))
}
check('the third round destroys it', !!last.data?.destroyed, true)
check('nothing left in orbit', last.data?.satellites?.length ?? -1, 0)

console.log('\nthe spy puts a replacement in the same orbit')
await post('/dev/cheat', { action: 'spy_on_me', planetId: PLANET })
await pause(400)

console.log('one round at the replacement — it must survive')
const r = await shoot()
check('the replacement started at 0, so this is hit 1', r.data?.hits ?? -1, 1)
check('...and it is still up there', !!r.data?.destroyed, false)
check('...and the defender still sees it', r.data?.satellites?.length ?? -1, 1)
check('the panel shows its damage as 1 of 3', [r.data?.satellites?.[0]?.hits, r.data?.satellites?.[0]?.armor], [1, 3])

console.log(fails ? `\n${fails} FAILED\n` : '\nall checks passed\n')
process.exit(fails ? 1 : 0)
