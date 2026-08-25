/* eslint-disable */
/**
 * UserWay accessibility widget.
 *
 * Loaded on idle rather than immediately: it is ~70KB of third-party script that
 * renders a trigger button, so nothing about the first paint depends on it, and
 * on a throttled mobile connection it was competing with the page's own assets.
 * The noscript notice is appended right away — it costs nothing and is only ever
 * shown when scripts do not run at all.
 */
export default () => {
  const appendNoscript = (d) => {
    const ns = d.createElement('noscript')
    ns.innerHTML = `Please ensure Javascript is enabled for purposes of <a href="https://userway.org">website accessibility</a>`
    ;(d.body || d.head).appendChild(ns)
  }

  const appendWidget = (d) => {
    const s = d.createElement('script')
    s.setAttribute('data-account', 'D3656BNpyD')
    s.setAttribute('data-trigger', 'accessibilityWidget')
    s.setAttribute('src', 'https://cdn.userway.org/widget.js')
    s.async = true
    ;(d.body || d.head).appendChild(s)
  }

  appendNoscript(document)

  // Whichever comes first: the browser going idle, or a visitor interacting.
  // Interaction is included so someone reaching for the widget immediately is
  // never left waiting on the idle callback.
  let loaded = false
  const load = () => {
    if (loaded) {
      return
    }
    loaded = true
    events.forEach(event => window.removeEventListener(event, load))
    appendWidget(document)
  }

  const events = ['pointerdown', 'keydown', 'touchstart']
  events.forEach(event => window.addEventListener(event, load, { once: true, passive: true }))

  if (window.requestIdleCallback) {
    window.requestIdleCallback(load, { timeout: 4000 })
  } else {
    window.setTimeout(load, 2500)
  }
}
