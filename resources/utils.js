import axios from 'axios'
import { api, url } from './api'
import { expandCdnTokens } from './cdn'

export const getAllPages = async () => {
  try {
    const getPath = (str) => {
      const regex = /.*\.com/ // eslint-disable-line
      const match = str.match(regex)
      if (match) {
        return str.replace(match[0], '')
      } else {
        return str
      }
    }

    const response = await axios.get(
      `${api}/wp/v2/pages?per_page=100`
    )

    const dataPages = response.headers['x-wp-totalpages']
    let dataArray = response.data
    for (let i = 2; i <= dataPages; i++) {
      const nextPage = await axios.get(
        `${api}/wp/v2/pages?per_page=100&page=${i}`
      )
      dataArray = [...dataArray, ...nextPage.data]
    }

    return dataArray.map(item => ({
      parent: item.parent,
      path: getPath(item.link),
      slug: item.slug,
      title: item.title.rendered,
      ...item.acf
    }))
  } catch (e) {
    console.error(`ERROR getting pages for dev-mode-component-locations: ${e}`)
  }
}

// gets data for all forms
//
// Local mirror first. The WordPress forms endpoint lives on the domain this site
// replaces, so post-cutover every call is a guaranteed failure — and the layout
// fetches forms on every route, which meant one dead request per generated page.
export const getForms = async () => {
  try {
    const local = expandCdnTokens(require('../data/forms.json'))
    if (Array.isArray(local) ? local.length : Object.keys(local).length) {
      return local
    }
  } catch (e) {
    console.warn(`Falling back to the live forms API; local data/forms.json unavailable: ${e}`)
  }
  try {
    const response = await axios.get(
      `${api}/wp/v2/forms?per_page=100`
    )
    const dataPages = response.headers['x-wp-totalpages']
    let dataArray = response.data
    for (let i = 2; i <= dataPages; i++) {
      const nextPage = await axios.get(
        `${api}/wp/v2/forms?per_page=100&page=${i}`
      )
      dataArray = [...dataArray, ...nextPage.data]
    }
    return dataArray.map(item => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      ...item.acf
    }))
  } catch (e) {
    console.warn(`Using local form fallback because the forms API is unavailable: ${e}`)
    return expandCdnTokens(require('../data/forms.json'))
  }
}

// gets data for all custom posts of a specific type
export const getCustomPosts = async (customPostType, total = 100) => {
  // Blog posts are baked into data/posts.json at build time. The live WordPress
  // posts store their body in standard `content` (not ACF), so we mirror them
  // locally in the shape the listing + BlockPost components expect.
  if (customPostType === 'posts') {
    try {
      return expandCdnTokens(require('../data/posts.json'))
    } catch (e) {
      console.warn(`Falling back to live posts API; local data/posts.json unavailable: ${e}`)
    }
  }
  try {
    const response = await axios.get(
      `${api}/wp/v2/${customPostType}?per_page=${total}`
    )
    const dataPages = response.headers['x-wp-totalpages']
    let dataArray = response.data.map(item => ({
      id: item.id,
      title: item.title,
      path: `/${customPostType === 'posts' ? 'blog' : customPostType}/${item.slug}`,
      slug: item.slug,
      category: item.categories ? item.categories[0] : null,
      post: item.acf
    }))
    const currentPosts = { '1': dataArray }
    for (let i = 2; i <= dataPages; i++) {
      const nextPage = await axios.get(
        `${api}/wp/v2/${customPostType}?per_page=${total}&page=${i}`
      )
      const next = nextPage.data.map(item => ({
        id: item.id,
        title: item.title.rendered,
        path: `/${customPostType === 'posts' ? 'blog' : customPostType}/${item.slug}`,
        slug: item.slug,
        category: item.categories ? item.categories[0] : null,
        post: item.acf
      }))
      dataArray = [...dataArray, ...next]
      currentPosts[`${i}`] = next
    }
    const sortedDataArr = dataArray.sort((a, b) => {
      const aDate = new Date(a.date)
      const bDate = new Date(b.date)
      return bDate - aDate
    })

    const data = {
      posts: sortedDataArr,
      postsPerPage: currentPosts,
      pageCount: dataPages
    }
    return data
  } catch (e) {
    console.error(`ERROR getting ${customPostType} posts: ${e}`)
  }
}

export const getThemeJSON = () => {
  return expandCdnTokens(require('../data/theme.json'))
}

