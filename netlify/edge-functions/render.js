/* ============================================================================
 *  Edge renderer — fills the page from Supabase before it reaches the visitor.
 * ============================================================================
 *
 *  Reading server-side rather than from the browser keeps the no-JavaScript
 *  contract, keeps a second origin out of the first paint, and lets crawlers
 *  see real content.
 *
 *  It must never break the page. Every failure path returns the response
 *  untouched and the values baked into index.html serve instead — stale, but a
 *  working page with real prices. No path here produces a blank menu.
 *
 *  ponytail: the price/phone/address rules also exist in js/main.js §2-4, which
 *  still runs in the browser. Same state in, same output out, so they cannot
 *  disagree unless one has a bug. The client copy is the second safety net and
 *  what tests/schedule.test.mjs exercises; revisit if the two ever drift.
 * ========================================================================== */

// Side-effect import: sets globalThis.SwaadSeSchedule, so "a cleared
// addressLine2 blanks its slots" is defined once. main.js returns early with no
// document, so nothing DOM-related runs.
import '../../js/main.js';

const { addressSlots } = globalThis.SwaadSeSchedule;

/* Long enough that a burst of traffic is one Supabase read, short enough that
   the owner does not sit watching a stale page after pressing Save. */
const TTL_MS = 30_000;

/* Module scope, so it survives between requests on a warm isolate. Best-effort
   by nature — a cold isolate starts empty and that is handled, not prevented. */
let cache = { state: null, at: 0 };

const esc = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The latest published state, or the last one we saw if Supabase is unreachable.
 * Returns null only on a cold isolate that has never had a successful read —
 * the caller treats that as "serve the page untouched".
 */
