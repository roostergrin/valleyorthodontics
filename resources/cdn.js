// CDN base for media hosted on CloudFront. In data/*.json, reference these
// assets with the "{{cdn}}" token (e.g. "{{cdn}}/uploads/2024/09/foo.webp") and
// it is expanded to the full URL at load time. No trailing slash — always start
// the path with "/".
//
// The distribution's origin path is /assets, so {{cdn}}/uploads/foo.webp resolves
// to s3://valleyorthodontics/assets/uploads/foo.webp.
//
// This lives in its own module (rather than in api.js) because config/nuxt.config.js
// needs the expander at build time for the raw fs reads that feed the global <head>,
// and importing utils.js there would pull in the whole data layer.
export const cdn = 'https://d1euqd8u2uyjl7.cloudfront.net'

// Recursively expand the "{{cdn}}" token in any string within the given data so
// that JSON content can reference CloudFront assets without hard-coding the URL.
export const expandCdnTokens = (data) => {
  if (typeof data === 'string') {
    return data.replace(/\{\{cdn\}\}/g, cdn)
  }
  if (Array.isArray(data)) {
    return data.map(expandCdnTokens)
  }
  if (data && typeof data === 'object') {
    const out = {}
    for (const key of Object.keys(data)) {
      out[key] = expandCdnTokens(data[key])
    }
    return out
  }
  return data
}
