// THE SPRITE MUST ALWAYS BE NARROWER THAN THE KILL BOX.
//
// A round that visibly clips the dish and does not count is the one unfairness
// this game cannot afford, and it is a sizing bug waiting to happen: the hit
// test is a percentage of the field's width, so the drawn satellite has to be a
// percentage of the same width or the two drift apart the moment the field is
// resized. The game moved out of a 30 rem lightbox into a tile column of
// whatever width the layout feels like — which is exactly when a rem-sized
// sprite starts overflowing its own kill box.
//
// So this asserts two things about `.hs-icept-sat`:
//
//   1. it is sized in `cqw`, a percentage of the field, and that percentage
//      leaves the dish inside the box;
//   2. it carries NO rem fallback. A fallback sounds prudent and is the trap:
//      measured across the column widths this panel can occupy, 1.9rem overflows
//      the box everywhere from 13 rem to 30 rem. Without container-query support
//      the declaration is invalid and the glyph inherits the panel's font size,
//      which is far smaller than the box — survivable, where "wider than the box
//      that counts the hit" is not.
//
//   node scratchpad/intercept-sprite-check.mjs
import fs from 'node:fs'
import path from 'node:path'

const FILE = path.resolve(process.argv[1],
  '../../frontend/app/components/hawk-star/HsInterceptGame.vue')
const src = fs.readFileSync(FILE, 'utf8')

const satBlock = src.match(/\.hs-icept-sat \{[\s\S]*?\n\}/)
if (!satBlock) throw new Error('could not find the .hs-icept-sat rule')

const hitHalf = src.match(/const HIT_HALF\s*=\s*([\d.]+)/)
if (!hitHalf) throw new Error('could not read HIT_HALF')
const HIT_HALF = parseFloat(hitHalf[1])

const cqw = satBlock[0].match(/font-size:\s*([\d.]+)cqw/)
const rem = satBlock[0].match(/font-size:\s*([\d.]+)rem/)

// An emoji's advance width sits a shade above its font-size on most stacks.
// 1.05 makes the check err against us.
const GLYPH = 1.05

let fails = 0
const check = (what, ok, detail) => {
  if (!ok) fails++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? '  — ' + detail : ''}`)
}

console.log(`\n  HIT_HALF = ${HIT_HALF} %  (kill box ${HIT_HALF * 2} % of the field)\n`)

check('the satellite is sized in container units', !!cqw,
  cqw ? `${cqw[1]}cqw` : 'no cqw font-size found')

if (cqw) {
  const half = (parseFloat(cqw[1]) * GLYPH) / 2
  check('...and the dish stays inside the kill box at every width',
    half < HIT_HALF, `half-width ${half.toFixed(2)} % vs ${HIT_HALF} %`)
}

check('there is no rem fallback to overflow the box', !rem,
  rem ? `found ${rem[1]}rem — see the note at the top of this file` : 'none, as intended')

// What that fallback would have cost, kept as the evidence for rule 2.
if (rem) {
  console.log('\n  what the rem fallback would draw:')
  for (const col of [13, 16, 20, 24, 30]) {
    const px = col * 16
    const half = ((parseFloat(rem[1]) * 16 * GLYPH) / px) * 100
    console.log(`      column ${String(col).padStart(2)} rem  →  half-width ${half.toFixed(2)} % ` +
                `${half < HIT_HALF ? 'ok' : 'OVERFLOWS'}`)
  }
}

console.log(fails ? `\n${fails} check(s) failed\n`
                  : '\nthe kill box is wider than the dish, at any column width\n')
process.exit(fails ? 1 : 0)
