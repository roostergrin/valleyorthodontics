#!/usr/bin/env node
/**
 * Fill in the empty `alt` values on content images in data/pages.json.
 *
 *   node scripts/fill-image-alts.js [--dry-run]
 *
 * Only matters now that images actually reach the generated HTML (base-image used
 * to render nothing server-side, so no alt was ever served).
 *
 * Keyed by the image filename, and each string was written after looking at the
 * image. Deliberately NOT filled: the five ~100px transparent icons8 icons in the
 * about-orthodontics accordion. Those sit beside headers that already name the
 * treatment ("METAL BRACES", "CERAMIC BRACES", …), so they are decorative and
 * alt="" is the correct accessible choice rather than a defect.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

const ALTS = {
  // Close-up render of gold brackets and archwire across upper and lower teeth
  '1.png': 'Close-up of Iconix champagne gold brackets and archwire on upper and lower teeth',
  // Young woman resting her chin on her hands, smiling, pink backdrop
  '2.png': 'Smiling patient wearing Iconix champagne gold braces',
  // Dental model with the jaw open, gold braces on both arches
  '3.png': 'Dental model showing Iconix champagne gold braces on both the upper and lower arch',
  // Retail packaging plus handles and disposable tips
  '81pYHR1PheL._SX466_.jpg': 'GumChucks flossing starter pack with two reusable handles and disposable flossing tips',
  // Four team members laughing under a pink neon sign reading "the best smile"
  '9f1f28_754f668a85344e359a0991b7852761f0mv2.webp': 'The Valley Orthodontics team laughing beneath a neon \u201Cthe best smile\u201D sign, holding \u201C#BRACES\u201D and \u201Cshift happens\u201D signs',
  // Typodont teaching model with coloured elastics on the brackets
  'nsplsh_19486c2d339c48c8b9e5d49b0d4250b8mv2.webp': 'Orthodontic teaching model showing metal brackets and an archwire on the upper and lower teeth'
}

const filename = src => String(src || '').split('/').pop()

const filled = []

const walk = (node) => {
  if (Array.isArray(node)) {
    node.forEach(walk)
    return
  }
  if (!node || typeof node !== 'object') { return }

  if (typeof node.src === 'string' && 'alt' in node && node.src && !node.alt) {
    const alt = ALTS[filename(node.src)]
    if (alt) {
      node.alt = alt
      filled.push(`${filename(node.src)}  ->  "${alt}"`)
    }
  }

  Object.values(node).forEach(walk)
}

const file = path.join(ROOT, 'data', 'pages.json')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
walk(data)

const counts = filled.reduce((acc, line) => {
  acc[line] = (acc[line] || 0) + 1
  return acc
}, {})

Object.entries(counts).forEach(([line, n]) => {
  console.log(`  ${n}x  ${line}`)
})
console.log(`\n${filled.length} alt value(s) ${DRY_RUN ? 'would be ' : ''}filled.`)

if (!DRY_RUN) {
  // 2-space indent matches the existing file formatting.
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}
