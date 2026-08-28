// Finds identifiers a Vue SFC USES but never declares — the one class of bug
// that walks straight past both of this project's usual gates.
//
// It exists because it happened: a refactor of HsInterceptGame's fire() removed
// the definition of `atImpact` while leaving the call. `@vue/compiler-sfc`
// compiled it, `nuxt build` built it, and the game shipped able to fire exactly
// one shot — the ReferenceError was thrown after `busy = true` and before the
// request went out, so the gate never reopened. Neither gate can see this:
// compiling checks syntax, and bundling does not resolve module-internal names.
//
//   node scratchpad/vue-undefined-check.mjs                 # all hawk-star SFCs
//   node scratchpad/vue-undefined-check.mjs path/to/One.vue
//
// It is a scope check, not a type checker: it reports a name that is referenced
// with no binding anywhere in the file and no match in the globals list below.
// False positives are cheap to silence — add the global.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// This script lives in scratchpad/, which has no node_modules of its own, and
// node resolves bare imports relative to the FILE rather than the cwd. So the
// two compiler deps are resolved explicitly against frontend/, the same way the
// other checks in here reach the toolchain. `pathToFileURL` rather than a hand
// built 'file://' + path: on Windows the drive letter and the backslashes both
// need escaping, and getting that wrong is a worse bug than the one this script
// is here to catch.
const ROOT = path.resolve(process.argv[1], '../../frontend')
const req = createRequire(path.join(ROOT, 'package.json'))
const { parse, compileScript } = await import(pathToFileURL(req.resolve('@vue/compiler-sfc')).href)
const acorn = req('acorn')

const GLOBALS = new Set([
  // JS
  'undefined','NaN','Infinity','globalThis','console','Math','JSON','Date','Object','Array',
  'String','Number','Boolean','Promise','Set','Map','WeakMap','WeakSet','Symbol','RegExp',
  'Error','TypeError','RangeError','parseInt','parseFloat','isNaN','isFinite','BigInt','Intl',
  'setTimeout','clearTimeout','setInterval','clearInterval','queueMicrotask','structuredClone',
  // browser
  'window','document','navigator','location','history','localStorage','sessionStorage','fetch',
  'requestAnimationFrame','cancelAnimationFrame','performance','CustomEvent','Event','URL',
  'IntersectionObserver','ResizeObserver','MutationObserver','AbortController','Image','Audio',
  'getComputedStyle','matchMedia','crypto','FormData','Blob','FileReader','DOMParser',
  // Nuxt / Vue auto-imports
  'defineProps','defineEmits','defineExpose','defineOptions','defineModel','withDefaults',
  'definePageMeta','defineNuxtComponent','useNuxtApp','useRoute','useRouter','useState',
  'useRuntimeConfig','useHead','useSeoMeta','useFetch','useAsyncData','useCookie','navigateTo',
  'useI18n','useLocalePath','useSwitchLocalePath','useLocaleHead','useRequestHeaders',
  'ref','computed','reactive','watch','watchEffect','onMounted','onUnmounted','onBeforeUnmount',
  'nextTick','shallowRef','toRaw','markRaw','provide','inject','useTemplateRef','useSlots',
  'useAttrs','h','Teleport','Transition','KeepAlive','Suspense','onActivated','onDeactivated',
])

// Every name this file binds, anywhere, at any depth. Deliberately flat: the aim
// is "is this name defined at all in this module", not "is it in scope here",
// which keeps the walker small and makes false NEGATIVES the only failure mode.
function collectBindings(node, out) {
  const walk = (n) => {
    if (!n || typeof n.type !== 'string') return
    switch (n.type) {
      case 'VariableDeclarator': bindPattern(n.id, out); break
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (n.id) out.add(n.id.name)
        for (const p of n.params) bindPattern(p, out)
        break
      case 'ClassDeclaration': if (n.id) out.add(n.id.name); break
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
      case 'ImportSpecifier': out.add(n.local.name); break
      case 'CatchClause': if (n.param) bindPattern(n.param, out); break
      case 'LabeledStatement': out.add(n.label.name); break
    }
    for (const k of Object.keys(n)) {
      const v = n[k]
      if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c))
      else if (v && typeof v.type === 'string') walk(v)
    }
  }
  walk(node)
}

function bindPattern(p, out) {
  if (!p) return
  switch (p.type) {
    case 'Identifier': out.add(p.name); break
    case 'ObjectPattern': p.properties.forEach(pr =>
      bindPattern(pr.type === 'RestElement' ? pr.argument : pr.value, out)); break
    case 'ArrayPattern': p.elements.forEach(e => bindPattern(e, out)); break
    case 'AssignmentPattern': bindPattern(p.left, out); break
    case 'RestElement': bindPattern(p.argument, out); break
  }
}

// Identifiers actually READ — skipping property keys, member accessors and
// anything in a binding position, which the pass above already covered.
function collectReferences(node, out) {
  const walk = (n, parent, key) => {
    if (!n || typeof n.type !== 'string') return
    if (n.type === 'Identifier') {
      const skip =
        (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
        (parent?.type === 'Property' && key === 'key' && !parent.computed) ||
        (parent?.type === 'MethodDefinition' && key === 'key') ||
        parent?.type === 'ImportSpecifier' || parent?.type === 'ImportDefaultSpecifier' ||
        parent?.type === 'ImportNamespaceSpecifier' || parent?.type === 'ExportSpecifier' ||
        parent?.type === 'LabeledStatement' || parent?.type === 'BreakStatement' ||
        parent?.type === 'ContinueStatement'
      if (!skip) out.set(n.name, n.loc?.start.line ?? 0)
      return
    }
    for (const k of Object.keys(n)) {
      const v = n[k]
      if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, n, k))
      else if (v && typeof v.type === 'string') walk(v, n, k)
    }
  }
  walk(node, null, null)
}

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const { descriptor, errors } = parse(src, { filename: file })
  if (errors.length) return [{ name: '(parse error)', line: 0, detail: errors[0].message }]
  if (!descriptor.scriptSetup && !descriptor.script) return []

  const compiled = compileScript(descriptor, { id: 'x' })
  let ast
  try {
    ast = acorn.parse(compiled.content, {
      ecmaVersion: 'latest', sourceType: 'module', locations: true, allowAwaitOutsideFunction: true,
    })
  } catch (e) {
    return [{ name: '(parse error)', line: 0, detail: e.message }]
  }

  const bound = new Set()
  collectBindings(ast, bound)
  const refs = new Map()
  collectReferences(ast, refs)

  const bad = []
  for (const [name, line] of refs) {
    if (bound.has(name) || GLOBALS.has(name) || name.startsWith('_')) continue
    bad.push({ name, line })
  }
  return bad
}

const targets = process.argv[2]
  ? [path.resolve(process.argv[2])]
  : fs.readdirSync(path.join(ROOT, 'app/components/hawk-star'))
      .filter(f => f.endsWith('.vue'))
      .map(f => path.join(ROOT, 'app/components/hawk-star', f))

let failed = 0
for (const file of targets) {
  const bad = checkFile(file)
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')
  if (!bad.length) { console.log(`  ok    ${rel}`); continue }
  failed++
  console.log(`  FAIL  ${rel}`)
  for (const b of bad) console.log(`          ${b.name}${b.detail ? ' — ' + b.detail : ''}`)
}
console.log(failed ? `\n${failed} file(s) reference something they never define\n`
                   : `\n${targets.length} file(s) clean\n`)
process.exit(failed ? 1 : 0)
