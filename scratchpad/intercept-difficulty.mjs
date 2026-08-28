// How hard is it, actually? Simulates gunners of varying quality against the
// exact geometry in HsInterceptGame.vue, so the difficulty is a measured number
// rather than a hope. A "gunner" aims at where the satellite will be and misses
// that point by a normally-distributed error in % of field width.
//
// It reports PER STAGE as well as overall, because the escalation means the
// three hits are three different problems and an average hides that — a
// difficulty complaint is almost always about one stage rather than the whole.
//
// A GUNNER MAKES TWO KINDS OF MISTAKE, and the model needs both:
//
//   aim     a fixed positional wobble, in % of field width. Independent of what
//           the target is doing.
//   lead    a proportional misjudgement of the target's SPEED. The lead is
//           speed × SHELL_MS, so this error grows with the speed — which is the
//           only reason a faster satellite is harder to hit at all.
//
// The second one was missing at first and made the tool silently useless for the
// question it was being asked. With aim error alone the simulated gunner predicts
// the impact point perfectly however fast the target moves, so the model reported
// a ×1.0 and a ×1.8 satellite as EQUALLY hard. Any conclusion about the speed
// escalation drawn from that would have been worthless.
//
//   node scratchpad/intercept-difficulty.mjs
//   node scratchpad/intercept-difficulty.mjs '{"sat":5.2,"hit":6.0,...}'   (to try changes)
const D = {
  sat:   4.4,   // SAT_HALF   — half the body's clearance at the walls
  hit:   5.0,   // HIT_HALF   — half the kill box
  shell: 700,   // SHELL_MS   — flight time
  speed: 28,    // BASE_SPEED — % of field width per second
  // Rounds a sortie may fire. There is no SALVO_MAX in the game any more — you
  // fire until the kill or until the cells run out — so this stands for HOW MANY
  // POWER CELLS the planet has in stock when the panel opens. Raise it to model
  // a well supplied planet, drop it to model a bare one.
  salvo: 99,
  mult:  [1, 1.3, 1.65],   // SPEED_BY_HITS
  jinkFrom: 99,            // JINK_FROM_HITS — 99 = never; the target only ever
                           // runs wall to wall, which is what the player asked for
  jinkMin: 800, jinkMax: 1600,
  // How badly a gunner misjudges the target's speed, as a fraction of the lead.
  // 0.12 = a gunner who is 12 % out on how fast it is going.
  leadErr: 0.12,
  ...(process.argv[2] ? JSON.parse(process.argv[2]) : {}),
}
const ARMOR = 3

const gauss = () => {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Same fold-back as satXAt()
const xAt = (leg, t) => {
  const lo = D.sat, hi = 100 - D.sat, span = hi - lo
  const x = leg.x + leg.vx * ((t - leg.at) / 1000)
  return hi - Math.abs(((x - lo) % (2 * span) + 2 * span) % (2 * span) - span)
}

const speedAt = (hits) => D.speed * D.mult[Math.min(hits, D.mult.length - 1)]
const nextJink = (hits, t) =>
  hits >= D.jinkFrom ? t + D.jinkMin + Math.random() * (D.jinkMax - D.jinkMin) : Infinity

// One salvo. `err` = the gunner's aiming error (std-dev, % of width).
// `reaction` = ms between shots, i.e. how long they take to line one up.
// `stage` accumulates { shots, hits } per armour level already taken.
function salvo(startHits, err, reaction, stage) {
  let hits = startHits
  let t = 0
  let leg = { at: 0, x: 20 + Math.random() * 60,
              vx: speedAt(hits) * (Math.random() < 0.5 ? -1 : 1) }
  let jink = nextJink(hits, t)
  let shots = 0

  while (shots < D.salvo && hits < ARMOR) {
    t += reaction
    // jinks that fall due while the gunner is lining up
    while (jink <= t) {
      leg = { at: jink, x: xAt(leg, jink), vx: -leg.vx }
      jink += D.jinkMin + Math.random() * (D.jinkMax - D.jinkMin)
    }
    // The gunner predicts the impact point — but cannot predict a jink that
    // happens during the shell's flight. That is exactly the last stage's bite.
    let l = leg, j = jink
    const impact = t + D.shell
    while (j <= impact) { l = { at: j, x: xAt(l, j), vx: -l.vx }; j += D.jinkMin + Math.random() * (D.jinkMax - D.jinkMin) }
    const truth = xAt(l, impact)
    // Aim wobble, plus a misjudged lead that scales with how fast it is going.
    const lead  = Math.abs(leg.vx) * (D.shell / 1000)
    const aimed = xAt(leg, t + D.shell) + gauss() * err + gauss() * D.leadErr * lead

    shots++
    stage[hits].shots++
    if (Math.abs(truth - aimed) <= D.hit) {
      stage[hits].hits++
      hits++
      leg  = { at: t, x: xAt(leg, t), vx: speedAt(hits) * Math.sign(leg.vx) }
      jink = nextJink(hits, t)
    }
  }
  return { hits, shots }
}

function untilDead(err, reaction, stage) {
  let hits = 0, salvos = 0, cells = 0
  while (hits < ARMOR && salvos < 60) {
    const r = salvo(hits, err, reaction, stage)
    hits = r.hits; cells += r.shots; salvos++
  }
  return { salvos, cells }
}

const N = 4000
console.log(JSON.stringify({ ...D, mult: D.mult }, null, 0), '\n')
console.log('gunner              salvos   cells   1-salvo   hit-rate per stage (0→1, 1→2, 2→3)')
for (const [name, err, reaction, leadErr] of [
  ['careless   ±14 %', 14, 900,  0.30],
  ['average    ±8 %',   8, 1100, 0.16],
  ['good       ±4.5 %', 4.5, 1300, 0.08],
  ['excellent  ±2 %',   2, 1500, 0.03],
]) {
  D.leadErr = leadErr
  const stage = [ {shots:0,hits:0}, {shots:0,hits:0}, {shots:0,hits:0} ]
  let s = 0, c = 0, one = 0
  for (let i = 0; i < N; i++) {
    const r = untilDead(err, reaction, stage)
    s += r.salvos; c += r.cells; if (r.salvos === 1) one++
  }
  const rate = stage.map(x => x.shots ? ((x.hits / x.shots) * 100).toFixed(0).padStart(3) + ' %' : '  — ')
  console.log(
    name.padEnd(20),
    (s / N).toFixed(2).padStart(5),
    (c / N).toFixed(1).padStart(8),
    (((one / N) * 100).toFixed(0) + ' %').padStart(8),
    '  ' + rate.join('   ')
  )
}
