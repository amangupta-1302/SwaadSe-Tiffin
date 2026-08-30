/* ============================================================================
 *  SwaadSe Tiffin — progressive enhancement only.
 *
 *  Nothing here is required for the page to work. With JavaScript disabled the
 *  full week's menu is visible, every FAQ answer opens, and every button works.
 *  This file only makes those things nicer:
 *
 *    1. "Next delivery" tag shows the real next window
 *    2. Today's Special + the weekly menu render from js/content.js
 *    3. every price comes from js/content.js, links included
 *    4. phone numbers and the address come from js/content.js too
 *    5. the week collapses into day tabs and opens on today
 *    6. header gets a shadow once scrolled
 *    7. mobile nav opens / closes
 *    8. sections fade in on scroll (skipped if the visitor prefers less motion)
 *    9. only one FAQ answer stays open at a time
 *   10. Google Maps loads on click, so it costs nothing until it is wanted
 *
 *  The date logic at the top is pure and unit-tested in tests/schedule.test.mjs.
 *  Do not put wording that customers read in this file — it belongs in
 *  index.html or js/content.js.
 * ========================================================================== */
(() => {
  'use strict';

  /* ══ pure scheduling logic — no DOM, unit-tested ═══════════════════════════ */

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /** The kitchen runs Monday–Saturday. Sunday is closed. */
  const isDeliveryDay = day => day >= 1 && day <= 6;

  /**
   * The next window a customer can actually receive food in.
   * @param {Date} now
   * @param {Array<{label: string, startHour: number, endHour: number}>} windows
   * @returns {{when: string, label: string}|null}
   */
  function nextDelivery(now, windows) {
    if (!Array.isArray(windows) || !windows.length) return null;
    // /admin/ appends a new window to the end of the list, and validate() has no
    // opinion about the order, so the earliest one has to be worked out rather
    // than assumed. Sorting a copy leaves the caller's array untouched.
    const ordered = [...windows].sort((a, b) => a.startHour - b.startHour);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const today = now.getDay();

    if (isDeliveryDay(today)) {
      // A window is still reachable until the moment it closes.
      const upcoming = ordered.find(w => minutes < w.endHour * 60);
      if (upcoming) return { when: 'Today', label: upcoming.label };
    }
    for (let ahead = 1; ahead <= 7; ahead++) {
      const day = (today + ahead) % 7;
      if (!isDeliveryDay(day)) continue;           // skip Sunday
      return { when: ahead === 1 ? 'Tomorrow' : DAY_NAMES[day], label: ordered[0].label };
    }
    return null;
  }

  /**
   * content.js lists Monday first; JavaScript's getDay() puts Sunday at 0.
   * @param {Date} date
   * @returns {number} index into SITE.weeklyMenu, 0 = Monday … 6 = Sunday
   */
  const menuIndexFor = date => (date.getDay() + 6) % 7;

  /**
   * The five address slots index.html asks for, or null when content.js holds
   * no real address and the baked markup should be left alone.
   *
   * A cleared optional line is not the same as a missing one. Once
   * addressLine1 is set the whole address is authoritative, so an emptied
   * line 2 has to blank its slots — otherwise the page shows last week's
   * "Kamla Nagar" next to a street slot that has already dropped it.
   *
   * @param {object} contact  SITE.contact
   * @returns {{line1: string, line2: string, 'city-state': string, street: string, short: string}|null}
   */
  function addressSlots(contact) {
    const text = key => String((contact && contact[key]) || '').trim();
    const line1 = text('addressLine1');
    if (!line1) return null;
    const line2 = text('addressLine2');
    const city = text('city');
    return {
      line1,
      line2,
      'city-state': [city, text('statePin')].filter(Boolean).join(', '),
      street: [line1, line2].filter(Boolean).join(', '),
      short: [line1, line2, city].filter(Boolean).join(', '),
    };
  }

  // Exposed so tests/schedule.test.mjs can import this file in Node. Assigning
  // to globalThis is a no-op cost in the browser.
  globalThis.SwaadSeSchedule = { nextDelivery, menuIndexFor, isDeliveryDay, DAY_NAMES, addressSlots };

  // Under the test runner there is no document; the pure logic above is all the
  // test needs, so stop here.
  if (typeof document === 'undefined') return;

  /* ══ DOM enhancements ═════════════════════════════════════════════════════ */

  // window === globalThis in a browser, so this reads content.js either way.
  const SITE = globalThis.SITE || null;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ── 1. next delivery window ───────────────────────────────────────────── */
  const tagValue = $('#next-delivery');
  if (tagValue && SITE) {
    const next = nextDelivery(new Date(), SITE.deliveryWindows);
    if (next) tagValue.textContent = `${next.when} · ${next.label}`;
  }

  /* ── 2. today's special ────────────────────────────────────────────────── */
  const special = $('#todays-special');
  if (special && SITE && SITE.todaysSpecial) special.textContent = SITE.todaysSpecial;

  /* ── 3. prices ─────────────────────────────────────────────────────────────
     Every element tagged data-price="<key>" takes its amount from
     SITE.prices, so the owner changes a price in one place.

     On a link, the amount lives inside the prefilled WhatsApp message rather
     than in the text, so the URL is rewritten instead. Miss this and the
     customer taps "Order This Plan" and sends a price we no longer charge.

     The amounts written into index.html stay as the fallback for a visitor
     with JavaScript off, so an unknown or malformed key leaves them alone. */
  const prices = SITE && SITE.prices;
  if (prices) {
    for (const el of $$('[data-price]')) {
      const value = prices[el.dataset.price];
      if (!Number.isInteger(value) || value <= 0) continue;
      if (el.tagName === 'A') {
        // getAttribute, not .href: the raw attribute keeps %E2%82%B9 encoded.
        el.setAttribute('href', el.getAttribute('href').replace(/%E2%82%B9\d+/, `%E2%82%B9${value}`));
      } else {
        el.textContent = `₹${value}`;
      }
    }

    /* "Saves ₹200 vs two single plans" — a claim, so it has to be recomputed
       rather than left as text. If the monthly pair stops being cheaper, the
       badge goes rather than lies. */
    const saves = $('.js-saves');
    if (saves) {
      const saved = 2 * prices['tier-one-meal'] - prices['tier-lunch-dinner'];
      if (Number.isInteger(saved) && saved > 0) saves.textContent = `Saves ₹${saved} vs two single plans`;
      else saves.remove();
    }
  }

  /* ── 4. phone numbers and address ──────────────────────────────────────────
     Every WhatsApp link uses the one WhatsApp number, so those are found by
     selector rather than tagged 25 times over. Call links differ, so each
     carries data-phone="<index into contact.phones>" — on the <a> it sets the
     tel: href, on a <span> it sets the number as customers read it. Address
     lines come from data-contact="<which line>".

     As with prices, the amounts and numbers written into index.html remain the
     fallback for a visitor with JavaScript off. */
  const contact = SITE && SITE.contact;
  if (contact) {
    // 91 for India, digits only, because that is what wa.me expects in a path.
    const waNumber = String(contact.whatsapp || '').replace(/\D/g, '');
    if (waNumber) {
      for (const link of $$('a[href*="wa.me/"]')) {
        link.setAttribute('href', link.getAttribute('href').replace(/wa\.me\/\d+/, `wa.me/${waNumber}`));
      }
    }

    const phones = (Array.isArray(contact.phones) ? contact.phones : [])
      .map(number => String(number).replace(/\D/g, ''))
      .filter(Boolean);

    for (const el of $$('[data-phone]')) {
      const number = phones[Number(el.dataset.phone)];
      // Missing or unusable: leave the number written into index.html alone,
      // the same rule prices follow. Removing the link instead would strip a
      // number but leave the " · " and <br> that separated it in the footer.
      if (!number) continue;
      if (el.tagName === 'A') el.setAttribute('href', `tel:+91${number}`);
      // 10 digits read as two groups of five on every Indian bill and card.
      else el.textContent = number.length === 10 ? `${number.slice(0, 5)} ${number.slice(5)}` : number;
    }

    // null means content.js has no address worth trusting — leave every baked
    // line alone, the same rule prices and phone numbers follow.
    const address = addressSlots(contact);
    if (address) for (const el of $$('[data-contact]')) {
      const value = address[el.dataset.contact];
      if (value !== undefined) el.textContent = value;
    }
  }

  /* ── 5. weekly menu: render from content.js, then collapse into tabs ───── */
  const menu = $('.js-menu');
  if (menu && SITE && Array.isArray(SITE.weeklyMenu) && SITE.weeklyMenu.length) {
    const tabList = $('.menu__tabs', menu);
    const panelWrap = $('.menu__panels', menu);
    const days = SITE.weeklyMenu;
    const tabs = [];
    const panels = [];

    tabList.replaceChildren();
    panelWrap.replaceChildren();

    days.forEach((entry, i) => {
      const id = `menu-day-${i}`;

      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'menu__tab';
      tab.id = `${id}-tab`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', id);
      if (entry.closed) tab.dataset.closed = 'true';
      if (i === menuIndexFor(new Date())) tab.dataset.today = 'true';
      tab.textContent = entry.short || entry.day;
      tabList.append(tab);
      tabs.push(tab);

      const panel = document.createElement('div');
      panel.className = 'menu__panel';
      panel.id = id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `${id}-tab`);

      const heading = document.createElement('p');
      heading.className = 'menu__day';
      heading.textContent = entry.day;
      panel.append(heading);

      if (entry.closed) {
        const note = document.createElement('p');
        note.className = 'menu__closed';
        note.textContent = entry.note || 'Closed.';
        panel.append(note);
      } else {
        const list = document.createElement('ul');
        list.className = 'menu__items';
        entry.items.forEach((item, index) => {
          const li = document.createElement('li');
          li.className = 'menu__item';
          li.style.setProperty('--i', index);   // staggers the lay-out, see styles.css §10
          li.textContent = item;
          list.append(li);
        });
        panel.append(list);
      }

      panelWrap.append(panel);
      panels.push(panel);
    });

    const select = (index, moveFocus) => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;         // the tablist is one stop in tab order
        panels[i].hidden = !on;
        panels[i].classList.remove('is-laying');
      });
      /* Replay the stagger on every change, not only the first paint. Reading
         offsetWidth forces the class removal to land before it is re-added;
         without it the browser folds both into one frame and nothing moves. */
      void panels[index].offsetWidth;
      panels[index].classList.add('is-laying');
      if (moveFocus) tabs[index].focus();
    };

    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', 'Menu by day');
    menu.classList.add('is-enhanced');

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', e => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (step) {
          e.preventDefault();
          select((i + step + tabs.length) % tabs.length, true);
        } else if (e.key === 'Home') {
          e.preventDefault();
          select(0, true);
        } else if (e.key === 'End') {
          e.preventDefault();
          select(tabs.length - 1, true);
        }
      });
    });

    select(Math.min(menuIndexFor(new Date()), tabs.length - 1));
  }

  /* ── 6. header shadow ──────────────────────────────────────────────────── */
  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 7. mobile nav ─────────────────────────────────────────────────────── */
  const toggle = $('.js-nav-toggle');
  const nav = $('#site-nav');
  if (toggle && nav) {
    const setOpen = open => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () =>
      setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    // Tapping a link closes the panel so the anchor jump is visible.
    nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ── 8. reveal on scroll ─────────────────────────────────────────────────
     A grid marked .reveal hands that job to its children instead, each numbered
     so they land in sequence rather than as one slab. This has to happen before
     the observer collects .reveal below, or the children are never watched.
     The cap keeps the food-pack grid from taking most of a second to arrive. */
  for (const group of $$('.grid.reveal, .tiers.reveal, .steps.reveal')) {
    group.classList.remove('reveal');
    [...group.children].forEach((child, i) => {
      child.classList.add('reveal');
      child.style.setProperty('--i', Math.min(i, 8));
    });
  }

  const reveals = $$('.reveal');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);        // fire once, then stop watching
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  /* ── 9. FAQ: one answer open at a time ─────────────────────────────────── */
  const faqItems = $$('.faq__item');
  faqItems.forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      faqItems.forEach(other => { if (other !== item) other.open = false; });
    });
  });

  /* ── 10. map on demand ──────────────────────────────────────────────────── */
  const mapBtn = $('.js-load-map');
  if (mapBtn) {
    mapBtn.addEventListener('click', () => {
      const host = mapBtn.closest('.map');
      const src = host && host.dataset.mapSrc;
      if (!src) return;
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.title = 'SwaadSe Tiffin location on Google Maps';
      frame.loading = 'lazy';
      frame.width = '100%';
      frame.height = '300';
      frame.style.border = '0';
      frame.style.borderRadius = 'var(--r-card)';
      frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      frame.setAttribute('allowfullscreen', '');
      host.replaceChildren(frame);
    });
  }
})();
