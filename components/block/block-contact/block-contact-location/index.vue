<template lang="pug" src="./index.pug" ></template>

<script>
import { Loader } from '@googlemaps/js-api-loader'
import Icon from '~/assets/icons/map-pin.svg'

/* eslint-disable */
export default {
  props: {
    props: {
      type: Object,
      default: () => ({})
    }
  },
  data: () => ({
    mapLoading: true,
    mapDestroyed: false,
  }),
  mounted () {
    const loadMap = new Loader ({
      apiKey: 'AIzaSyCQ0O4eUjDGqN1rjAEPViij-MemNaR-u6c'
    })
    loadMap.load().then(()=> {
      if (this.mapDestroyed || !this.$refs.theMap) {
        return
      }

      this.createMap()
      this.addMarker()
      this.mapLoading = false
    })
  },
  beforeDestroy () {
    this.mapDestroyed = true
    if (this.$marker) {
      this.$marker.setMap(null)
    }
    this.$marker = null
    this.$map = null
  },
  methods: {
    createMap () {
      this.$map = new google.maps.Map(this.$refs.theMap, {
        center: {
          lat: Number(this.props.address.coordinates.latitude),
          lng: Number(this.props.address.coordinates.longitude)
        },
        zoom: 15,
        streetViewControl: false,
        fullscreenControl: false,
        mapId: '876c2d412dd92ae2'
      })
    },
    addMarker () {
      this.$marker = new google.maps.Marker({
        position: {
          lat: Number(this.props.address.coordinates.latitude),
          lng: Number(this.props.address.coordinates.longitude)
        },
        map: this.$map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(Icon),
          scaledSize: new google.maps.Size(32, 32)
        }
      })
    }
  }
}
</script>

<style lang="sass" src="./index.sass"></style>
