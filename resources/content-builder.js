import pagesJSON from '~/data/pages.json'
import router from '~/router'

export const contentDraftStorageKey = 'rg-content-drafts-v1'
export const contentDraftStorageVersion = 'content-drafts-data-1'

const clone = value => JSON.parse(JSON.stringify(value))

const pageData = pagesJSON.pages || pagesJSON

const normalizeKey = value => String(value || '').trim().toLowerCase()

const slugify = value => normalizeKey(value)
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')

const flattenRoutes = (routes, result = []) => {
  routes.forEach((route) => {
    if (route.name && route.path && !route.path.startsWith('#')) {
      result.push({ title: route.name, path: route.path })
    }

    if (route.children) {
      flattenRoutes(route.children, result)
    }
  })

  return result
}

const pageKeyForTitle = title => Object.keys(pageData)
  .find(key => normalizeKey(key) === normalizeKey(title))

const fallbackPath = key => normalizeKey(key) === 'home' ? '/' : `/${slugify(key)}`

export const createBuilderId = (prefix = 'item') => {
  const random = Math.random().toString(36).slice(2, 9)

  return `${prefix}-${Date.now().toString(36)}-${random}`
}

const withBuilderIds = (value, prefix = 'item', seed = 'root') => {
  if (Array.isArray(value)) {
    return value.map((item, index) => withBuilderIds(item, prefix, `${seed}-${index}`))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const result = Object.keys(value).reduce((object, key) => {
    object[key] = withBuilderIds(value[key], key, `${seed}-${key}`)
    return object
  }, {})

  if (value.acf_fc_layout && !result.__builder_id) {
    result.__builder_id = `${prefix}-${slugify(seed)}-${slugify(value.acf_fc_layout)}`
  }

  return result
}

export const getPageCatalog = () => {
  const routes = flattenRoutes(router)
  const catalog = []

  Object.keys(pageData).forEach((key) => {
    const route = routes.find(item => pageKeyForTitle(item.title) === key)

    catalog.push({
      key,
      title: key,
      path: route ? route.path : fallbackPath(key)
    })
  })

  return catalog.sort((a, b) => {
    if (a.path === '/') {
      return -1
    }
    if (b.path === '/') {
      return 1
    }
    return a.title.localeCompare(b.title)
  })
}

export const getPageKeyForPath = (path) => {
  const normalizePath = value => String(value || '/').replace(/\/$/, '') || '/'
  const normalizedPath = normalizePath(path)
  const page = getPageCatalog().find(item => normalizePath(item.path) === normalizedPath)

  return page ? page.key : null
}

export const getBasePage = (key) => {
  const resolvedKey = Object.keys(pageData).find(item => normalizeKey(item) === normalizeKey(key))
  const records = resolvedKey && Array.isArray(pageData[resolvedKey]) ? pageData[resolvedKey] : []
  const seoRecord = records.find(record => record && record.seo)

  return {
    key: resolvedKey || key,
    sections: withBuilderIds(records.filter(record => record && !record.seo), 'section', slugify(resolvedKey || key)),
    seo: clone(seoRecord ? seoRecord.seo : {})
  }
}

export const readContentDrafts = () => {
  return readContentDraftState().pages
}

export const readContentDraftState = () => {
  if (typeof window === 'undefined') {
    return { pages: {}, savedAt: {} }
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(contentDraftStorageKey))

    if (!stored || stored.version !== contentDraftStorageVersion || !stored.pages) {
      return { pages: {}, savedAt: {} }
    }

    return {
      pages: stored.pages,
      savedAt: stored.savedAt || {}
    }
  } catch (error) {
    window.localStorage.removeItem(contentDraftStorageKey)
    return { pages: {}, savedAt: {} }
  }
}

export const writeContentDrafts = (pages, savedAt = {}) => {
  if (!Object.keys(pages).length) {
    window.localStorage.removeItem(contentDraftStorageKey)
    return
  }

  window.localStorage.setItem(contentDraftStorageKey, JSON.stringify({
    version: contentDraftStorageVersion,
    pages,
    savedAt
  }))
}

const sharedOptions = () => ({
  hash: '',
  component_padding: 'half',
  component_margins: 'none',
  hide_component: false
})

const emptyImage = () => ({
  src: '',
  webp: '',
  alt: '',
  aria_hidden: false,
  bgColor: '',
  imageBackground: false,
  addLoader: false,
  objectPosition: 'center',
  forceAlt: '',
  loading_mask: '',
  image_selection_hints: null
})

