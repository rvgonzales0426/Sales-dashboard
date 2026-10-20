import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/* The look was rejected once for glow, gradients and glass. This makes those
 * a failing test instead of a code-review argument. */

const ROOT = resolve('src')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(vue|ts|scss|css)$/.test(name) ? [path] : []
  })
}

const BANNED: [RegExp, string][] = [
  [/drop-shadow/i, 'drop-shadow halo'],
  [/filter:\s*blur|blur\(/i, 'blur glow'],
  [/feGaussianBlur|feDropShadow/i, 'SVG blur / shadow filter'],
  [/<(linear|radial)Gradient/i, 'SVG gradient fill'],
  [/(linear|radial|conic)-gradient\(/i, 'CSS gradient'],
  [/backdrop-filter/i, 'glassmorphism'],
  [/text-shadow/i, 'text glow'],
  [/['"]Inter['"]|\bInter,|Space Grotesk|['"]Roboto['"]|\bRoboto,/, 'banned typeface'],
  [/#00(ff|e5|d4)ff|#0ff\b|cyan/i, 'neon cyan'],
]

/** Comments may name what is banned; code may not use it. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('design guard', () => {
  const all = files(ROOT)

  it.each(BANNED)('nothing in src uses %s (%s)', (pattern) => {
    const offenders = all.filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
  })

  it('instruments and cockpit views cast no shadows at all', () => {
    const scoped = all.filter((f) => /[\\/](instruments|cockpit)[\\/]/.test(f))
    expect(scoped.length).toBeGreaterThan(0)
    const offenders = scoped.filter((file) => /box-shadow/.test(stripComments(readFileSync(file, 'utf8'))))
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
  })

  it('animation is limited to value changes (no keyframes anywhere)', () => {
    const offenders = all.filter((file) => /@keyframes|animation:/.test(stripComments(readFileSync(file, 'utf8'))))
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
  })
})
