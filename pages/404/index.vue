<template lang="pug" src="./index.pug"></template>

<script>

export default {
  props: {
    props: {
      type: Object,
      default: () => ({})
    }
  },
  // This route is still generated (layouts/error.vue handles thrown errors),
  // so keep it out of the index explicitly.
  head () {
    return {
      title: 'Page not found',
      meta: [
        { hid: 'robots', name: 'robots', content: 'noindex, follow' }
      ]
    }
  },
  mounted () {
    this.$nextTick(() => {
      setTimeout(() => {
        this.$store.dispatch('VIEW_SITE', true)
      }, 100)
    })
  }
}
</script>

<style lang="sass" src="./index.sass"></style>
