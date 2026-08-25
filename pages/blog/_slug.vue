<template lang="pug" src="./_slug.pug"></template>

<script>
import { setMeta, setData } from '~/resources/utils'
import { buildArticleSchema, buildCrumbList } from '~/resources/structured-data'
import BlockPost from '~/components/block/block-post'

export default {
  components: {
    BlockPost
  },
  async asyncData ({ params, redirect }) {
    const data = await setData(params.slug, 'posts')

    return { props: data }
  },
  head () {
    const meta = setMeta(Object.assign({}, this.props, {
      // this.props.slug is the bare post slug, which produced a canonical of
      // https://…/<slug> — a legacy WordPress URL that 301s back to this page.
      path: this.$route.path,
      // Prefer the authored SEO title so it can be tuned for the SERP without
      // touching the post's editorial title, which still renders as the h1.
      // Falls back to the post title for any post with no seo.page_title.
      seo: Object.assign({}, this.props.seo, {
        'page_title': (this.props.seo && this.props.seo.page_title) || this.props.title
      })
    }))

    const post = this.props.blog_post || {}
    const seo = this.props.seo || {}
    const schema = buildArticleSchema({
      routePath: this.$route.path,
      title: this.props.title,
      description: seo.page_description,
      image: (post.main_image && post.main_image.src) ||
        (seo.social_meta && seo.social_meta.og_meta && seo.social_meta.og_meta.image),
      // this.props.date is the WordPress ISO 8601 timestamp. post.date is the
      // display string ("July 29, 2026"), which schema.org rejects — it is only
      // the fallback for a post the local mirror has no timestamp for.
      datePublished: this.props.date || post.date,
      dateModified: this.props.modified
    })

    // Posts have no entry in router/index.js, so the nav-derived breadcrumb
    // can't name them. The listing lives at /blog/page/1; bare /blog redirects.
    const breadcrumb = buildCrumbList([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog/page/1' },
      { name: this.props.title, path: this.$route.path }
    ])

    return {
      ...meta,
      script: [
        { hid: 'ld-article', type: 'application/ld+json', innerHTML: JSON.stringify(schema) },
        { hid: 'ld-breadcrumb', type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumb) }
      ],
      // Superset including the global entries, so this is safe whether vue-meta
      // merges these maps across levels or replaces them.
      __dangerouslyDisableSanitizersByTagID: {
        'ld-article': ['innerHTML'],
        'ld-breadcrumb': ['innerHTML'],
        'gtag-config': ['innerHTML'],
        'ld-practice': ['innerHTML'],
        'ld-website': ['innerHTML']
      }
    }
  }
}
</script>
