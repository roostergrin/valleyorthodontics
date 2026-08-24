<template lang='pug' src='./index.pug'></template>

<script>
import ContentEditorField from '~/components/content-editor-field'
import ContentMediaPicker from '~/components/content-media-picker'
import { getIconCatalog, getMediaCatalog } from '~/resources/builder-assets'
import { cloneContent, createBuilderId, createSection, getPageCatalog, readContentDraftState, sectionTemplates, writeContentDrafts } from '~/resources/content-builder'
import { confirmDiscardChanges, getDraftStatus, setSEOValue } from '~/resources/content-builder-state'
import { addPathItem, describeObject, duplicatePathItem, movePathItem, removePathItem, setPathValue } from '~/resources/content-editor-schema'
import ctaBannerIcon from '~/assets/component-icons/cta-banner-icon.svg'
import formIcon from '~/assets/component-icons/form-icon.svg'
import galleryIcon from '~/assets/component-icons/gallery-icon.svg'
import gridIcon from '~/assets/component-icons/grid-icon.svg'
import heroIcon from '~/assets/component-icons/hero-icon.svg'
import imageTextIcon from '~/assets/component-icons/image-text-icon.svg'
import masonryGridIcon from '~/assets/component-icons/masonry-grid-icon.svg'
import testimonialsIcon from '~/assets/component-icons/testimonials-icon.svg'

const historyLimit = 50
const historyCoalesceMs = 1000
const sectionIconByLayout = {
  hero: heroIcon,
  form: formIcon,
  image_only: imageTextIcon,
  image_text: imageTextIcon,
  tabs: imageTextIcon,
  block_grid: gridIcon,
  block_resource_grid: gridIcon,
  block_document_list: gridIcon,
  multi_item_row: gridIcon,
  logo_banner: gridIcon,
  block_masonary_grid: masonryGridIcon,
  single_image_slider: galleryIcon,
  single_video_slider: galleryIcon,
  before_after_slider: galleryIcon,
  smile_gallery: galleryIcon,
  multi_item_testimonial: testimonialsIcon,
  single_testimonial: testimonialsIcon,
  multi_use_banner: ctaBannerIcon,
  blog_posts: ctaBannerIcon,
  accordion: ctaBannerIcon,
  map: ctaBannerIcon,
  block_text_simple: ctaBannerIcon,
  block_text_fh: ctaBannerIcon
}

