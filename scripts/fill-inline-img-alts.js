#!/usr/bin/env node
/**
 * Fill empty alt attributes on <img> tags embedded inside HTML content strings in
 * data/pages.json and data/posts.json.
 *
 *   node scripts/fill-inline-img-alts.js [--dry-run]
 *
 * These 13 images bypass BaseImage entirely, so scripts/fill-image-alts.js (which
 * walks image objects) cannot reach them. Each string was written after viewing
 * the image and checking which page or post it sits on.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

const ALTS = {
  // Designer braces brackets — shaped brackets on a coloured backdrop. Named to
  // match the shape names in the surrounding copy on /designer-braces.
  'star.png': 'Super Star designer braces bracket',
  'heart.png': 'Super Heart designer braces bracket',
  'flower.png': 'Flower Power designer braces bracket',
  'diamond.png': 'Super Diamond designer braces bracket',
  'mouse.png': 'Mickey Mouse designer braces bracket',

  // Staff portraits, confirmed against the page each one appears on.
  'image1.jpeg': 'Carrie, Patient Care Coordinator at Valley Orthodontics',
  'image0.jpeg': 'Abi, Dental Assistant at Valley Orthodontics',
  'Alison.webp': 'Alison Mendez, Lead Orthodontic Assistant at Valley Orthodontics',
  'Anna.webp': 'Anna Bacon, Practice Coordinator at Valley Orthodontics',

  // Blog post imagery.
  'AdobeStock_447820503-1.jpeg': 'Carved jack-o’-lantern with braces on its teeth, sitting on a front doorstep',
  'Comprehensive-Orthodontic-Care-for-Kids-Families.png': 'Parent and young child brushing their teeth together at a bathroom mirror',
  'Achieve-a-Confident-Straighter-Smile-with-Advanced-Invisalign-Treatment.png': 'Person smiling while holding a pair of clear aligners',
  'Transform-Your-Smile-with-Modern-Affordable-Braces-for-Kids-Teens-and-Adults.png': 'Close-up of a person placing a clear aligner over their upper teeth'
}

const filled = []

// Matches the JSON-escaped form: <img src=\"…\" alt=\"\">
const IMG = /(<img\s+src=\\"([^"\\]*)\\"\s+alt=\\")(\\")/g

const patch = text => text.replace(IMG, (match, head, src, tail) => {
  const alt = ALTS[String(src).split('/').pop()]
  if (!alt) { return match }
  filled.push(`${String(src).split('/').pop()}  ->  "${alt}"`)
  // Escape for a JSON string inside an HTML attribute.
  return `${head}${alt.replace(/"/g, '\\\\"')}${tail}`
})

for (const file of ['pages.json', 'posts.json']) {
  const abs = path.join(ROOT, 'data', file)
  const before = fs.readFileSync(abs, 'utf8')
  const after = patch(before)

  if (after === before) {
    console.log(`${file}: no changes`)
    continue
  }

  try {
    JSON.parse(after)
  } catch (e) {
    console.error(`${file}: rewrite produced invalid JSON, aborting — ${e.message}`)
    process.exit(1)
  }

  console.log(`${file}: patched`)
  if (!DRY_RUN) { fs.writeFileSync(abs, after) }
}

filled.forEach(line => console.log(`  ${line}`))
console.log(`\n${filled.length} inline alt(s) ${DRY_RUN ? 'would be ' : ''}filled.`)
