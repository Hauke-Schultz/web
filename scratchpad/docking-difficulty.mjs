// How hard is the docking approach, actually? Simulates pilots of varying
// quality against the exact physics HsDockingGame.vue runs, so the landing rate
// is a measured number rather than a hope.
//
// THE TARGET IS DELIBERATELY HIGH: ~75 % for an average pilot. An anomaly rolls
// once every ANOMALY_INTERVAL_HOURS = 6, so a player gets ONE attempt every six
// hours and can never practise. That is the opposite of the salvage ring (cast
// again for free) and of intercept (many rounds per sortie), both of which can
// afford to sit near 50 %. A skill game nobody can practise must not punish.
//
// A PILOT MAKES TWO KINDS OF MISTAKE and the model needs both — one error term
// alone makes the tool useless for the question it is being asked, which is the
// lesson intercept-difficulty.mjs learned the hard way:
//
//   judge   a proportional misreading of HOW MUCH ROOM the brake needs. This is
//           the skill the game is about. Above 1 = brakes early and pays in
//           fuel; below 1 = brakes late and arrives hot.
//           DRAWN ONCE PER APPROACH. A pilot has a standing bias in how they
//           read a shaft; they do not re-roll their judgement sixty times a
//           second. The first cut re-rolled it per frame and reported an average
//           pilot at 9 %, because a fresh chance to blunder at every
//           re-evaluation compounds to a near-certain failure that says nothing
//           about the game being played.
//   react   latency in ms on pressing and releasing.
//
// REACTION LATENCY IS THE REASON THE OBVIOUS NUMBERS DO NOT WORK. A pilot who
// reacts L seconds late loses v·L of braking room out of the v²/2n they needed,
// so the shortfall as a FRACTION of the brake is 2nL/v — it grows with thrust
// and shrinks with speed. A punchy thruster therefore makes this a latency test
// rather than a judgement test: the first parameter set (grav 12, thrust 30)
// spent 24 % of the brake on a 260 ms reaction alone and put an average pilot at
// 8 %. The fix is a WEAK thruster held for a LONG time — the braking fraction
// works out to grav/thrust, so thrust ≈ 1.7 × grav brakes over roughly the
// second half of the shaft — which drops the same reaction to about 13 %.
//
// ── What actually stops the obvious exploit ──────────────────────────────────
// A lander judged only on touchdown speed has one degenerate strategy: brake at
// once and CREEP down at walking pace. It has to be answered by a rule, not by
// tuning, because a player finds it on their first attempt.
//
// A closing iris was the first answer and it was the wrong one. Measured, it did
// nothing whatever: at 6.5 s, 7.5 s and 9.0 s the landing rates came out
// IDENTICAL to the decimal, because every approach the model flies is over in
// about 5.3 s. It was a second rule the player would have to learn that changed
// no outcome at all.
//
// THE TANK ALREADY DOES THE JOB, and does it better because it punishes the
// exploit specifically rather than punishing slowness in general. `creeper`
// below is that proof, kept as a permanent regression check: at every tank size
// from 3.0 s to 6.0 s the creeper burns dry and then free-falls the rest of the
// shaft, arriving at 36–43 %/s against a V_MAX of 27. Raising the tank does not
// rescue it — a bigger tank only means it runs out lower down and hits harder.
// So the timeout that remains is a plain "the wreck drifts past" fallback for an
// abandoned tab. It is NOT a difficulty lever and must not be tuned as one.
//
//   node scratchpad/docking-difficulty.mjs
//   node scratchpad/docking-difficulty.mjs '{"vmax":24}'
//   node scratchpad/docking-difficulty.mjs sweep
const D = {
  grav:    12,   // GRAV      — drift toward the dock, % of shaft per s²
  thrust:  20,   // THRUST    — retro burn while held, %/s². Net decel is the
                 //             difference, so the brake is deliberately gentle.
  fuel:    3.5,  // FUEL_S    — seconds of burn in the tank. THE second wall.
  vmax:    27,   // V_MAX     — fastest touchdown that still counts, %/s
  timeout: 20,   // TIMEOUT_S — abandoned-approach fallback, not a lever
}

const DT = 1 / 60
const H  = 100   // shaft height, % — the ship starts at 0 and docks at 100