const emptyVideo = () => ({
  type: 'embedded',
  src: '',
  webm: '',
  title: '',
  poster: ''
})

const emptyButton = () => ({
  type: 'nuxt',
  style: 'primary',
  label: '',
  aria_label: '',
  href: '',
  path: '',
  hash: '',
  external: false,
  include_icon: false,
  icon: '',
  color: 'black'
})

const emptyAccordionItem = () => ({
  header: 'New accordion item',
  paragraphs: [{ text: 'Add your content here.' }],
  has_media: false,
  media_type: 'image',
  image: emptyImage(),
  video: emptyVideo()
})

const template = (layout, values = {}) => ({
  __builder_id: createBuilderId(layout.replace(/_/g, '-')),
  acf_fc_layout: layout,
  component_padding: 'half',
  component_options: sharedOptions(),
  ...values
})

export const renderedSectionLayouts = [
  'accordion',
  'multi_use_banner',
  'before_after_slider',
  'map',
  'form',
  'block_document_list',
  'block_grid',
  'image_only',
  'image_text',
  'multi_item_row',
  'logo_banner',
  'block_masonary_grid',
  'multi_item_testimonial',
  'block_resource_grid',
  'single_image_slider',
  'single_testimonial',
  'single_video_slider',
  'smile_gallery',
  'tabs',
  'block_text_fh',
  'block_text_simple',
  'blog_posts',
  'hero'
]

