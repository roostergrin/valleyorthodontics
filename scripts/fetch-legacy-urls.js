#!/usr/bin/env node
/**
 * Capture the live WordPress site's indexed URLs and attachment parentage into
 * committed fixtures, so the redirect map is derived from what is actually
 * indexed rather than from what happens to exist locally.
 *
 *   node scripts/fetch-legacy-urls.js
 *
 * Writes:
 *   test/fixtures/legacy-urls.json     every <loc> in every sub-sitemap
 *   test/fixtures/legacy-parents.json  attachment path -> parent page/post slug
 *
 * Re-run this close to launch: if the old site publishes anything new, the map
 * needs to know. Uses node:https so it works on the Node 14 that is still on
 * some machines here (global fetch needs 18+).
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

const ROOT = path.join(__dirname, '..')
const ORIGIN = 'https://www.valleyorthodontics.net'
const SITEMAPS = ['page', 'post', 'category', 'attachment']
// The site 403s the default agent.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const get = (url, redirects = 0) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'user-agent': UA, accept: '*/*' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
      res.resume()
      return get(new URL(res.headers.location, url).toString(), redirects + 1).then(resolve, reject)
    }
    if (res.statusCode !== 200) {
      res.resume()
      return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
    }
    let body = ''
    res.setEncoding('utf8')
    res.on('data', (chunk) => { body += chunk })
    res.on('end', () => resolve(body))
  }).on('error', reject)
})

// <loc> values are CDATA-wrapped by All in One SEO, and <image:loc> siblings must
// not be picked up — hence matching the exact <loc> tag rather than any "loc".
const extractLocs = xml => xml
  .replace(/\r/g, '')
  .split('\n')
  .filter(line => line.includes('<loc>'))
  .map(line => line
    .replace(/.*<loc>(<!\[CDATA\[)?/, '')
    .replace(/(\]\]>)?<\/loc>.*/, '')
    .trim())
  .filter(Boolean)

const toPath = (url) => {
  const p = String(url).replace(/^https?:\/\/[^/]+/, '')
  return p || '/'
}

const norm = p => (String(p).split(/[#?]/)[0].replace(/\/+$/, '') || '/').toLowerCase()

const getAll = async (endpoint, fields) => {
  const out = []
  for (let page = 1; page <= 10; page++) {
    let batch
    try {
      batch = JSON.parse(await get(`${ORIGIN}/wp-json/wp/v2/${endpoint}?per_page=100&page=${page}&_fields=${fields}`))
    } catch (e) {
      break
    }
    if (!Array.isArray(batch) || !batch.length) { break }
    out.push(...batch)
    if (batch.length < 100) { break }
  }
  return out
}

const run = async () => {
  const urls = {}
  for (const name of SITEMAPS) {
    const xml = await get(`${ORIGIN}/${name}-sitemap.xml`)
    urls[name] = [...new Set(extractLocs(xml).map(toPath))].sort()
    console.log(`  ${name}-sitemap.xml`.padEnd(28) + `${urls[name].length} urls`)
  }

  const [media, pages, posts] = await Promise.all([
    getAll('media', 'id,slug,link,post,mime_type'),
    getAll('pages', 'id,slug'),
    getAll('posts', 'id,slug')
  ])
  console.log(`  wp/v2/media`.padEnd(28) + `${media.length} items`)
  console.log(`  wp/v2/pages`.padEnd(28) + `${pages.length} items`)
  console.log(`  wp/v2/posts`.padEnd(28) + `${posts.length} items`)

  const pageSlug = new Map(pages.map(p => [p.id, p.slug]))
  const postSlug = new Map(posts.map(p => [p.id, p.slug]))

  // attachment path -> what it is, and what it belongs to.
  //
  // mimeType is the field that matters. On the live WordPress site, attachment
  // pages for images and videos already 301 to the raw file, so they were never
  // indexable pages and hold no page-level equity. Documents (PDFs) are the
  // exception worth redirecting: people bookmark and share those.
  const parents = {}
  for (const item of media) {
    if (!item.link) { continue }
    const slug = item.post ? (pageSlug.get(item.post) || postSlug.get(item.post)) : null
    parents[norm(toPath(item.link))] = {
      mimeType: item.mime_type || null,
      ...(slug ? { slug, type: pageSlug.has(item.post) ? 'page' : 'post' } : {})
    }
  }

  const total = Object.values(urls).reduce((n, list) => n + list.length, 0)

  fs.writeFileSync(path.join(ROOT, 'test', 'fixtures', 'legacy-urls.json'), JSON.stringify({
    _comment: 'Every URL indexed on the WordPress site being replaced, captured from its LIVE sitemaps. Attachment pages are the bulk of this and were not covered by the original static/_redirects. Regenerate with: node scripts/fetch-legacy-urls.js',
    _source: `${ORIGIN}/sitemap.xml`,
    _capturedAt: new Date().toISOString().slice(0, 10),
    _total: total,
    pages: urls.page,
    posts: urls.post,
    categories: urls.category,
    attachments: urls.attachment
  }, null, 2) + '\n')

  fs.writeFileSync(path.join(ROOT, 'test', 'fixtures', 'legacy-parents.json'), JSON.stringify({
    _comment: 'Attachment page path -> its mime type and parent page/post, from /wp/v2/media. mimeType is what decides whether an attachment URL is worth redirecting: image/video attachment pages already 301 to the raw file on the live WordPress site, so they never held page equity.',
    _capturedAt: new Date().toISOString().slice(0, 10),
    parents
  }, null, 2) + '\n')

  console.log(`\n  total indexed URLs captured: ${total}`)
  const docs = Object.values(parents).filter(v => v.mimeType === 'application/pdf').length
  console.log(`  media records captured: ${Object.keys(parents).length} (${docs} PDFs)`)
  console.log('\nWrote test/fixtures/legacy-urls.json and test/fixtures/legacy-parents.json')
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
