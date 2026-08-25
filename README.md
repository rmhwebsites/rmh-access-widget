# RMH Access Widget v2

A self-contained accessibility layer for Webflow (or any) site that you own outright. One script tag, zero dependencies, no subscription. It does two jobs:

1. **Auto-remediation engine**: silently fixes a battery of real WCAG 2.1/2.2 A and AA failures at runtime, tuned for the mistakes Webflow sites actually ship with.
2. **Preference panel**: an AccessBit-style widget (22 features + 4 one-click profiles) that lets visitors adapt the page to their needs.

## Verified results

Tested with axe-core 4.10 (WCAG 2.0/2.1 A+AA rulesets) against two production Webflow sites:

**cleaverdermatologyandaesthetics.com** (the target site):

| Condition | AA violation nodes |
|---|---|
| Bare page, no widget | 4 (unnamed links) |
| Widget installed, default state | **0** |

Plus fixes axe doesn't score: 23 new-tab links labeled with `noopener` added, 6 dropdown toggles wired with `aria-expanded`, the hamburger made keyboard-operable, `aria-current` on the active nav link, form alerts turned into live regions, and a skip link injected.

**palomapark.com** (worst-case template stress test):

| Condition | AA violation nodes |
|---|---|
| Bare page, no widget | 27 |
| Widget installed, default state | 19 (every automatable failure fixed; rest is brand-color contrast) |
| Widget + dark contrast mode active | **0** |

Brand-color contrast in the default view is a design decision no script should override; the widget's contrast modes give visitors a fully passing alternative, and true conformance still means fixing contrast in the Designer.

## What the remediation engine fixes automatically

| Fixer id | What it does | WCAG |
|---|---|---|
| `lang` | Sets `<html lang>` when missing | 3.1.1 |
| `viewport` | Removes `maximum-scale` / `user-scalable=no` zoom locks | 1.4.4 |
| `alt` | Adds `alt=""` to images with no alt attribute (stops filename announcements) | 1.1.1 |
| `names` | Names unnamed links/buttons: promotes text hidden with `display:none`/`aria-hidden` (the animated-tab template trick), recognizes 16 social/contact URL patterns, humanizes filenames (decodes URLs, strips Webflow asset IDs), falls back to "View image" | 2.4.4, 4.1.2 |
| `newtab` | Appends "(opens in new tab)" for screen readers and adds `rel="noopener"` on every `target="_blank"` link | 3.2.x |
| `current` | `aria-current="page"` on Webflow's `.w--current` nav links | 4.1.2 |
| `navbutton` | Makes the `.w-nav-button` hamburger div a real button: `role`, `tabindex`, label, Enter/Space activation, synced `aria-expanded` | 2.1.1, 4.1.2 |
| `dropdown` | `aria-haspopup` + synced `aria-expanded` on `.w-dropdown-toggle` | 4.1.2 |
| `slider` | Labels `.w-slider` arrows ("Previous/Next slide") and dots ("Slide 2 / 5") | 1.1.1, 4.1.2 |
| `forms` | Labels `.w-input`/select/textarea fields from placeholder or name; wires `.w-form-done`/`.w-form-fail` as `role="status"`/`role="alert"` live regions | 3.3.2, 4.1.3 |
| `iframes` | Adds `title` to untitled iframes ("Embedded content: youtube.com") | 4.1.2 |

Plus two always-on repairs outside the fixer list: a skip-to-content link (2.4.1) that finds `<main>` or Webflow's `.page-wrapper`/`.main-wrapper` (assigning `role="main"` when appropriate), and restored `:focus-visible` outlines (2.4.7) for templates that ship `outline: none`.

A MutationObserver re-runs all fixers (debounced) as Webflow IX2, CMS pagination, and tabs inject new DOM. Every fixer is idempotent and only adds what's missing, so it never fights Webflow's own runtime ARIA.

## The preference panel

**Profiles** (one click, combined settings): Vision impaired, Seizure safe, ADHD friendly, Dyslexia friendly.

**Text**: size stepper (100/110/125/140/160%), line height, letter spacing, readable font, dyslexia font, left-align, highlight links, highlight headings.

**Color** (mutually exclusive): dark contrast, light contrast, invert, grayscale, low saturation, high saturation.

**Reading & navigation**: big cursor, reading guide, reading mask, pause animations, hide images, mute media, focus highlight, bigger targets (pads sub-24px targets per WCAG 2.5.8), read-aloud-on-click (Web Speech API).

**Tools**: Page structure navigator, listing landmarks and the heading outline; click any entry to jump focus there.

Preferences persist in localStorage and re-apply on every page load. Alt+A opens the panel from the keyboard.

