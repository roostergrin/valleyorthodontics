<template lang='pug' src='./index.pug'></template>

<script>

/**
 * The <img> and its srcset are bound straight to the props so they exist in the
 * statically generated HTML.
 *
 * This component previously gated its whole template behind `v-if="loaded"` with
 * `loaded` set in mounted(), and only assigned src/srcset inside an
 * IntersectionObserver callback. The result was that `nuxt generate` emitted no
 * <img> tags at all: no src and no alt reached the served document, so images
 * could not be indexed and a hero image could never be the LCP element. Lazy
 * loading is now the browser's native `loading` attribute instead.
 */
export default {
  props: {
    src: {
      type: String,
      default: () => ``
    },
    webp: {
      type: String,
      default: () => ``
    },
    bgColor: {
      type: String,
      default: '#ffffff'
    },
    imageBackground: {
      type: Boolean,
      default: false
    },
    addLoader: {
      type: Boolean,
      default: false
    },
    objectPosition: {
      type: String,
      default: 'center center'
    },
    alt: {
      type: String,
      // Empty rather than a generated string: the old default read
      // document.location under process.client only, so SSR rendered
      // alt="undefined" into the markup.
      default: ''
    },
    forceAlt: {
      type: Boolean,
      default: false
    },
    // Above-the-fold opt-in: skips lazy loading and raises fetch priority so the
    // image can be the LCP element. Note that loading="lazy" already loads
    // anything inside the initial viewport immediately, so this is only needed
    // where an image must be prioritised, not merely rendered.
    forceVisible: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      hydrated: false,
      loading: true
    }
  },
  computed: {
    imageType () {
      // Was assigned in created() behind a process.client check, so server
      // rendering always fell through to 'contain' regardless of the prop.
      return this.imageBackground ? 'cover' : 'contain'
    },
    loadingAttribute () {
      return this.forceVisible ? 'eager' : 'lazy'
    },
    fetchPriority () {
      return this.forceVisible ? 'high' : null
    },
    showOverlay () {
      // Never rendered server-side: an opaque overlay in the static HTML would
      // hide the very images this component now emits.
      return this.hydrated && this.loading
    }
  },
  mounted () {
    this.hydrated = true
    // An image the browser already fetched while parsing the document is
    // complete before this runs, so no overlay should flash in.
    const image = this.$refs.image
    if (!image || image.complete) {
      this.loading = false
    }
  },
  methods: {
    onLoad () {
      this.loading = false
    }
  }
}
</script>

<style lang="sass" src="./index.sass"></style>