const gauss = () => {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// One approach. The pilot drifts, then brakes when the room left looks like the
// room the brake needs — misjudged by their standing bias — and releases once
// the ship is nearly stopped rather than sitting on the thruster.
//
// THE THRUSTER ONLY EVER SLOWS THE DRIFT, it never reverses it (`v` is clamped
// at 0). That is a game rule, not a modelling shortcut: it removes the whole
// class of failure where a lander climbs off the top of the screen, and it makes
// the input honestly one-directional — holding is always "less speed", never
// "wrong direction".
function approach(p, cfg) {
  const net  = cfg.thrust - cfg.grav
  const bias = 1 + (p.judge ?? 0) * gauss()
  let y = 0, v = 0, t = 0, fuel = cfg.fuel, burning = false
  let pending = null   // [wantedState, notBefore] — the reaction latency

  while (t < cfg.timeout) {
    const room = H - y
    // Aim to arrive at half the allowance rather than at a dead stop: nobody
    // flies for zero, and a model that did would overstate the brake a pilot
    // actually spends.
    const vt   = cfg.vmax * 0.5
    const need = Math.max(0, (v * v - vt * vt) / (2 * net))

    // `creep` is the exploit, not a pilot: brake from the first frame and hold
    // all the way down. It has no judgement and no latency because it needs
    // neither — that is exactly what makes it worth defending against.
    const want = fuel > 0 && v > vt * 0.4 && (p.creep || room <= need * bias)

    if (p.creep) {
      burning = want
    } else {
      if (want !== burning && pending === null) {
        pending = [want, t + p.react * (0.6 + 0.8 * Math.random()) / 1000]
      }
      if (pending && t >= pending[1]) { burning = pending[0]; pending = null }
    }
    if (burning && fuel <= 0) { burning = false; pending = null }

    v = Math.max(0, v + (cfg.grav - (burning ? cfg.thrust : 0)) * DT)
    if (burning) fuel = Math.max(0, fuel - DT)
    y += v * DT
    t += DT

    if (y >= H) return v <= cfg.vmax ? 'landed' : (fuel <= 0 ? 'dry' : 'hot')
  }
  return 'adrift'
}

const PILOTS = [
  ['careless  ±40 %, 400 ms', { judge: 0.40, react: 400 }],
  ['average   ±22 %, 260 ms', { judge: 0.22, react: 260 }],
  ['good      ±12 %, 180 ms', { judge: 0.12, react: 180 }],
  ['excellent ±5 %,  110 ms', { judge: 0.05, react: 110 }],
]

const N = 30000
const rateOf = (p, cfg) => {
  const c = { landed: 0, hot: 0, dry: 0, adrift: 0 }
  for (let i = 0; i < N; i++) c[approach(p, cfg)]++
  return c
}

if (process.argv[2] === 'sweep') {
  console.log('vmax fuel  careless average    good   excellent   hot/dry (avg)  creeper')
  for (const vmax of [23, 25, 27, 29]) {
    for (const fuel of [3.0, 3.5, 4.5]) {
      const cfg = { ...D, vmax, fuel }
      const r = PILOTS.map(([, p]) => rateOf(p, cfg))
      const l = r.map(c => (100 * c.landed / N).toFixed(0).padStart(7) + ' %').join('')
      const a = r[1]
      const mix = ['hot', 'dry'].map(k => (100 * a[k] / N).toFixed(0)).join('/').padStart(8)
      console.log(String(vmax).padStart(4), String(fuel).padStart(4), l, '  ', mix, '  ',
                  approach({ creep: true }, cfg).padStart(7))
    }
  }
} else {
  const cfg = { ...D, ...(process.argv[2] ? JSON.parse(process.argv[2]) : {}) }
  console.log(`grav ${cfg.grav}  thrust ${cfg.thrust}  fuel ${cfg.fuel}s  vmax ${cfg.vmax}`)
  console.log('pilot                      landed    hot     dry  adrift')
  for (const [name, p] of PILOTS) {
    const c = rateOf(p, cfg)
    const pct = k => (100 * c[k] / N).toFixed(0).padStart(5) + ' %'
    console.log(name.padEnd(24), pct('landed'), pct('hot'), pct('dry'), pct('adrift'))
  }
  // The exploit must never come out 'landed'.
  console.log('\ncreep exploit (brake at once, hold all the way down):',
              approach({ creep: true }, cfg))
}