export default {
  components: {
    ContentEditorField,
    ContentMediaPicker
  },
  data: () => ({
    isOpen: false,
    activeTab: 'sections',
    newSectionLayout: 'block_text_simple',
    savedPages: {},
    savedAt: {},
    saveNotice: '',
    saveNoticeTimeout: null,
    removeRouteGuard: null,
    undoStack: [],
    redoStack: [],
    lastEditKey: null,
    lastEditAt: 0
  }),
  computed: {
    pages () {
      return getPageCatalog()
    },
    activeBuilderPanel () {
      return this.$store.state.activeBuilderPanel
    },
    pageKey () {
      return this.$store.state.activeContentPageKey
    },
    page () {
      return this.pageKey ? this.$store.state.contentPages[this.pageKey] : null
    },
    baseline () {
      return this.pageKey ? this.$store.state.contentBaselines[this.pageKey] : null
    },
    sections () {
      return this.page ? this.page.sections : []
    },
    activeSectionId () {
      return this.$store.state.activeContentSectionId
    },
    activeSection () {
      return this.sections.find(section => section.__builder_id === this.activeSectionId) || null
    },
    sectionFields () {
      return describeObject(this.activeSection)
    },
    mediaCatalog () {
      return getMediaCatalog()
    },
    iconCatalog () {
      return getIconCatalog()
    },
    sectionLayoutOptions () {
      return Object.keys(sectionTemplates).map(value => ({
        value,
        label: this.layoutLabel(value)
      }))
    },
    hasUnsavedChanges () {
      return this.draftStatus === 'unsaved'
    },
    draftStatus () {
      return getDraftStatus(this.page, this.baseline, this.savedPages[this.pageKey])
    },
    draftStatusLabel () {
      if (this.saveNotice) {
        return this.saveNotice
      }

      if (this.draftStatus === 'unsaved') {
        return 'Unsaved changes'
      }

      const savedAt = this.savedAt[this.pageKey]

      return savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : 'No unsaved changes'
    },
    ogMeta () {
      return this.page?.seo?.social_meta?.og_meta || {}
    }
  },
  watch: {
    pageKey () {
      this.clearHistory()
    },
    activeBuilderPanel (panel) {
      this.isOpen = panel === 'content'
    }
  },
  mounted () {
    const draftState = readContentDraftState()
    this.savedPages = draftState.pages
    this.savedAt = draftState.savedAt
    this.removeRouteGuard = this.$router.beforeEach((to, from, next) => {
      next(confirmDiscardChanges(this.hasUnsavedChanges, message => window.confirm(message)) ? undefined : false)
    })
    window.addEventListener('keydown', this.handleKeydown)
    window.addEventListener('beforeunload', this.handleBeforeUnload)
    window.addEventListener('rg-content-field-commit', this.handleCanvasFieldCommit)
  },
  beforeDestroy () {
    window.clearTimeout(this.saveNoticeTimeout)
    if (this.removeRouteGuard) {
      this.removeRouteGuard()
    }
    window.removeEventListener('keydown', this.handleKeydown)
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
    window.removeEventListener('rg-content-field-commit', this.handleCanvasFieldCommit)
  },
  methods: {
    toggleToolbar () {
      this.$store.dispatch('SET_ACTIVE_BUILDER_PANEL', this.isOpen ? null : 'content')
    },
    handleKeydown (event) {
      if (event.key === 'Escape' && this.activeSectionId) {
        this.$store.dispatch('SET_ACTIVE_CONTENT_SECTION', null)
      }
    },
    handleBeforeUnload (event) {
      if (!this.hasUnsavedChanges) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    },
    changePage (path) {
      if (path && path !== this.$route.path) {
        this.$router.push(path)
      }
    },
    selectSection (id) {
      window.dispatchEvent(new CustomEvent('rg-select-content-section', { detail: { id } }))
    },
    toggleSectionEditor (id) {
      if (id === this.activeSectionId) {
        this.$store.dispatch('SET_ACTIVE_CONTENT_SECTION', null)
        return
      }

      this.selectSection(id)
    },
    handleCanvasFieldCommit (event) {
      const { sectionId, path, value } = event.detail || {}
      const section = this.sections.find(item => item.__builder_id === sectionId)

      if (!section || !Array.isArray(path)) {
        return
      }

      this.$store.dispatch('SET_ACTIVE_CONTENT_SECTION', sectionId)
      this.recordHistory(`canvas-${path.join('.')}`)
      this.$store.dispatch('UPDATE_CONTENT_SECTION', {
        key: this.pageKey,
        id: sectionId,
        patch: setPathValue(section, path, value)
      })
    },
    layoutLabel (layout) {
      return String(layout || 'Section')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase())
    },
    sectionLabel (section, index) {
      return section.title || section.heading || `${this.layoutLabel(section.acf_fc_layout)} ${index + 1}`
    },
    sectionIconSvg (layout) {
      const normalized = String(layout || '').toLowerCase()

      if (sectionIconByLayout[normalized]) {
        return sectionIconByLayout[normalized]
      }

      if (/(gallery|slider|smile)/.test(normalized)) {
        return galleryIcon
      }

      if (/(testimonial|review)/.test(normalized)) {
        return testimonialsIcon
      }

      if (/(form)/.test(normalized)) {
        return formIcon
      }

      if (/(mason)/.test(normalized)) {
        return masonryGridIcon
      }

      if (/(grid|row|logo|resource)/.test(normalized)) {
        return gridIcon
      }

      if (/(hero)/.test(normalized)) {
        return heroIcon
      }

      if (/(image|tab)/.test(normalized)) {
        return imageTextIcon
      }

      return ctaBannerIcon
    },
    recordHistory (editKey, force = true) {
      if (!this.page) {
        return
      }

      const now = Date.now()
      const isNewEdit = force || editKey !== this.lastEditKey || now - this.lastEditAt > historyCoalesceMs

      this.lastEditKey = editKey
      this.lastEditAt = now

      if (!isNewEdit) {
        return
      }

      this.undoStack.push(cloneContent(this.page))
      if (this.undoStack.length > historyLimit) {
        this.undoStack.shift()
      }
      this.redoStack = []
    },
    applySnapshot (page) {
      this.$store.dispatch('SET_CONTENT_PAGE', { key: this.pageKey, page })
      this.lastEditKey = null
    },
    undo () {
      if (!this.undoStack.length || !this.page) {
        return
      }

      this.redoStack.push(cloneContent(this.page))
      this.applySnapshot(this.undoStack.pop())
    },
    redo () {
      if (!this.redoStack.length || !this.page) {
        return
      }

      this.undoStack.push(cloneContent(this.page))
      this.applySnapshot(this.redoStack.pop())
    },
    clearHistory () {
      this.undoStack = []
      this.redoStack = []
      this.lastEditKey = null
    },
    showSaveNotice (message) {
      window.clearTimeout(this.saveNoticeTimeout)
      this.saveNotice = message
      this.saveNoticeTimeout = window.setTimeout(() => {
        this.saveNotice = ''
      }, 2000)
    },
    savePage () {
      if (!this.page) {
        return
      }

      const savedAt = new Date().toISOString()
      this.savedPages = { ...this.savedPages, [this.pageKey]: cloneContent(this.page) }
      this.savedAt = { ...this.savedAt, [this.pageKey]: savedAt }
      this.showSaveNotice('Draft saved')
      writeContentDrafts(this.savedPages, this.savedAt)
    },
    resetPage () {
      if (!this.baseline || !window.confirm('Reset this page to its original content?')) {
        return
      }

      this.recordHistory('reset-page')
      this.applySnapshot(this.baseline)
      const savedPages = { ...this.savedPages }
      const savedAt = { ...this.savedAt }
      delete savedPages[this.pageKey]
      delete savedAt[this.pageKey]
      this.savedPages = savedPages
      this.savedAt = savedAt
      this.showSaveNotice('Page reset')
      writeContentDrafts(savedPages, savedAt)
      this.$store.dispatch('SET_ACTIVE_CONTENT_SECTION', null)
    },
    addSection () {
      const section = createSection(this.newSectionLayout)

      if (!section) {
        return
      }

      this.recordHistory('add-section')
      this.$store.dispatch('ADD_CONTENT_SECTION', { key: this.pageKey, section })
      this.$nextTick(() => this.selectSection(section.__builder_id))
    },
    duplicateSection (section) {
      const duplicate = cloneContent(section)
      duplicate.__builder_id = createBuilderId(section.acf_fc_layout)
      duplicate.title = duplicate.title ? `${duplicate.title} Copy` : duplicate.title
      this.recordHistory('duplicate-section')
      this.$store.dispatch('DUPLICATE_CONTENT_SECTION', { key: this.pageKey, id: section.__builder_id, section: duplicate })
      this.$nextTick(() => this.selectSection(duplicate.__builder_id))
    },
    moveSection (section, direction) {
      this.recordHistory('move-section')
      this.$store.dispatch('MOVE_CONTENT_SECTION', { key: this.pageKey, id: section.__builder_id, direction })
    },
    toggleSection (section) {
      this.recordHistory('toggle-section')
      this.updateSection({ hide_component: !section.hide_component }, 'toggle-section', true)
    },
    removeSection (section) {
      if (!window.confirm(`Delete “${this.sectionLabel(section, 0)}”?`)) {
        return
      }

      this.recordHistory('remove-section')
      this.$store.dispatch('REMOVE_CONTENT_SECTION', { key: this.pageKey, id: section.__builder_id })
    },
    updateSection (patch, editKey = 'section', historyRecorded = false) {
      if (!this.activeSection) {
        return
      }

      if (!historyRecorded) {
        this.recordHistory(editKey, false)
      }
      this.$store.dispatch('UPDATE_CONTENT_SECTION', {
        key: this.pageKey,
        id: this.activeSection.__builder_id,
        patch
      })
    },
    updateSectionField ({ path, value, editKey }) {
      this.updateSection(setPathValue(this.activeSection, path, value), editKey)
    },
    updateSectionArray ({ action, path, index, value }) {
      const operations = {
        add: () => addPathItem(this.activeSection, path, value),
        duplicate: () => duplicatePathItem(this.activeSection, path, index),
        'move-up': () => movePathItem(this.activeSection, path, index, -1),
        'move-down': () => movePathItem(this.activeSection, path, index, 1),
        remove: () => removePathItem(this.activeSection, path, index)
      }

      if (!operations[action]) {
        return
      }

      this.recordHistory(`array-${path.join('.')}-${action}`)
      this.updateSection(operations[action](), `array-${action}`, true)
    },
    updateSEO (path, value) {
      if (!this.page) {
        return
      }

      const resolvedPath = Array.isArray(path) ? path : [path]
      this.recordHistory(`seo-${resolvedPath.join('.')}`, false)
      this.$store.dispatch('SET_CONTENT_PAGE', {
        key: this.pageKey,
        page: { ...this.page, seo: setSEOValue(this.page.seo, resolvedPath, value) }
      })
    },
    chooseOGImage (asset) {
      this.updateSEO(['social_meta', 'og_meta', 'image'], asset.src)
    }
  }
}
</script>

<style lang='sass' src='./index.sass'></style>
