<template lang="pug">
.pages-accessibility
  .pages-accessibility__container
  h1.pages-accessibility__title Accessibility Statement
  .pages-accessibility__col
    p {{ props.company_name }} is committed to facilitating the accessibility and usability of its website, {{ props.domain }}, for everyone.  {{ props.company_name }} aims to comply with all applicable standards, including the World Wide Web Consortium's Web Content Accessibility Guidelines 2.0 up to Level AA (WCAG 2.0 AA).
    p {{ props.company_name }} is proud of the efforts that we have completed and that are in-progress to ensure that our website is accessible to everyone. Should you experience any difficulty in accessing any part of this website #[span(v-if='props.phone.number') , please feel free to call us at {{ props.phone.number }} or ] email us at #[a(:href='"mailto:" + props.email' tabindex='0') {{ props.email }} ] and we will work with you to provide the information or service you seek through an alternate communication method that is accessible for you consistent with applicable law (for example, through telephone support).
</template>

<script>
import { setJSONData, setMeta } from '~/resources/utils'

export default {
  components: {},
  async asyncData () {
    const data = await setJSONData('global', 'globalData')
    return { props: data }
  },
  head () {
    const title = `Accessibility Statement - ${this.props.company_name}`
    const description = `${this.props.company_name} is committed to facilitating the accessibility and usability of its website for everyone.`

    return setMeta({
      path: this.$route.path,
      title,
      seo: {
        page_title: title,
        page_description: description
      }
    })
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
