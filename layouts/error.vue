<template lang="pug" src="./error.pug"></template>

<script>
/**
 * Nuxt renders this for every error({ statusCode }) call and every unmatched
 * route. Without it, pages/_slug.vue's 404 fell through to Nuxt's unstyled
 * built-in error page while the styled 404 sat unreachable at /404.
 *
 * Reuses pages/404's markup classes and stylesheet so there is one 404 design.
 */
export default {
  props: {
    error: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    isNotFound () {
      return this.error.statusCode === 404
    },
    heading () {
      return this.isNotFound ? 'Page not found' : 'Something went wrong'
    },
    message () {
      return this.isNotFound
        ? "We can't find what you're looking for. Please check the link and try again."
        : 'Please try again in a moment, or head back to our home page.'
    }
  },
  head () {
    return {
      title: this.heading,
      meta: [
        { hid: 'robots', name: 'robots', content: 'noindex, follow' }
      ]
    }
  },
  mounted () {
    // The layout chrome stays hidden until VIEW_SITE fires.
    this.$nextTick(() => {
      setTimeout(() => {
        this.$store.dispatch('VIEW_SITE', true)
      }, 100)
    })
  }
}
</script>

<style lang="sass" src="~/pages/404/index.sass"></style>
