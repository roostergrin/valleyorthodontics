import { getPageKeyForPath } from '~/resources/content-builder'
import { setMeta } from '~/resources/utils'
import router from '~/router'
import { buildBreadcrumbSchema, buildFaqSchema } from '~/resources/structured-data'

export const resolveContentPreviewMeta = ({
  props,
  routePath,
  customizationEnabled,
  activePageKey,
  contentPages
}) => {
  const pageKey = getPageKeyForPath(routePath)
  const page = pageKey && contentPages[pageKey]

  if (!customizationEnabled || activePageKey !== pageKey || !page) {
    return props
  }

  return {
    ...props,
    seo: page.seo
  }
}

export default {
  computed: {
    contentPreviewMeta () {
      return resolveContentPreviewMeta({
        props: this.props,
        routePath: this.$route.path,
        customizationEnabled: this.$store.state.customizationEnabled,
        activePageKey: this.$store.state.activeContentPageKey,
        contentPages: this.$store.state.contentPages
      })
    }
  },
  head () {
    const path = this.$route.path
    // Pass the real route path so setMeta can build a correct canonical. Without
    // it the six file-based pages (/about, /contact, /faq, /get-started,
    // /treatments and /) all canonicalized to the homepage, because setJSONData
    // returns no slug.
    const meta = setMeta({ ...this.contentPreviewMeta, path })

    const faq = buildFaqSchema((this.props && this.props.sections) || [])
    const breadcrumb = buildBreadcrumbSchema(path, router)
    const script = []
    const bypass = { 'gtag-config': ['innerHTML'] }

    if (faq) {
      script.push({ hid: 'ld-faq', type: 'application/ld+json', innerHTML: JSON.stringify(faq) })
      bypass['ld-faq'] = ['innerHTML']
    }
    if (breadcrumb) {
      script.push({ hid: 'ld-breadcrumb', type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumb) })
      bypass['ld-breadcrumb'] = ['innerHTML']
    }

    if (!script.length) {
      return meta
    }

    return {
      ...meta,
      script,
      // Declared as a superset including the global gtag entry, so this is safe
      // whether vue-meta merges these maps across levels or replaces them.
      __dangerouslyDisableSanitizersByTagID: {
        ...bypass,
        'ld-practice': ['innerHTML'],
        'ld-website': ['innerHTML']
      }
    }
  }
}
