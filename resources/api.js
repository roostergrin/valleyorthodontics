// Update the api to the api address of your project, i.e. https://api.arbitmanortho.com or https://api-oaktonbraces.roostertest2.com
// Update the url variable to the address where your project will be launched, i.e. https://www.arbitmanortho.com or https://hollevoetorthodontics.com

export const api = 'https://www.valleyorthodontics.net/wp-json'
// Make sure the url contains the trailing "/"
export const url = 'https://www.valleyorthodontics.net/'

// The CDN base and the {{cdn}} token expander live in resources/cdn.js so that
// config/nuxt.config.js can use the expander at build time without importing the
// whole data layer. Re-exported here for back-compat with existing imports.
export { cdn, expandCdnTokens } from './cdn'
