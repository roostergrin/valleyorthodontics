import { url } from './api'

/**
 * JSON-LD builders. The site had no structured data at all, while
 * data/globalData.json already carried every field a local-practice schema
 * needs: name, address, coordinates, phone, email and opening hours.
 */

const absolute = (routePath = '/') =>
  `${url}${String(routePath).replace(/^\/+/, '').replace(/\/+$/, '')}`

// "8:30am - 5:00pm" -> { opens: '08:30', closes: '17:00' }; "Closed" -> null
const parseHours = (time) => {
  if (!time || /closed/i.test(time)) { return null }

  const to24h = (raw) => {
    const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    if (!match) { return null }
    const [, hourRaw, minuteRaw, meridiem] = match
    let hour = parseInt(hourRaw, 10)
    if (/pm/i.test(meridiem) && hour !== 12) { hour += 12 }
    if (/am/i.test(meridiem) && hour === 12) { hour = 0 }
    return `${String(hour).padStart(2, '0')}:${minuteRaw || '00'}`
  }

  const [opensRaw, closesRaw] = time.split(/\s*[-–]\s*/)
  const opens = opensRaw && to24h(opensRaw)
  const closes = closesRaw && to24h(closesRaw)

  return opens && closes ? { opens, closes } : null
}

const splitCityState = (cityState = '') => {
  // "San Rafael, CA 94903"
  const match = cityState.match(/^(.*?),\s*([A-Z]{2})\s*(\d{5})?/)
  if (!match) { return { city: cityState, region: undefined, postalCode: undefined } }
  return { city: match[1], region: match[2], postalCode: match[3] }
}

export const buildPracticeSchema = (global) => {
  if (!global) { return null }

  const location = (global.location && global.location[0]) || null
  const address = location && location.address
  const { city, region, postalCode } = splitCityState(address && address.city_state)

  const openingHours = ((location && location.hours) || [])
    .map((entry) => {
      const parsed = parseHours(entry.time)
      if (!parsed) { return null }
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${entry.day}`,
        opens: parsed.opens,
        closes: parsed.closes
      }
    })
    .filter(Boolean)

  const sameAs = ((global.footer && global.footer.social_media) || [])
    .map(link => link.href)
    .filter(Boolean)
    // sameAs must be profile URLs. The footer's "Google" entry is a raw search
    // results URL with tracking params, which is not a profile and would only
    // add noise here.
    .filter(href => !/[?&]q=|\/search\?/.test(href))

  return {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    '@id': `${url}#practice`,
    name: global.company_name,
    url,
    ...(global.phone && global.phone.number && { telephone: global.phone.number }),
    ...(global.email && { email: global.email }),
    ...(address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: [address.street, address.suite].filter(Boolean).join(', '),
        addressLocality: city,
        addressRegion: region,
        postalCode,
        addressCountry: 'US'
      }
    }),
    ...(address && address.coordinates && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: Number(address.coordinates.latitude),
        longitude: Number(address.coordinates.longitude)
      }
    }),
    ...(openingHours.length && { openingHoursSpecification: openingHours }),
    ...(sameAs.length && { sameAs }),
    medicalSpecialty: 'Orthodontic',
    priceRange: '$$'
  }
}

export const buildWebSiteSchema = global => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${url}#website`,
  url,
  name: (global && global.company_name) || 'Valley Orthodontics',
  publisher: { '@id': `${url}#practice` }
})

/**
 * BreadcrumbList from an ordered trail of { name, path }, Home included. Used
 * directly by pages whose trail isn't derivable from the nav (blog posts).
 */
export const buildCrumbList = (trail = []) => {
  if (!trail.length) { return null }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: absolute(entry.path)
    }))
  }
}

/**
 * Pages that sit directly under Home and are deliberately absent from the nav
 * definition, so the router lookup below can't name them.
 */
const OFF_NAV_CRUMBS = {
  '/get-started': 'Get Started',
  '/accessibility': 'Accessibility Statement',
  // The blog listing. Bare /blog redirects here, so /blog/page/1 is the crumb.
  '/blog/page/1': 'Blog'
}

/**
 * Breadcrumbs from router/index.js, which is the nav definition. Only emitted
 * for pages that actually sit under a parent section.
 */
export const buildBreadcrumbSchema = (routePath, router = []) => {
  if (!routePath || routePath === '/') { return null }

  let parent = null
  for (const item of router) {
    if (!item.children) { continue }
    if (item.children.some(child => child.path === routePath)) {
      parent = item
      break
    }
  }

  const current = (parent && parent.children.find(child => child.path === routePath)) ||
    router.find(item => item.path === routePath)

  if (!current) {
    const offNavName = OFF_NAV_CRUMBS[routePath]
    if (!offNavName) { return null }

    return buildCrumbList([
      { name: 'Home', path: '/' },
      { name: offNavName, path: routePath }
    ])
  }

  const trail = [{ name: 'Home', path: '/' }]
  if (parent && parent.path !== routePath) {
    trail.push({ name: parent.name, path: parent.path })
  }
  trail.push({ name: current.name, path: routePath })

  return buildCrumbList(trail)
}

/**
 * FAQPage from the `accordion` sections on a page. Item shape in pages.json is
 * { header, paragraphs: [{ text }] } — Google requires a non-empty answer, so
 * items without body text are skipped.
 */
export const buildFaqSchema = (sections = []) => {
  const stripHtml = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  const questions = (Array.isArray(sections) ? sections : [])
    .filter(section => section && section.acf_fc_layout === 'accordion')
    .flatMap(section => section.accordion || [])
    .map((item) => {
      const question = stripHtml(item.header)
      const answer = (item.paragraphs || [])
        .map(paragraph => stripHtml(paragraph.text))
        .filter(Boolean)
        .join(' ')

      // Must actually be a question. Several pages use this same accordion layout
      // for plain content sections ("METAL BRACES", "Foods to Prepare and Eat"),
      // and marking those up as FAQPage would misrepresent the page to Google.
      if (!question || !answer || !question.trim().endsWith('?')) {
        return null
      }

      return {
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer }
      }
    })
    .filter(Boolean)

  // One lone question is not an FAQ page.
  if (questions.length < 2) {
    return null
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions
  }
}

export const buildArticleSchema = ({ routePath, title, description, image, datePublished, dateModified, companyName }) => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  ...(description && { description }),
  ...(image && { image }),
  // Both must be ISO 8601 for Google to read them; callers pass the WordPress
  // timestamp, never the formatted display date.
  ...(datePublished && { datePublished }),
  ...(dateModified && { dateModified }),
  mainEntityOfPage: absolute(routePath),
  author: { '@type': 'Organization', name: companyName || 'Valley Orthodontics' },
  publisher: { '@id': `${url}#practice` }
})

/**
 * vue-meta script entry for a schema object. Returns [] for a null schema so it
 * can be spread straight into head().script.
 */
export const schemaScript = (hid, schema) => {
  if (!schema) { return [] }
  return [{
    hid,
    type: 'application/ld+json',
    innerHTML: JSON.stringify(schema)
  }]
}
