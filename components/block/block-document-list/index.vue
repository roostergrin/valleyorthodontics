<template lang='pug' src='./index.pug'></template>

<script>

/**
 * Grouped list of downloadable documents, one tab per audience.
 *
 * Built for the patient folders on /for-new-patients: the same eight PDFs the
 * practice used to hand out on paper, split into child / teen / adult sets that
 * overlap heavily. Tabs keep a patient who scans the in-office QR code from
 * scrolling past two folders that are not theirs, and because every panel is
 * rendered server-side (only `hidden` toggles) all of the documents stay in the
 * static HTML.
 */
export default {
  props: {
    // 'h1' when this block is the first rendered section on the page, otherwise
    // 'h2'. Passed down from page-sections, as with block-resource-grid.
    headingLevel: {
      type: String,
      default: 'h2'
    },
    props: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    return {
      active: 0
    }
  },
  computed: {
    groups () {
      return (this.props.groups || []).filter(group => group && (group.documents || []).length)
    },
    // Ids have to be stable between the server render and hydration, and unique
    // if the block is ever used twice on one page, so they key off the section
    // hash rather than a counter.
    idBase () {
      const hash = this.props.component_options && this.props.component_options.hash
      return String(hash || this.props.title || 'documents')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'documents'
    }
  },
  methods: {
    tabId (i) {
      return `${this.idBase}-tab-${i}`
    },
    panelId (i) {
      return `${this.idBase}-panel-${i}`
    },
    docAria (doc) {
      if (doc.aria_label) {
        return doc.aria_label
      }
      // The link text alone reads as a page name; screen reader users get no
      // warning that it is a PDF opening in a new tab unless it is said here.
      return `${this.stripTags(doc.title)} (PDF, opens in a new tab)`
    },
    stripTags (value) {
      return String(value || '').replace(/<[^>]*>/g, '')
    },
    select (i) {
      this.active = i
    },
    focusTab (i) {
      this.active = i
      this.$nextTick(() => {
        const tabs = this.$refs.tabs
        if (tabs && tabs[i]) {
          tabs[i].focus()
        }
      })
    },
    onTabKeydown (event, i) {
      const last = this.groups.length - 1
      const moves = {
        ArrowRight: i === last ? 0 : i + 1,
        ArrowDown: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        ArrowUp: i === 0 ? last : i - 1,
        Home: 0,
        End: last
      }

      if (!(event.key in moves)) {
        return
      }

      event.preventDefault()
      this.focusTab(moves[event.key])
    }
  }
}
</script>

<style lang="sass" src="./index.sass"></style>
