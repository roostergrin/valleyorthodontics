#!/usr/bin/env node
/**
 * HEAD every CDN asset the build references and report anything that does not
 * return 200. Run after `npm run generate` and after the S3 upload.
 *
 *   node scripts/verify-cdn-assets.js
 *
 * Exits non-zero if anything is missing, so it can gate a deploy.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const CDN = 'https://d1euqd8u2uyjl7.cloudfront.net'
const CONCURRENCY = 12

const collect = () => {
  const urls = new Set()
  const pattern = new RegExp(`${CDN.replace(/[.]/g, '\\.')}/[^"'\\\\ )<>]+`, 'g')

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(html|js|json|xml)$/.test(entry.name)) { continue }
      const text = fs.readFileSync(full, 'utf8')
      for (const match of text.match(pattern) || []) {
        urls.add(match.replace(/[)",.;]+$/, ''))
      }
    }
  }

  if (!fs.existsSync(DIST)) {
    console.error('dist/ not found — run npm run generate first.')
    process.exit(1)
  }

  walk(DIST)
  return [...urls].sort()
}

const run = async () => {
  // Node 14 is still the default on some machines here, and its lack of a global
  // fetch otherwise shows up as "fetch is not defined" once per URL.
  if (typeof fetch !== 'function') {
    console.error(`Needs Node 18+ for global fetch (running ${process.version}).`)
    console.error('Either switch Node, or check with curl:')
    console.error("  grep -rhoE 'https://d1euqd8u2uyjl7[^\"]+' dist --include='*.html' | sort -u \\")
    console.error("    | xargs -P 12 -n 1 curl -s -o /dev/null -w '%{http_code} %{url_effective}\\n' --head")
    process.exit(1)
  }

  const urls = collect()
  console.log(`Checking ${urls.length} CDN assets referenced by dist/…\n`)

  const missing = []
  let done = 0

  const worker = async (queue) => {
    while (queue.length) {
      const url = queue.shift()
      let status = 0
      try {
        const res = await fetch(url, { method: 'HEAD' })
        status = res.status
      } catch (e) {
        status = `ERR ${e.message}`
      }
      if (status !== 200) { missing.push({ url, status }) }
      done += 1
      if (done % 50 === 0 || done === urls.length) { console.log(`  ${done}/${urls.length}`) }
    }
  }

  const queue = [...urls]
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))

  if (!missing.length) {
    console.log('\nAll referenced CDN assets return 200.')
    return
  }

  // Split by whether the key is part of the pre-launch upload batch.
  const pendingUpload = missing.filter(m => m.url.includes('/uploads/'))
  const other = missing.filter(m => !m.url.includes('/uploads/'))

  console.log(`\n${missing.length} asset(s) not returning 200:\n`)
  if (pendingUpload.length) {
    console.log(`  ${pendingUpload.length} under /uploads/ — the migrated batch. Upload with:`)
    console.log('    aws s3 sync media-staging/uploads/ s3://valleyorthodontics/assets/uploads/ \\')
    console.log('      --cache-control "public, max-age=31536000, immutable" --exclude ".DS_Store"\n')
    pendingUpload.slice(0, 5).forEach(m => console.log(`      ${m.status}  ${m.url}`))
    if (pendingUpload.length > 5) { console.log(`      … and ${pendingUpload.length - 5} more`) }
  }
  if (other.length) {
    console.log(`\n  ${other.length} outside /uploads/ — these need individual attention:`)
    other.forEach(m => console.log(`      ${m.status}  ${m.url}`))
  }
  process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
