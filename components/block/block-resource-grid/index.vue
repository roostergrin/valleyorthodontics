<template lang='pug' src='./index.pug'></template>

<script>
const FANCYBOX_CSS_ID = 'fancybox-css'
const FANCYBOX_SCRIPT_ID = 'fancybox-script'
const FANCYBOX_CSS = 'https://cdn.jsdelivr.net/npm/@fancyapps/ui/dist/fancybox.css'
const FANCYBOX_SCRIPT = 'https://cdn.jsdelivr.net/npm/@fancyapps/ui/dist/fancybox.umd.js'

let fancyboxLoadPromise = null

export default {
  props: {
    // 'h1' when this block is the first rendered section on the page (its hero is
    // hidden), otherwise 'h2'. Passed down from page-sections.
    headingLevel: {
      type: String,
      default: 'h2'
    },
    props: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    items () {
      return this.props.items || this.props.cards || []
    },
    isVideoLayout () {
      return this.props.layout === 'videos'
    }
  },
  mounted () {
    if (this.isVideoLayout) {
      this.initFancybox()
    }
  },
  updated () {
    if (this.isVideoLayout) {
      this.bindFancybox()
    }
  },
  methods: {
    buttonHref (button = {}) {
      if (button.href) {
        return button.href
      }
      return `${button.path || ''}${button.hash || ''}`
    },
    buttonIcon (button = {}) {
      return button.icon || 'caret'
    },
    buttonLabel (button = {}) {
      return button.label || button.aria_label || 'Learn more'
    },
    buttonRel (button = {}) {
      return this.buttonTarget(button) ? 'noopener' : null
    },
    buttonTarget (button = {}) {
      return button.external ? '_blank' : null
    },
    buttonType (button = {}) {
      return button.type || button.button_type || 'anchor'
    },
    buttonAria (button = {}) {
      return button.aria_label || button.label || 'Learn more'
    },
    buttonPath (button = {}) {
      return `${button.path || ''}${button.hash || ''}`
    },
    cardType (item = {}) {
      return item.type || item.card_type || 'text'
    },
    hasButton (item = {}) {
      return Boolean(item.button && item.button.label)
    },
    hasVideoThumbnail (item = {}) {
      return Boolean(this.videoThumbnail(item))
    },
    fancyboxType (item = {}) {
      return this.isFileVideo(item) ? 'video' : null
    },
    isVideo (item = {}) {
      return this.cardType(item) === 'video' && item.video && item.video.src
    },
    isEmbeddedVideo (item = {}) {
      return this.isVideo(item) && item.video.type === 'embedded'
    },
    isFileVideo (item = {}) {
      return this.isVideo(item) && item.video.type === 'file'
    },
    isImageCard (item = {}) {
      return !this.isVideo(item) && item.image && item.image.src
    },
    initFancybox () {
      this.loadFancybox()
        .then(() => this.bindFancybox())
        .catch(() => null)
    },
    loadFancybox () {
      if (!process.client) {
        return Promise.resolve(null)
      }

      if (!document.getElementById(FANCYBOX_CSS_ID)) {
        const link = document.createElement('link')
        link.id = FANCYBOX_CSS_ID
        link.rel = 'stylesheet'
        link.href = FANCYBOX_CSS
        document.head.appendChild(link)
      }

      if (window.Fancybox) {
        return Promise.resolve(window.Fancybox)
      }

      if (fancyboxLoadPromise) {
        return fancyboxLoadPromise
      }

      fancyboxLoadPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById(FANCYBOX_SCRIPT_ID)
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve(window.Fancybox), { once: true })
          existingScript.addEventListener('error', reject, { once: true })
          return
        }

        const script = document.createElement('script')
        script.id = FANCYBOX_SCRIPT_ID
        script.src = FANCYBOX_SCRIPT
        script.onload = () => resolve(window.Fancybox)
        script.onerror = reject
        document.head.appendChild(script)
      })

      return fancyboxLoadPromise
    },
    bindFancybox () {
      if (process.client && window.Fancybox) {
        window.Fancybox.bind('[data-fancybox="videos"]', {
          dragToClose: true,
          Toolbar: { display: ['close'] },
          Thumbs: false
        })
      }
    },
    videoThumbnail (item = {}) {
      if (item.image && item.image.src) {
        return item.image
      }

      const videoId = this.youtubeVideoId(item.video && item.video.src)
      if (!this.isEmbeddedVideo(item) || !videoId) {
        return null
      }

      return {
        src: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        // No webp: YouTube serves these as JPEG, and advertising the same URL
        // under <source type="image/webp"> told the browser to decode a JPEG
        // as webp.
        webp: '',
        alt: item.title || 'Video thumbnail',
        aria_hidden: false,
        objectPosition: 'center',
        forceAlt: ''
      }
    },
    youtubeVideoId (src = '') {
      const youtubeMatch = src.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([^?&/]+)/)
      return youtubeMatch && youtubeMatch[1] ? youtubeMatch[1] : null
    },
    videoHref (item = {}) {
      const src = item.video && item.video.src ? item.video.src : ''
      const videoId = this.youtubeVideoId(src)
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`
      }
      return src
    },
    videoLinkLabel (item = {}) {
      return `Watch ${item.title || 'instructional video'}`
    }
  }
}
</script>

<style lang='sass' src='./index.sass'></style>