The panel itself meets AA: 44px targets, 3:1+ borders, 4.5:1+ text everywhere, modal dialog semantics with focus trap, Escape to close, focus return, `aria-pressed` states, and a polite live region announcing every change. UI ships in English and Spanish (`data-lang="es"`).

## Install on a Webflow site

1. Upload `access-widget.js` to the site's **Assets** panel (or any CDN) and copy the URL.
2. **Project Settings → Custom Code → Footer Code**:

```html
<script src="https://YOUR-URL/access-widget.js" defer
        data-position="bottom-left"
        data-statement-url="/accessibility-statement"
        data-feedback-email="access@example.com"></script>
```

3. Publish. Test with Alt+A.

Defaults are already Cleaver Dermatology & Aesthetics' palette, taken from the site's own Webflow design tokens (`--colors--dark-blue` `#165b91`, 7.1:1 on white), positioned bottom-left clear of the site's chat bubble. For other clients, set `data-accent` and `data-brand`.

Note: the site lives in a Webflow workspace that is not connected to the current Webflow integration (site id `690032f6301662f98be76300` returns 404 through the API), so install is a manual paste in Project Settings until that workspace is authorized.

### Full configuration reference

| Attribute | Default | Purpose |
|---|---|---|
| `data-accent` | `#165b91` | Header/active-state color. Auto-darkened until white text on it passes 4.5:1, so any brand color is safe |
| `data-brand` | `#165b91` | Trigger button color (icon only needs 3:1) |
| `data-position` | `bottom-left` | or `bottom-right` |
| `data-offset-x` / `data-offset-y` | `20` | Pixel offsets from the corner (dodge chat bubbles) |
| `data-statement-url` | none | "Accessibility statement" link in the panel footer |
| `data-feedback-email` | none | "Report an issue" mailto link |
| `data-lang` | `en` | Widget UI language (`en`, `es`) |
| `data-page-lang` | `en` | Value for `<html lang>` when the page has none |
| `data-storage-key` | `rmh-a11y-prefs-v2` | Change to reset all visitors' saved prefs |
| `data-fixes` | on | `off` disables the remediation engine entirely |
| `data-skip-fixes` | none | Comma list of fixer ids to skip, e.g. `alt,viewport` |

### Console API

`window.RMHAccess` exposes `version`, `open()`, `close()`, `reset()`, `state()`, and `report()`. `report()` returns per-fixer counts for the current page, also logged once on load, useful for auditing what the engine found on each client site.

## Try it locally

```bash
cd accessibility-widget && python3 -m http.server 8123
```

Then visit http://localhost:8123/demo.html — the demo page ships with every Webflow accessibility mistake deliberately included (zoom-locked viewport, suppressed outlines, div hamburger, unlabeled everything) so you can watch the report fix all of it.

## Architecture notes

- **Shadow DOM panel, mounted on `<html>` outside `<body>`**: the site's CSS can't touch the widget, contrast modes can't restyle it, and body-level effects can't break its fixed positioning.
- **Color filters live on `<html>`**: the root element is spec-exempt from `filter`'s containing-block rule, and Chrome paints root filters correctly while scrolled; filters on `<body>` break both.
- **Font scaling captures each element's base size once** (WeakSet-tracked) and always computes from the original, so adjustments never compound, including on Webflow CMS content injected later.
- **Pause animations forces near-zero duration instead of `animation: none`**: Webflow interactions animate opacity from 0, and killing the animation would leave content invisible; snapping to the end state keeps everything shown.
- **Icon-font protection**: font replacements exclude `w-icon-*`, Font Awesome, and Material classes so Webflow arrows and icons don't turn into letters.
- **No innerHTML anywhere**: all UI is DOM-built; config values can't inject markup.
- **Contrast guard**: the accent color is programmatically darkened until white-on-accent passes 4.5:1, so the widget can never be configured into failing its own standard.

## Honest limits (read before selling this)

The engine fixes what a script can prove. It cannot write meaningful alt text (it can only stop the worst behavior), fix heading order, rewrite low-contrast brand styling in the default view, or make custom div-soup interactions keyboard-operable. Getting a site to defensible WCAG 2.1 AA still means: real alt text in the Designer, one H1 and ordered headings, 4.5:1 body text, keyboard-testing every interaction, and an accessibility statement page. The widget then covers the long tail and gives visitors adaptation tools, which is exactly the layered story that holds up if a demand letter ever arrives.

## Productization checklist

- Minify + version the filename (`access-widget-2.0.0.min.js`), host on a CDN with far-future caching.
- Domain licensing: a tiny serverside check of `location.hostname`; the widget already reads all config from its own script tag.
- Add languages by extending the `I18N` object (~40 strings).
- An accessibility statement generator page is a cheap add-on competitors charge for.
- Per-client install is two attributes: `data-accent`, `data-brand`.
