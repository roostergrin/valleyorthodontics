<template lang='pug' src='./index.pug'></template>

<script>
import BlockAccordionFull from '~/components/block/block-accordion-full'
import BlockBanner from '~/components/block/block-banner'
import BlockBeforeAfterSlider from '~/components/block/block-before-after-slider'
import BlockSmileGallery from '~/components/block/block-smile-gallery'
import BlockContact from '~/components/block/block-contact'
import BlockContactForm from '~/components/block/block-contact-form'
import BlockDocumentList from '~/components/block/block-document-list'
import BlockGrid from '~/components/block/block-grid'
import BlogPosts from '~/components/block/block-repeater-post'
import BlockImage from '~/components/block/block-image'
import BlockImageText from '~/components/block/block-image-text'
import BlockItemRow from '~/components/block/block-item-row'
import BlockLogoBanner from '~/components/block/block-logo-banner'
import BlockMasonaryGrid from '~/components/block/block-masonary-grid'
import BlockMultiTestimonial from '~/components/block/block-multi-testimonial'
import BlockResourceGrid from '~/components/block/block-resource-grid'
import BlockSingleImageSlider from '~/components/block/block-single-image-slider'
import BlockSingleTestimonial from '~/components/block/block-single-testimonial'
import BlockSingleVideoSlider from '~/components/block/block-single-video-slider'
import BlockTabs from '~/components/block/block-tabs'
import BlockTextFH from '~/components/block/block-text-fh'
import BlockTextSimple from '~/components/block/block-text-simple'
import TheHero from '~/components/hero/hero-main'
import { buildSectionStyleVars } from '~/resources/theme-scheme'
import { getBasePage, getPageKeyForPath, readContentDrafts } from '~/resources/content-builder'

const sectionBackgroundLabels = {
  bg1: 'bg-1',
  bg2: 'bg-2'
}

export default {
  transition: 'fade',
  components: {
    BlockAccordionFull,
    BlockBanner,
    BlockBeforeAfterSlider,
    BlockSmileGallery,
    BlockContact,
    BlockContactForm,
    BlockDocumentList,
    BlockGrid,
    BlockImage,
    BlockImageText,
    BlockItemRow,
    BlockLogoBanner,
    BlockMasonaryGrid,
    BlockMultiTestimonial,
    BlockResourceGrid,
    BlockSingleImageSlider,
    BlockSingleTestimonial,
    BlockSingleVideoSlider,
    BlockTabs,
    BlockTextFH,
    BlockTextSimple,
    BlogPosts,
    TheHero
  },
  props: {
    props: {
      type: Array,
      default: () => ([])
    },
    pageTitle: {
      type: String,
      default: () => ('')
    }
  },
  data: () => ({
    animationRefreshTimeout: null
  }),
  computed: {
    currentPageKey () {
      return getPageKeyForPath(this.$route.path)
    },
    renderedSections () {
      const page = this.currentPageKey && this.$store.state.contentPages[this.currentPageKey]

      return page ? page.sections : this.props
    },
    activeSectionId () {
      return this.$store.state.activeContentSectionId
    },
    customizationEnabled () {
      return this.$store.state.customizationEnabled
    }
  },
  watch: {
    customizationEnabled (enabled) {
      if (enabled) {
        this.initializeContentPage()
      }
    },
    currentPageKey () {
      this.initializeContentPage()
    },
    renderedSections () {
      this.refreshSectionAnimations()
    }
  },
  mounted () {
    this.initializeContentPage()
    window.addEventListener('rg-select-content-section', this.handleExternalSectionSelection)
    this.$nextTick(() => {
      setTimeout(() => {
        this.$store.dispatch('VIEW_SITE', true)
      }, 100)
    })
  },
  beforeDestroy () {
    window.removeEventListener('rg-select-content-section', this.handleExternalSectionSelection)
    clearTimeout(this.animationRefreshTimeout)
  },
  methods: {
    initializeContentPage () {
      if (!this.$store.state.customizationEnabled || !this.currentPageKey) {
        return
      }

      const drafts = readContentDrafts()

      this.$store.dispatch('INITIALIZE_CONTENT_PAGE', {
        key: this.currentPageKey,
        page: getBasePage(this.currentPageKey),
        draft: drafts[this.currentPageKey]
      })
      this.$store.dispatch('SET_ACTIVE_CONTENT_PAGE', this.currentPageKey)
      this.refreshSectionAnimations()
    },
    refreshSectionAnimations () {
      if (!this.$ScrollTrigger) {
        return
      }

      clearTimeout(this.animationRefreshTimeout)
      this.$nextTick(() => {
        window.requestAnimationFrame(() => {
          this.$ScrollTrigger.getAll()
            .filter(trigger => trigger.trigger && !trigger.trigger.isConnected)
            .forEach(trigger => trigger.kill())
          this.$ScrollTrigger.refresh()
          this.$ScrollTrigger.update()

          this.animationRefreshTimeout = setTimeout(() => {
            this.$ScrollTrigger.refresh()
            this.$ScrollTrigger.update()
          }, 250)
        })
      })
    },
    handleExternalSectionSelection (event) {
      const id = event && event.detail ? event.detail.id : null
      const shouldScroll = event && event.detail ? event.detail.shouldScroll !== false : true

      if (id) {
        this.selectSection(id, shouldScroll)
      }
    },
    selectSection (id, shouldScroll = false) {
      if (!this.$store.state.customizationEnabled) {
        return
      }

      this.$store.dispatch('SET_ACTIVE_CONTENT_SECTION', id)

      if (!shouldScroll) {
        return
      }

      this.$nextTick(() => {
        const element = this.$el.querySelector(`[data-builder-id="${id}"]`)

        if (element) {
          const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
        }
      })
    },
    isActiveSection (section) {
      return !!section.__builder_id && section.__builder_id === this.activeSectionId
    },
    sectionId (section, i) {
      return section.component_options && section.component_options.hash
        ? section.component_options.hash
        : section.__builder_id || `${section.acf_fc_layout}-${i}`
    },
    sectionKey (section, i) {
      return `${this.$route.path}::${this.sectionId(section, i)}`
    },
    sectionBackgroundLabel (section) {
      const hasBackground = (section.has_background || section.background_type === 'has_background') && section.background

      return hasBackground ? sectionBackgroundLabels[section.background] || null : null
    },
    /**
     * True for the first section that actually renders. Used to decide which
     * block owns the page's h1: most pages get it from the hero, but a page whose
     * hero is hidden (hide_component) would otherwise ship with no h1 at all.
     */
    isFirstRenderedSection (section, i) {
      const sections = this.renderedSections || []

      for (let index = 0; index < sections.length; index++) {
        const candidate = sections[index]
        if (!candidate || !candidate.acf_fc_layout || candidate.hide_component) {
          continue
        }
        return index === i
      }

      return false
    },
    hasSectionTitleOverride (section, i) {
      const sectionOverrides = this.$store.state.theme?.sectionOverrides || {}

      return !!sectionOverrides[this.sectionKey(section, i)]?.titles
    },
    sectionStyle (section, i) {
      const theme = this.$store.state.theme

      if (!theme) {
        return {}
      }

      return buildSectionStyleVars(theme, this.sectionKey(section, i), this.sectionBackgroundLabel(section))
    }
  }
}
</script>

<style lang="sass" src="./index.sass"></style>
