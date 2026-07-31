/* ============================================================================
 *  SwaadSe Tiffin — progressive enhancement only.
 *
 *  Nothing here is required for the page to work. With JavaScript disabled the
 *  full week's menu is visible, every FAQ answer opens, and every button works.
 *  This file only makes those things nicer:
 *
 *    1. "Next delivery" tag shows the real next window
 *    2. Today's Special + the weekly menu render from js/content.js
 *    3. the week collapses into day tabs and opens on today
 *    4. header gets a shadow once scrolled
 *    5. mobile nav opens / closes
 *    6. sections fade in on scroll (skipped if the visitor prefers less motion)
 *    7. only one FAQ answer stays open at a time
 *    8. Google Maps loads on click, so it costs nothing until it is wanted
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
    const minutes = now.getHours() * 60 + now.getMinutes();
    const today = now.getDay();

    if (isDeliveryDay(today)) {
      // A window is still reachable until the moment it closes.
      const upcoming = windows.find(w => minutes < w.endHour * 60);
      if (upcoming) return { when: 'Today', label: upcoming.label };
    }
    for (let ahead = 1; ahead <= 7; ahead++) {
      const day = (today + ahead) % 7;
      if (!isDeliveryDay(day)) continue;           // skip Sunday
      return { when: ahead === 1 ? 'Tomorrow' : DAY_NAMES[day], label: windows[0].label };
    }
    return null;
  }

  /**
   * content.js lists Monday first; JavaScript's getDay() puts Sunday at 0.
   * @param {Date} date
   * @returns {number} index into SITE.weeklyMenu, 0 = Monday … 6 = Sunday
   */
  const menuIndexFor = date => (date.getDay() + 6) % 7;

  // Exposed so tests/schedule.test.mjs can import this file in Node. Assigning
  // to globalThis is a no-op cost in the browser.
  globalThis.SwaadSeSchedule = { nextDelivery, menuIndexFor, isDeliveryDay, DAY_NAMES };

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

  /* ── 3. weekly menu: render from content.js, then collapse into tabs ───── */
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
        for (const item of entry.items) {
          const li = document.createElement('li');
          li.className = 'menu__item';
          li.textContent = item;
          list.append(li);
        }
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
      });
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

  /* ── 4. header shadow ──────────────────────────────────────────────────── */
  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 5. mobile nav ─────────────────────────────────────────────────────── */
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

  /* ── 6. reveal on scroll ───────────────────────────────────────────────── */
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

  /* ── 7. FAQ: one answer open at a time ─────────────────────────────────── */
  const faqItems = $$('.faq__item');
  faqItems.forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      faqItems.forEach(other => { if (other !== item) other.open = false; });
    });
  });

  /* ── 8. map on demand ──────────────────────────────────────────────────── */
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