export const setJSONData = (slug, customPostType = 'pages') => {
  try {
    slug = slug.toLowerCase()
    // Using require ensures data is included at build time for static generation
    const jsonData = require(`../data/${customPostType}.json`)
    if (slug === 'global') {
      return expandCdnTokens(jsonData)
    }

    // Get the pages data - pages.json has { pages: {...}, sitemap_metadata: {...} }
    const pagesData = jsonData.pages || jsonData

    // Get the data array for this slug - make it case insensitive
    const slugData = pagesData[slug] ||
                    Object.keys(pagesData).find(key => key.toLowerCase() === slug)
      ? pagesData[Object.keys(pagesData).find(key => key.toLowerCase() === slug)]
      : undefined
    let seoData = {}
    let pageSections = []

    // If slugData is an array, process it
    if (Array.isArray(slugData)) {
      // Extract SEO object from the array if it exists
      pageSections = slugData.filter(item => !item.seo)
      const seoItem = slugData.find(item => item.seo)
      if (seoItem) {
        seoData = seoItem
      }
    } else {
      // If not an array, use as is
      pageSections = slugData
    }

    const item = {
      title: slug,
      sections: expandCdnTokens(pageSections),
      meta: expandCdnTokens(seoData)
    }
    if (!item) {
      console.error(`No item found with slug: ${slug} in ${customPostType}.json`)
      return {} // Return empty object instead of throwing to avoid build failures
    }

    return item
  } catch (error) {
    console.error(`Error loading data for ${slug}:`, error.message)
    return {} // Return empty object instead of throwing to avoid build failures
  }
}

export const setData = async (slug, customPostType = 'pages') => {
  // Blog post detail pages read from the local data/posts.json mirror so the
  // static build doesn't depend on the (empty) live ACF for posts.
  if (customPostType === 'posts') {
    try {
      const local = expandCdnTokens(require('../data/posts.json'))
      const item = (local.posts || []).find(p => p.slug === slug)
      if (item) {
        return { title: item.title, slug: item.slug, ...item.post }
      }
    } catch (e) {
      console.warn(`Falling back to live post API for ${slug}: ${e}`)
    }
  }
  try {
    const response = await axios.get(
      `${api}/wp/v2/${customPostType}?slug=${slug}`
    )

    const data = {
      title: response.data[0].title.rendered,
      slug: response.data[0].slug,
      ...response.data[0].acf
    }
    return { ...data }
  } catch (e) {
    console.error(`${slug} page: ${e}`)
  }
}

// Routes that exist in the build but must never be indexed. Kept here (rather
// than in config/routes.config.js) because that module reads the filesystem and
// cannot be bundled for the client.
const NOINDEX_PATHS = ['/404', '/blog', '/thank-you']

/**
 * Absolute URL for a route path. `url` carries a trailing slash, so the leading
 * slash is stripped and '/' collapses to the bare origin.
 */
const absoluteUrl = (routePath = '') => {
  const clean = String(routePath).replace(/^\/+/, '').replace(/\/+$/, '')
  return `${url}${clean}`
}

export const setMeta = (meta) => {
  // Get the SEO data from either meta.seo or meta.meta.seo
  const seoData = meta.seo || (meta.meta && meta.meta.seo) || {}

  // Prefer the real route path. `meta.slug` is the legacy input and was wrong in
  // three ways: absent on the six file-based pages (so /about, /contact, /faq,
  // /get-started and /treatments all canonicalized to the homepage), missing the
  // `blog/` prefix on posts (so all 15 canonicalized to legacy WordPress URLs
  // that 301 straight back to the post), and hardcoded to 'blog' on pagination.
  const routePath = meta.path || (meta.slug ? `/${meta.slug}` : '/')
  const canonical = absoluteUrl(routePath)

  // Blog posts are articles; the listing and pagination are not.
  const isArticle = /^\/blog\/(?!page\/)./.test(routePath)
  const noIndex = seoData.noindex === true || NOINDEX_PATHS.includes(routePath.replace(/\/+$/, '') || '/')
  const ogImage = seoData.social_meta?.og_meta?.image

  return {
    title: seoData.page_title ? seoData.page_title : meta.title,
    meta: [
      noIndex && { hid: 'robots', name: 'robots', content: 'noindex, follow' },
      seoData.page_description && { hid: 'description', name: 'description', content: seoData.page_description },
      seoData.page_keywords && { hid: 'keywords', name: 'keywords', content: seoData.page_keywords },
      // OG Meta
      { hid: 'og:type', property: 'og:type', content: isArticle ? 'article' : 'website' },
      seoData.page_title && { hid: 'og:title', property: 'og:title', content: seoData.social_meta?.og_meta?.title ? seoData.social_meta.og_meta.title : seoData.page_title },
      seoData.page_description && { hid: 'og:description', property: 'og:description', content: seoData.social_meta?.og_meta?.description ? seoData.social_meta.og_meta.description : seoData.page_description },
      ogImage && { hid: 'og:image', property: 'og:image', content: ogImage },
      { hid: 'og:url', property: 'og:url', content: canonical },
      // Twitter cards
      { hid: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
      seoData.page_title && { hid: 'twitter:title', name: 'twitter:title', content: seoData.social_meta?.og_meta?.title ? seoData.social_meta.og_meta.title : seoData.page_title },
      seoData.page_description && { hid: 'twitter:description', name: 'twitter:description', content: seoData.social_meta?.og_meta?.description ? seoData.social_meta.og_meta.description : seoData.page_description },
      ogImage && { hid: 'twitter:image', name: 'twitter:image', content: ogImage }
    // Drop falsy entries (missing description/keywords/og:image) so vue-meta
    // doesn't try to read `.hid` off an undefined array element.
    ].filter(Boolean),
    link: [
      { hid: 'canonical', rel: 'canonical', href: canonical }
    ].filter(Boolean)
  }
}
