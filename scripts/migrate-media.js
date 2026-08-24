#!/usr/bin/env node
/**
 * Pre-launch media migration: collect every asset still hot-linked from the
 * WordPress install at www.valleyorthodontics.net and stage it for upload to
 * s3://valleyorthodontics/assets/uploads/.
 *
 * The WordPress site is being decommissioned at cutover, so every one of these
 * URLs 404s the moment DNS flips. This script only reads: it downloads to
 * media-staging/ and writes a manifest. Nothing in data/ is touched here —
 * scripts/tokenize-media.js does the JSON rewrite.
 *
 *   node scripts/migrate-media.js            # download + verify + manifest
 *   node scripts/migrate-media.js --dry-run  # list what would be downloaded
 *
 * Path mapping (the wp-content segment is dropped — this is no longer WordPress):
 *   https://www.valleyorthodontics.net/wp-content/uploads/2024/09/foo.webp
 *     -> media-staging/uploads/2024/09/foo.webp
 *     -> s3://valleyorthodontics/assets/uploads/2024/09/foo.webp
 *     -> {{cdn}}/uploads/2024/09/foo.webp
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..')
const STAGING = path.join(ROOT, 'media-staging')
const DATA_FILES = ['pages.json', 'posts.json', 'theme.json', 'globalData.json']
const WP_ORIGIN = 'https://www.valleyorthodontics.net'
const UPLOADS_PREFIX = '/wp-content/uploads/'
const CONCURRENCY = 8

const DRY_RUN = process.argv.includes('--dry-run')

// Content-Type families we accept per extension. A WordPress install that has
// started 404ing returns an HTML error body with a 200 in some configs, so the
// type check is what actually catches a bad download.
const EXPECTED_TYPES = {
  webp: ['image/webp'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  svg: ['image/svg+xml'],
  mp4: ['video/mp4'],
  webm: ['video/webm'],
  pdf: ['application/pdf']
}

/**
 * Every media reference lives in a string somewhere in the JSON — including 21
 * that sit inside <img src="..."> tags in embedded HTML content — so walk all
 * strings rather than a whitelist of image keys.
 */
const collectStrings = (node, out) => {
  if (typeof node === 'string') {
    out.push(node)
  } else if (Array.isArray(node)) {
    node.forEach(child => collectStrings(child, out))
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach(child => collectStrings(child, out))
  }
  return out
}

// Absolute references, plus the one root-relative reference (a PDF linked from
// blog body HTML). Trailing punctuation from surrounding markup is trimmed.
const URL_PATTERNS = [
  new RegExp(`${WP_ORIGIN.replace(/[.]/g, '\\.')}${UPLOADS_PREFIX}[^"'\\\\ )<>]+`, 'g'),
  new RegExp(`(?<![.\\w/])${UPLOADS_PREFIX}[^"'\\\\ )<>]+`, 'g')
]

const findReferences = () => {
  const found = new Map() // absolute source URL -> Set of data files it appears in

  for (const file of DATA_FILES) {
    const abs = path.join(ROOT, 'data', file)
    const strings = collectStrings(JSON.parse(fs.readFileSync(abs, 'utf8')), [])

    for (const str of strings) {
      for (const pattern of URL_PATTERNS) {
        const matches = str.match(pattern) || []
        for (const raw of matches) {
          const cleaned = raw.replace(/[)",.;]+$/, '')
          const absolute = cleaned.startsWith('http') ? cleaned : WP_ORIGIN + cleaned
          if (!found.has(absolute)) { found.set(absolute, new Set()) }
          found.get(absolute).add(file)
        }
      }
    }
  }

  return found
}

const toKeyPath = (sourceUrl) => {
  // .../wp-content/uploads/2024/09/foo.webp -> uploads/2024/09/foo.webp
  const idx = sourceUrl.indexOf(UPLOADS_PREFIX)
  return 'uploads/' + sourceUrl.slice(idx + UPLOADS_PREFIX.length)
}

const download = async (sourceUrl) => {
  const res = await fetch(sourceUrl, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length === 0) {
    throw new Error('zero-length body')
  }

  const ext = path.extname(sourceUrl).slice(1).toLowerCase()
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim()
  const expected = EXPECTED_TYPES[ext]
  if (expected && !expected.includes(contentType)) {
    throw new Error(`content-type "${contentType}" does not match .${ext} (expected ${expected.join('/')})`)
  }

  return { buffer, contentType }
}

const run = async () => {
  const references = findReferences()
  const entries = [...references.keys()].sort()

  console.log(`Found ${entries.length} unique WordPress-hosted assets across ${DATA_FILES.join(', ')}\n`)

  if (DRY_RUN) {
    for (const url of entries) {
      console.log(`  ${toKeyPath(url).padEnd(52)}  <- ${url}`)
    }
    const byExt = {}
    entries.forEach((u) => {
      const e = path.extname(u).slice(1).toLowerCase()
      byExt[e] = (byExt[e] || 0) + 1
    })
    console.log(`\nBy extension: ${Object.entries(byExt).map(([e, n]) => `${e}=${n}`).join(' ')}`)
    console.log('\n--dry-run: nothing downloaded.')
    return
  }

  const manifest = []
  const failures = []
  let done = 0

  const worker = async (queue) => {
    while (queue.length) {
      const sourceUrl = queue.shift()
      const keyPath = toKeyPath(sourceUrl)
      const dest = path.join(STAGING, keyPath)

      try {
        const { buffer, contentType } = await download(sourceUrl)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, buffer)

        manifest.push({
          source: sourceUrl,
          s3Key: `assets/${keyPath}`,
          cdnPath: `{{cdn}}/${keyPath}`,
          bytes: buffer.length,
          contentType,
          sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
          referencedIn: [...references.get(sourceUrl)].sort()
        })
      } catch (e) {
        failures.push({ source: sourceUrl, error: e.message })
      }

      done += 1
      if (done % 20 === 0 || done === entries.length) {
        console.log(`  ${done}/${entries.length}`)
      }
    }
  }

  const queue = [...entries]
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))

  manifest.sort((a, b) => a.s3Key.localeCompare(b.s3Key))
  fs.mkdirSync(STAGING, { recursive: true })
  fs.writeFileSync(
    path.join(STAGING, 'manifest.json'),
    JSON.stringify({ generatedFrom: WP_ORIGIN, count: manifest.length, assets: manifest }, null, 2)
  )

  const totalBytes = manifest.reduce((sum, a) => sum + a.bytes, 0)
  console.log(`\nStaged ${manifest.length} files (${(totalBytes / 1048576).toFixed(1)} MB) into media-staging/`)
  console.log('Manifest: media-staging/manifest.json')

  if (failures.length) {
    console.error(`\n${failures.length} FAILED — do not upload a partial set:`)
    failures.forEach(f => console.error(`  ${f.error}  ${f.source}`))
    process.exit(1)
  }

  console.log('\nAll assets verified (HTTP 200, non-zero, content-type matches extension).')
  console.log('\nNext: aws s3 sync media-staging/uploads/ s3://valleyorthodontics/assets/uploads/ \\')
  console.log('        --cache-control "public, max-age=31536000, immutable" --exclude ".DS_Store"')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
