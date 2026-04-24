import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const swPath = resolve(root, 'public/sw.js')

const version = Date.now().toString()
const sw = readFileSync(swPath, 'utf8')
const updated = sw.replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`)

writeFileSync(swPath, updated)
console.log(`[sw] version bumped → ${version}`)
