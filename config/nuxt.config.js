import fs from 'fs'
import path from 'path'
import { expandCdnTokens } from '../resources/cdn'
import { siteHead } from './head.config.js'
import buildConfig from './build.config.js'
import { siteMap, setRobots } from './seo.config'
import { getLocalBlogRoutes, getLocalDynamicRoutes } from './routes.config'
import 'core-js/features/array/at'

// Load theme.json using absolute path from project root
const themeFile = path.join(process.cwd(), 'data', 'theme.json')
// Expanded here too: this raw read bypasses getThemeJSON(), and theme.favicon_url
// feeds siteHead() — an unexpanded {{cdn}} token would ship literally into <head>.
const theme = expandCdnTokens(JSON.parse(fs.readFileSync(themeFile, 'utf8')))
const getHomeMeta = () => {
  const pagesFile = path.join(process.cwd(), 'data', 'pages.json')
  const pages = JSON.parse(fs.readFileSync(pagesFile, 'utf8'))
  const seo = expandCdnTokens(pages.Home.find(section => section.seo).seo)

  return {
    title: 'home',
    seo
  }
}

// Extract Google Fonts from theme.json typography
const systemFonts = ['helvetica', 'arial', 'sans-serif', 'serif', 'monospace', 'georgia']
const typography = (theme.default && theme.default.typography) || []
const googleFonts = typography
  .flatMap(entry => (entry.font.match(/'([^']+)'/g) || []))
  .map(font => font.replace(/'/g, ''))
  .filter(font => !systemFonts.includes(font.toLowerCase()))
  .map(font => `${font.replace(/\s+/g, '+')}:400,600,700`)

// Add display=swap to last font for better loading performance
if (googleFonts.length > 0) {
  googleFonts[googleFonts.length - 1] += '&display=swap'
}

export default () => {
  const meta = getHomeMeta()
  return {
    server: {
      port: 8081,
      host: '0.0.0.0'
    },
    target: 'static',
    generate: {
      // Built entirely from the local data/ mirror. The live WordPress API is
      // deliberately not consulted: it is hosted on the domain this site
      // replaces, so it disappears at cutover.
      routes () {
        return [...new Set([...getLocalDynamicRoutes(), ...getLocalBlogRoutes()])]
      },
      // Dev-only tooling: kept for `npm run dev`, never shipped. /style-guide
      // also calls the live WordPress API, which will not exist post-cutover.
      //
      // /blog is a middleware-only redirect to /blog/page/1, and it reached the
      // build from two independent sources that each need blocking: pages/blog/
      // index.vue, filtered here, and the `blog` key in pages.json, filtered by
      // dataOnlyPageKeys in routes.config.js. This list alone is not enough —
      // routes() results are merged in by decorateWithPayloads after this filter
      // runs. Excluded rather than deleting the page component, so client-side
      // navigation to /blog still redirects. Anchored so /blog/page/N and
      // /blog/<slug> still generate.
      exclude: [/^\/style-guide/, /^\/blog\/?$/]
    },
    head: siteHead(meta, theme),
    globalName: 'globalContent',
    loading: { color: '#fff' },
    components: {
      dirs: [
        '~/components',
        '~/components/custom',
        '~/components/block'
      ]
    },
    polyfill: {
      features: [
        {
          require: 'intersection-observer',
          detect: () => 'IntersectionObserver' in window
        }
      ]
    },
    plugins: [
      '~/resources/components',
      '~/resources/mixins',
      '~/resources/vendors.js',
      {
        src: '~/resources/vendors.client.js',
        mode: 'client'
      },
      {
        src: '~/resources/userway.js',
        mode: 'client'
      }
    ],
    modules: [
      '@nuxtjs/axios',
      '@nuxtjs/style-resources',
      ...(googleFonts.length > 0 ? ['nuxt-webfontloader'] : []),
      '@nuxtjs/robots',
      '@nuxtjs/sitemap',
      'nuxt-polyfill'
    ],
    // Analytics is GA4 loaded directly in config/head.config.js. @nuxtjs/gtm was
    // registered here with its config commented out (and a template-default
    // container id), so it shipped a module with no container — removed rather
    // than run two tag systems.
    robots: setRobots,
    sitemap: siteMap,
    css: [
      { src: '~/styles/static/normalize.sass', lang: 'sass' },
      { src: '~/styles/index.sass', lang: 'sass' }
    ],
    styleResources: {
      sass: [
        '~/styles/base/*.sass',
        '~/styles/utilities/*.sass',
        '~/styles/grid/*.sass'
      ]
    },
    stylelint: {
      files: [
        'styles/*.sass',
        'styles/**/*.sass',
        'components/**/*.sass',
        'components/**/**/*.sass'
      ]
    },
    ...(googleFonts.length > 0 && {
      webfontloader: {
        google: {
          families: googleFonts
        }
      }
    }),
    buildModules: [
      '@nuxtjs/eslint-module',
      '@nuxtjs/stylelint-module',
      'nuxt-gsap-module'
    ],
    gsap: {
      extraPlugins: {
        scrollTrigger: true
      },
      clubPlugins: {
        customEase: true,
        splitText: true
      },
      extraEases: {
        customEase: true
      }
    },
    vue: {
      config: {
        productionTip: false
      }
    },
    build: buildConfig
  }
}
