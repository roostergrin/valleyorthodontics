<template lang="pug" src="./_slug.pug"></template>

<script>
import { setMeta, setData } from '~/resources/utils'
import { buildArticleSchema } from '~/resources/structured-data'
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
      seo: Object.assign({}, this.props.seo, { 'page_title': this.props.title })
    }))

    const post = this.props.blog_post || {}
    const seo = this.props.seo || {}
    const schema = buildArticleSchema({
      routePath: this.$route.path,
      title: this.props.title,
      description: seo.page_description,
      image: (post.main_image && post.main_image.src) ||
        (seo.social_meta && seo.social_meta.og_meta && seo.social_meta.og_meta.image),
      datePublished: post.date
    })

    return {
      ...meta,
      script: [
        { hid: 'ld-article', type: 'application/ld+json', innerHTML: JSON.stringify(schema) }
      ],
      // Superset including the global entries, so this is safe whether vue-meta
      // merges these maps across levels or replaces them.
      __dangerouslyDisableSanitizersByTagID: {
        'ld-article': ['innerHTML'],
        'gtag-config': ['innerHTML'],
        'ld-practice': ['innerHTML'],
        'ld-website': ['innerHTML']
      }
    }
  }
}
</script>
