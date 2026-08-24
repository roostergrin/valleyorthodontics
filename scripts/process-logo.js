const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const themeFile = path.join(__dirname, '../data/theme.json')
const cdnFile = path.join(__dirname, '../resources/cdn.js')
const outputPath = path.join(__dirname, '../assets/icons/logo.svg')
const outputPathWhite = path.join(__dirname, '../assets/icons/logo-white.svg')

function loadTheme () {
  try {
    const content = fs.readFileSync(themeFile, 'utf8')
    return JSON.parse(content)
  } catch (err) {
    console.error(`Error loading theme.json: ${err.message}`)
    return null
  }
}

// theme.json references media with the "{{cdn}}" token (see resources/cdn.js).
// This script is plain CommonJS run outside the Nuxt build, so it cannot import
// that ESM module — read the base out of it instead of duplicating the literal.
function cdnBase () {
  try {
    const match = fs.readFileSync(cdnFile, 'utf8').match(/export const cdn = '([^']+)'/)
    return match ? match[1] : null
  } catch (err) {
    return null
  }
}

function expandCdn (str) {
  if (!str || !str.includes('{{cdn}}')) { return str }
  const base = cdnBase()
  if (!base) {
    console.log('Could not resolve the {{cdn}} base from resources/cdn.js')
    return str
  }
  return str.replace(/\{\{cdn\}\}/g, base)
}

function isDataUri (str) {
  return str && str.startsWith('data:')
}

function isSvgDataUri (str) {
  return str && str.startsWith('data:image/svg+xml')
}

function isUrl (str) {
  return str && (str.startsWith('http://') || str.startsWith('https://'))
}

function decodeDataUri (dataUri) {
  // Handle: data:image/svg+xml;utf8,<encoded-svg>
  // Handle: data:image/svg+xml;base64,<base64-svg>

  const base64Match = dataUri.match(/^data:image\/svg\+xml;base64,(.+)$/)
  if (base64Match) {
    return Buffer.from(base64Match[1], 'base64').toString('utf8')
  }

  const utf8Match = dataUri.match(/^data:image\/svg\+xml;(?:charset=utf-8|utf8),(.+)$/i)
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1])
  }

  // Fallback: try to extract content after the comma
  const commaIndex = dataUri.indexOf(',')
  if (commaIndex !== -1) {
    const content = dataUri.substring(commaIndex + 1)
    try {
      return decodeURIComponent(content)
    } catch {
      return content
    }
  }

  return null
}

function downloadSvg (url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https://') ? https : http

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        return downloadSvg(response.headers.location).then(resolve).catch(reject)
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download SVG: HTTP ${response.statusCode}`))
        return
      }

      let data = ''
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => {
        // Verify it's SVG content
        if (!data.includes('<svg') && !data.includes('<?xml')) {
          reject(new Error('Downloaded content does not appear to be SVG'))
          return
        }
        resolve(data)
      })
    }).on('error', reject)
  })
}

function convertToWhite (svgContent) {
  // Replace all fill colors with white
  // Handles: fill="#xxx", fill="rgb(...)", fill: #xxx, fill: rgb(...)
  let whiteSvg = svgContent

  // Replace fill attributes with white
  whiteSvg = whiteSvg.replace(/fill\s*=\s*["']#[0-9a-fA-F]{3,6}["']/gi, 'fill="#ffffff"')
  whiteSvg = whiteSvg.replace(/fill\s*=\s*["']rgb\([^)]+\)["']/gi, 'fill="#ffffff"')

  // Replace fill in style attributes
  whiteSvg = whiteSvg.replace(/fill\s*:\s*#[0-9a-fA-F]{3,6}/gi, 'fill:#ffffff')
  whiteSvg = whiteSvg.replace(/fill\s*:\s*rgb\([^)]+\)/gi, 'fill:#ffffff')

  // Replace inline style fill with !important
  whiteSvg = whiteSvg.replace(/fill\s*:\s*rgb\([^)]+\)\s*!important/gi, 'fill:#ffffff !important')

  return whiteSvg
}

function writeSvg (svgContent) {
  // Ensure directory exists
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Write original logo
  fs.writeFileSync(outputPath, svgContent, 'utf8')
  console.log(`Logo saved to: ${outputPath}`)

  // Generate and write white version
  const whiteSvg = convertToWhite(svgContent)
  fs.writeFileSync(outputPathWhite, whiteSvg, 'utf8')
  console.log(`White logo saved to: ${outputPathWhite}`)
}

async function main () {
  console.log('Processing logo from theme.json...')

  const theme = loadTheme()
  if (!theme) {
    console.log('Could not load theme.json, skipping logo processing')
    return
  }

  const logoUrl = expandCdn(theme.default?.logo_url)

  if (!logoUrl) {
    console.log('No logo_url found in theme.json, skipping')
    return
  }

  try {
    let svgContent = null

    if (isSvgDataUri(logoUrl)) {
      console.log('Detected SVG data URI, decoding...')
      svgContent = decodeDataUri(logoUrl)
    } else if (isDataUri(logoUrl)) {
      console.log('Warning: Data URI is not SVG format, skipping')
      return
    } else if (isUrl(logoUrl) && logoUrl.match(/\.svg(\?|$)/i)) {
      console.log(`Downloading SVG from: ${logoUrl}`)
      svgContent = await downloadSvg(logoUrl)
    } else if (isUrl(logoUrl)) {
      console.log(`Logo is not SVG format (${logoUrl}), skipping SVG processing`)
      return
    } else {
      console.log('logo_url format not recognized, skipping')
      return
    }

    if (!svgContent) {
      console.log('Failed to extract SVG content')
      return
    }

    // Validate SVG content
    if (!svgContent.includes('<svg') && !svgContent.includes('<?xml')) {
      console.log('Warning: Content does not appear to be valid SVG')
      return
    }

    writeSvg(svgContent)
    console.log('Logo processing complete!')
  } catch (err) {
    console.error(`Error processing logo: ${err.message}`)
    // Don't exit with error - allow build to continue
  }
}

main()
