<template lang="pug" src="./index.pug"></template>

<script>
import BlockButton from '~/components/block/block-button'

export default {
  components: {
    BlockButton
  },
  props: {
    props: {
      type: Object,
      default: () => ({})
    }
  },
  data: () => ({
    videoPlaying: true,
    mediaReady: false,
    options: {
      root: null,
      rootMargin: '0px',
      threshold: [ 0.01 ]
    }
  }),
  computed: {
    // Computed rather than assigned in mounted(): the hero is the LCP element on
    // every page, and binding these after hydration kept it out of the static
    // HTML entirely.
    imgSrc () {
      return this.props.image.src || null
    },
    webpSrc () {
      return this.props.image.webp || null
    },
    routeSlug () {
      return this.$route.path.replace(/^\/|\/$/g, '')
    },
    hasHeaderOffset () {
      return [
        'meet-the-team',
        'meet-dr-rocha',
        'what-sets-us-apart'
      ].includes(this.routeSlug)
    },
    heroClasses () {
      return {
        'hero-main--no-image': !this.props.image.src && !this.props.video.src,
        'hero-main--small-height': this.props.small,
        'hero-main--inner-page': this.$route.path !== '/',
        'hero-main--braces-page': this.routeSlug === 'braces',
        'hero-main--iconix-page': this.routeSlug === 'iconix-champagne-gold-braces',
        'hero-main--left-content': this.props.left_content,
        'hero-main--header-offset': this.hasHeaderOffset
      }
    },
    imageStyles () {
      return {
        objectPosition: this.props.image.objectPosition || (this.hasHeaderOffset ? 'center top' : null),
        '--hero-mobile-object-position': this.props.image.mobileObjectPosition || null
      }
    }
  },
  mounted () {
    if (this.$refs.image) {
      this.loadImage()
    }
    if (this.$refs.video) {
      this.$refs.video.addEventListener('loadeddata', this.handleMediaReady, { once: true })
      this.$refs.video.addEventListener('error', this.handleMediaReady, { once: true })
      window.setTimeout(this.handleMediaReady, 3000)
    }
    if (!this.$refs.video && !this.props.image.src) {
      if (!this.$store.state.siteLoaded) {
        this.$store.dispatch('VIEW_SITE', true)
      }
      this.handleAnimation()
    }
  },
  methods: {
    loadImage () {
      // The <img> is already in the document; just wait for it to decode.
      // Queried by tag rather than by child index — the previous
      // children[1] lookup broke whenever a <source> was added or removed.
      const image = this.$refs.image.querySelector('img')
      if (!image) {
        this.handleMediaReady()
        return
      }
      if (image.complete) {
        this.handleMediaReady()
        return
      }
      image.addEventListener('load', this.handleMediaReady, { once: true })
      image.addEventListener('error', this.handleMediaReady, { once: true })
    },
    playVideo () {
      this.$refs.video.play()
      this.videoPlaying = true
    },
    pauseVideo () {
      this.$refs.video.pause()
      this.videoPlaying = false
    },
    handleCtaClick () {
      // Navigate to contact page with form hash
      if (this.props.button.path && this.props.button.hash) {
        this.$router.push(this.props.button.path + this.props.button.hash)
      } else if (this.props.button.path) {
        this.$router.push(this.props.button.path)
      }
    },
    handleMediaReady () {
      if (this.mediaReady) {
        return
      }
      this.mediaReady = true
      if (!this.$store.state.siteLoaded) {
        this.$store.dispatch('VIEW_SITE', true)
      }
      this.handleAnimation()
    },
    handleAnimation (delay) {
      this.$CustomEase.create('customEaseOut', '0.23, 1, 0.32, 1')
      const tl = this.$gsap.timeline()
      const heroTitle = this.$refs.heroTitle
      const heroText = this.$refs.heroText
      const heroBtn = this.$refs.heroBtn

      /* eslint-disable */
      const titleSplit = new this.$SplitText(heroTitle, { type: 'lines' })

      tl.from(titleSplit.lines, {
        y: '32',
        opacity: 0,
        duration: 1.25,
        stagger: 0.115,
        delay: 0.25,
        ease: 'customEaseOut'
      })
      if (heroText) {
        tl.from(heroText, {
          y: '24',
          opacity: 0,
          duration: 1,
          ease: 'customEaseOut'
        }, '<+=0.175')
      }
      if (heroBtn) {
        tl.from('.hero-main__cta', {
          y: '24',
          opacity: 0,
          duration: 1,
          ease: 'customEaseOut'
        }, '<+=0.175')
      }
      if (this.$route.path === '/') {
        tl.from('.hero-main__down', {
          opacity: 0,
          duration: 0.6,
          ease: 'ease'
        })
      }
    }
  }
}
</script>

<style lang="sass" src="./index.sass"></style>