async function loadState() {
  const now = Date.now();
  if (cache.state && now - cache.at < TTL_MS) return cache.state;

  const url = (Netlify.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const key = Netlify.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) {
    console.error('[render] SUPABASE_URL or SUPABASE_ANON_KEY is unset — serving baked values');
    return cache.state;
  }

  try {
    const res = await fetch(`${url}/rest/v1/site_state?select=state&order=id.desc&limit=1`, {
      // The anon key goes on apikey; publishable keys are rejected as a Bearer
      // token on their own, which is why both headers are sent.
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    const state = (await res.json())?.[0]?.state;
    if (!state || typeof state !== 'object') throw new Error('no published state');
    cache = { state, at: now };
    return state;
  } catch (error) {
    /* Loud on purpose: a silent fallback is indistinguishable from working, and
       the host is named because the two likeliest causes look identical
       otherwise — the wrong project, and the right project with no anon grant. */
    console.error(`[render] could not read the published state from ${url}: `
      + `${error?.message || error}`
      + (cache.state ? ' — serving the last good copy' : ' — serving baked values'));
    // Stale-if-error, with no expiry: a menu from an hour ago beats no menu.
    return cache.state;
  }
}

/**
 * Index just past the `</div>` that closes the `<div` starting at `start`.
 * Used to swap the whole menu block out, which is the one slot whose markup is
 * generated rather than filled in.
 */
function matchingDivEnd(html, start) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  return -1;
}

/** The no-JavaScript week. main.js replaces this with tabs when it runs. */
function menuMarkup(weeklyMenu) {
  const panels = weeklyMenu.map(entry => {
    const body = entry.closed
      ? `<p class="menu__closed">${esc(entry.note || 'Closed.')}</p>`
      : `<ul class="menu__items">${
          (Array.isArray(entry.items) ? entry.items : [])
            .map(item => `<li class="menu__item">${esc(item)}</li>`).join('')
        }</ul>`;
    return `<div class="menu__panel"><p class="menu__day">${esc(entry.day)}</p>${body}</div>`;
  }).join('');

  return `<div class="menu js-menu reveal"><div class="menu__tabs"></div>`
       + `<div class="menu__panels">${panels}</div></div>`;
}

/**
 * Fill every slot in the served HTML from `state`.
 *
 * Text is only ever written into elements whose content has no nested tags —
 * the `[^<]*` in the pattern below is what guarantees that, so this bails out
 * rather than mangling anything it does not fully understand. Links are handled
 * by rewriting the opening tag alone, because the amount lives inside the
 * prefilled WhatsApp message rather than in the link text.
 *
 * @param {string} html   the page as served from disk
 * @param {object} state  the published SITE object
 * @returns {string}
 */
export function renderHtml(html, state) {
  const prices = state.prices || {};
  const contact = state.contact || {};
  const address = addressSlots(contact);
  const waNumber = String(contact.whatsapp || '').replace(/\D/g, '');
  const phones = (Array.isArray(contact.phones) ? contact.phones : [])
    .map(number => String(number).replace(/\D/g, ''))
    .filter(Boolean);

  const priceOf = key => {
    const value = prices[key];
    return Number.isInteger(value) && value > 0 ? value : null;
  };

  let out = html;

  /* ── the weekly menu ─────────────────────────────────────────────────────── */
  if (Array.isArray(state.weeklyMenu) && state.weeklyMenu.length) {
    const start = out.indexOf('<div class="menu js-menu');
    const end = start === -1 ? -1 : matchingDivEnd(out, start);
    if (end !== -1) out = out.slice(0, start) + menuMarkup(state.weeklyMenu) + out.slice(end);
  }

  /* ── links: the number and the price live in the href ────────────────────── */
  out = out.replace(/<a\b[^>]*>/gi, tag => {
    let next = tag;
    if (waNumber && /wa\.me\//.test(next)) {
      next = next.replace(/wa\.me\/\d+/, `wa.me/${waNumber}`);
    }
    const priceKey = /\bdata-price="([^"]+)"/.exec(next)?.[1];
    if (priceKey) {
      const value = priceOf(priceKey);
      // %E2%82%B9 is the rupee sign, URL-encoded inside the prefilled message.
      if (value) next = next.replace(/%E2%82%B9\d+/, `%E2%82%B9${value}`);
    }
    const phoneIndex = /\bdata-phone="(\d+)"/.exec(next)?.[1];
    if (phoneIndex !== undefined) {
      const number = phones[Number(phoneIndex)];
      if (number) next = next.replace(/href="tel:[^"]*"/, `href="tel:+91${number}"`);
    }
    return next;
  });

  /* ── flat elements: replace the text, or drop the element ────────────────── */
  out = out.replace(/<(span|p)\b([^>]*)>([^<]*)<\/\1>/gi, (whole, tag, attrs, text) => {
    const write = value => `<${tag}${attrs}>${esc(value)}</${tag}>`;

    if (/\bid="todays-special"/.test(attrs)) {
      return state.todaysSpecial ? write(state.todaysSpecial) : whole;
    }

    /* A claim, not a label: if the monthly pair stops being cheaper the badge
       is removed rather than left saying something untrue. */
    if (/\bclass="[^"]*\bjs-saves\b/.test(attrs)) {
      const single = prices['tier-one-meal'];
      const both = prices['tier-lunch-dinner'];
      // No figures to recompute from is not the same as "the saving is gone" —
      // leave the baked badge alone rather than deleting it over missing data.
      if (!Number.isInteger(single) || !Number.isInteger(both)) return whole;
      const saved = 2 * single - both;
      return saved > 0 ? write(`Saves ₹${saved} vs two single plans`) : '';
    }

    const priceKey = /\bdata-price="([^"]+)"/.exec(attrs)?.[1];
    if (priceKey) {
      const value = priceOf(priceKey);
      return value ? write(`₹${value}`) : whole;
    }

    const phoneIndex = /\bdata-phone="(\d+)"/.exec(attrs)?.[1];
    if (phoneIndex !== undefined) {
      const number = phones[Number(phoneIndex)];
      if (!number) return whole;
      // Ten digits read as two groups of five on every Indian bill and card.
      return write(number.length === 10 ? `${number.slice(0, 5)} ${number.slice(5)}` : number);
    }

    const slot = /\bdata-contact="([^"]+)"/.exec(attrs)?.[1];
    if (slot && address) {
      const value = address[slot];
      // `!== undefined`, never a truthiness test: an emptied addressLine2 must
      // clear its slot, or the page shows last week's line beside a street slot
      // that already dropped it.
      return value !== undefined ? write(value) : whole;
    }

    return whole;
  });

  /* ── hand the same state to main.js for the parts that need a clock ────────
     Anchored to the content.js tag, not </head>: index.html loads that file in
     the head and /admin/ loads it at the end of the body, and landing before it
     would let the fallback file overwrite the published state. */
  const json = JSON.stringify(state).replace(/</g, '\\u003c');
  out = out.replace(/<script src="[^"]*js\/content\.js"><\/script>/,
    tag => `${tag}<script>window.SITE=${json};</script>`);

  return out;
}

export default async (request, context) => {
  const response = await context.next();
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const state = await loadState();
  const html = await response.text();
  if (!state) return new Response(html, { status: response.status, headers: response.headers });

  let out = html;
  try {
    out = renderHtml(html, state);
  } catch {
    out = html;   // never let a rendering bug take the page down
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');            // the body is a different size now
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return new Response(out, { status: response.status, headers });
};

/* /admin/ is here for the state injection alone — it carries none of the slots
   above. Without it the editor would open on js/content.js, which nothing
   writes any more, and every save would republish that frozen snapshot. */
export const config = {
  path: ['/', '/index.html', '/privacy.html', '/terms.html', '/admin/'],
};
