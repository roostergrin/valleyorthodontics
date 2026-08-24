#!/usr/bin/env node
/**
 * Rewrite every media reference in data/*.json onto the {{cdn}} token, so no
 * asset URL points at the WordPress install being decommissioned at cutover.
 *
 *   node scripts/tokenize-media.js            # apply
 *   node scripts/tokenize-media.js --dry-run  # report counts only
 *
 * Operates on the raw file text rather than parse/stringify, so formatting and
 * key order are untouched and the diff stays limited to the URLs themselves.
 *
 * Deliberately NOT rewritten here:
 *   - ik.imagekit.io (RoosterGrin's stock library, independent of this domain)
 *   - img.youtube.com thumbnails
 *   - the 6 absolute www.valleyorthodontics.net *page* links (internal links,
 *     handled separately) — the uploads rule cannot match them
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DATA_FILES = ['pages.json', 'posts.json', 'theme.json', 'globalData.json']
const DRY_RUN = process.argv.includes('--dry-run')

const rules = [
  {
    name: 'WordPress uploads (absolute) -> {{cdn}}/uploads/',
    find: /https:\/\/www\.valleyorthodontics\.net\/wp-content\/uploads\//g,
    replace: '{{cdn}}/uploads/'
  },
  {
    name: 'WordPress uploads (root-relative) -> {{cdn}}/uploads/',
    // Guarded so it cannot re-match the absolute form above once that has run.
    find: /(?<!\{\{cdn\}\})(?<![.\w])\/wp-content\/uploads\//g,
    replace: '{{cdn}}/uploads/'
  },
  {
    name: 'hardcoded CloudFront host -> {{cdn}}',
    find: /https:\/\/d1euqd8u2uyjl7\.cloudfront\.net/g,
    replace: '{{cdn}}'
  },
  // Five assets referenced with the wrong extension: each 403s as .png/.src while
  // the real original is already in S3 as .jpg. Data-only fix — nothing to upload.
  {
    name: 'fix clobbered extension treatments-hero.src -> .jpg',
    find: /\{\{cdn\}\}\/treatments\/treatments-hero\.src/g,
    replace: '{{cdn}}/treatments/treatments-hero.jpg'
  },
  {
    name: 'wrong extension -> existing .jpg: carrie-2',
    find: /\{\{cdn\}\}\/meet-the-team\/carrie-2\.png/g,
    replace: '{{cdn}}/meet-the-team/carrie-2.jpg'
  },
  {
    name: 'wrong extension -> existing .jpg: grin-hero',
    find: /\{\{cdn\}\}\/resources\/grin\/grin-hero\.png/g,
    replace: '{{cdn}}/resources/grin/grin-hero.jpg'
  },
  {
    name: 'wrong extension -> existing .jpg: grin-hero-2',
    find: /\{\{cdn\}\}\/resources\/grin\/grin-hero-2\.png/g,
    replace: '{{cdn}}/resources/grin/grin-hero-2.jpg'
  },
  {
    name: 'wrong extension -> existing .jpg: Anna-2',
    find: /\{\{cdn\}\}\/meet-the-team\/Anna-2\.png/g,
    replace: '{{cdn}}/meet-the-team/Anna-2.jpg'
  }
]

let grandTotal = 0

for (const file of DATA_FILES) {
  const abs = path.join(ROOT, 'data', file)
  const before = fs.readFileSync(abs, 'utf8')
  let text = before
  const applied = []

  for (const rule of rules) {
    const hits = (text.match(rule.find) || []).length
    if (hits) {
      text = text.replace(rule.find, rule.replace)
      applied.push(`${hits.toString().padStart(4)}  ${rule.name}`)
      grandTotal += hits
    }
  }

  if (!applied.length) {
    console.log(`${file}: no changes`)
    continue
  }

  // Reparse before writing — a botched replacement must never reach disk.
  try {
    JSON.parse(text)
  } catch (e) {
    console.error(`${file}: rewrite produced invalid JSON, aborting — ${e.message}`)
    process.exit(1)
  }

  console.log(`${file}:`)
  applied.forEach(line => console.log(`  ${line}`))

  if (!DRY_RUN) { fs.writeFileSync(abs, text) }
}

console.log(`\n${grandTotal} references ${DRY_RUN ? 'would be' : ''} rewritten.`)
if (DRY_RUN) { console.log('--dry-run: nothing written.') }