export const sectionTemplates = {
  accordion: () => template('accordion', {
    title: 'New accordion section',
    paragraphs: [],
    accordion: [emptyAccordionItem()],
    start_collapsed: true,
    has_background: false,
    background: '',
    add_texture: false,
    linear_gradient: ''
  }),
  multi_use_banner: () => template('multi_use_banner', {
    title: 'New banner',
    content_block: 'text_block',
    text: 'Add your content here.',
    social_links: [],
    email: '',
    button: emptyButton(),
    background_type: 'has_background',
    background: 'bg2',
    image: emptyImage(),
    reversed: false,
    centered: false,
    large_title: false,
    text_color: 'white',
    add_texture: false,
    linear_gradient: ''
  }),
  before_after_slider: () => template('before_after_slider', {
    title: 'Before and after',
    text: 'Add a case description.',
    carousel_aria: 'Before and after gallery',
    slides: [{ caption: 'New case', before_image: emptyImage(), after_image: emptyImage() }],
    primary_color: false,
    background: '',
    add_texture: false,
    linear_gradient: ''
  }),
  map: () => template('map', {
    title: 'How to reach us',
    center_title: true,
    background: 'bg1',
    linear_gradient: ''
  }),
  form: () => template('form', {
    form: [1025],
    stack: false
  }),
  block_grid: () => template('block_grid', {
    title: 'New grid',
    items: [{ name: 'New item', position: '', bio: '', image: emptyImage() }],
    has_bio: false,
    large_title: false,
    center_title: false,
    background: '',
    add_texture: false,
    linear_gradient: '',
    preserve_image: true
  }),
  image_only: () => template('image_only', {
    title: 'New image',
    image: emptyImage(),
    title_alt: false,
    background: ''
  }),
  image_text: () => template('image_text', {
    title: 'New image and text section',
    paragraphs: [{ has_heading: false, heading: '', text: 'Add your content here.' }],
    accordion: [],
    image: emptyImage(),
    video: emptyVideo(),
    buttons: [],
    reverse: false,
    has_buttons: false,
    has_accordion: false,
    is_dynamic: false,
    use_video: false,
    large_image: false,
    large_title: false,
    has_background: false,
    background: '',
    add_texture: false,
    linear_gradient: '',
    title_color: 'text',
    title_underline_color: 'none',
    preserve_image: true
  }),
  multi_item_row: () => template('multi_item_row', {
    title: 'New item row',
    media_type: 'icon',
    items: [{ title: 'New item', text: 'Add your content here.', icon: '', image: emptyImage(), add_button: false, button: emptyButton() }],
    button: emptyButton(),
    add_cta: false,
    has_background: false,
    background: '',
    large_title: false,
    left_aligned: false,
    alt_color: false,
    add_texture: false,
    linear_gradient: ''
  }),
  logo_banner: () => template('logo_banner', {
    title: 'New logo banner',
    logos: [{ name: 'rg-logo-purple' }],
    scrolling: false,
    large_title: false,
    center_title: true,
    title_alt: false,
    has_background: false,
    background: '',
    add_texture: false
  }),
  block_masonary_grid: () => template('block_masonary_grid', {
    title: 'New image grid',
    paragraphs: [{ text: 'Add your content here.' }],
    items: [{ title: 'New item', path: '', hash: '', image: emptyImage() }],
    button: emptyButton(),
    columns: 3,
    links: false,
    reverse_row: false,
    linear_gradient: ''
  }),
  multi_item_testimonial: () => template('multi_item_testimonial', {
    title: 'Testimonials',
    review_text: '',
    links: [],
    testimonials: [{ author: 'Patient name', testimonial: 'Add a testimonial here.' }],
    has_background: false,
    background: '',
    linear_gradient: ''
  }),
  block_document_list: () => template('block_document_list', {
    eyebrow: '',
    title: 'New document list',
    intro: 'Add an introduction here.',
    tabs_label: 'Choose a group',
    note: '',
    groups: [{
      label: 'New group',
      summary: '',
      documents: [{ title: 'New document', text: 'Add a short description here.', href: '', icon: 'files-tooth', aria_label: '' }]
    }],
    has_background: false,
    background: '',
    add_texture: false,
    linear_gradient: ''
  }),
  block_resource_grid: () => template('block_resource_grid', {
    title: 'New resource grid',
    eyebrow: '',
    intro: 'Add an introduction here.',
    layout: 'cards',
    items: [{ type: 'text', eyebrow: '', title: 'New resource', text: 'Add your content here.', icon: '', image: emptyImage(), video: emptyVideo(), button: emptyButton() }],
    has_background: false,
    background: '',
    add_texture: false,
    linear_gradient: ''
  }),
  single_image_slider: () => template('single_image_slider', {
    title: 'New image gallery',
    text: '',
    carousel_aria: 'Image gallery',
    slides: [emptyImage()],
    primary_color: false,
    preserve_image: true,
    background: '',
    add_texture: false,
    linear_gradient: ''
  }),
  single_testimonial: () => template('single_testimonial', {
    title: 'Patient testimonial',
    review_text: '',
    links: [],
    testimonial: 'Add a testimonial here.',
    author: 'Patient name',
    background: '',
    add_texture: false,
    linear_gradient: ''
  }),
  single_video_slider: () => template('single_video_slider', {
    title: 'New video gallery',
    carousel_aria: 'Video gallery',
    slides: [{ type: 'iframe', src: '', title: 'New video', poster: '' }],
    primary_color: false,
    background: '',
    add_texture: false,
    linear_gradient: ''
  }),
  smile_gallery: () => template('smile_gallery', {
    title: 'Smile gallery',
    text: 'Add before and after cases.',
    categories: [{ name: 'New category', description: '', cases: [{ caption: 'New case', treatment: '', before_image: emptyImage(), after_image: emptyImage() }] }],
    background: ''
  }),
  tabs: () => template('tabs', {
    title: 'New tabs section',
    intro: '',
    paragraphs: [],
    image: emptyImage(),
    tabs: [{ header: 'New tab', paragraphs: [{ text: 'Add your content here.' }], image: emptyImage() }],
    buttons: [],
    has_buttons: false,
    has_background: false,
    background: '',
    reverse: false,
    is_dynamic: false,
    large_title: false,
    large_image: false,
    title_alt: false,
    preserve_image: true,
    add_texture: false,
    linear_gradient: ''
  }),
  block_text_simple: () => template('block_text_simple', {
    title: 'New text section',
    paragraphs: [{ text: 'Add your content here.' }],
    large_title: false,
    center_title: false,
    one_column: true,
    add_texture: false,
    background: '',
    linear_gradient: ''
  }),
  block_text_fh: () => template('block_text_fh', {
    title: 'New text section',
    paragraphs: [{ text: 'Add your content here.' }],
    add_texture: false,
    linear_gradient: ''
  }),
  blog_posts: () => template('blog_posts', {
    title: 'Latest posts',
    background: ''
  }),
  hero: () => template('hero', {
    title: 'New page heading',
    text: '',
    media_type: 'image',
    image: emptyImage(),
    video: emptyVideo(),
    button: emptyButton(),
    small: false,
    hide_component: false
  })
}

export const createSection = layout => sectionTemplates[layout] ? sectionTemplates[layout]() : null

export const cloneContent = clone
