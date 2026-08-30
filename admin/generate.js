/* ============================================================================
 *  Admin editor — validation and file generation.
 *
 *  Pure functions, no DOM. Kept out of admin/index.html so Node can import them
 *  and prove the generated file is valid JavaScript with the right shape. This
 *  is the riskiest code in the project: if it emits a broken content.js, the
 *  live menu silently falls back to the static copy in index.html and nobody
 *  notices for a week. Tested in tests/admin.test.mjs.
 * ========================================================================== */
(() => {
  'use strict';

  /** JSON.stringify handles quoting and escaping correctly, including quotes
   *  and backslashes a customer's dish name might contain. */
  const q = value => JSON.stringify(String(value));

  /** Phone numbers are stored as digits only; the website adds +91 and spacing. */
  const digits = value => String(value ?? '').replace(/\D/g, '');

  /**
   * Every price on the website, in the order the owner meets them on the page.
   * The `key` must match a data-price="…" attribute in index.html — a test
   * fails if the two lists ever drift apart. This list is also what the admin
   * page builds its input boxes from, so adding a price here is the only edit
   * needed to make it editable.
   * @type {Array<{key: string, group: string, label: string}>}
   */
  const PRICE_FIELDS = [
    { key: 'plan-basic',         group: 'Meal plans',           label: 'Basic Veg Tiffin' },
    { key: 'plan-standard',      group: 'Meal plans',           label: 'Standard Veg Tiffin' },
    { key: 'plan-premium',       group: 'Meal plans',           label: 'Premium Veg Tiffin' },
    { key: 'plan-deluxe',        group: 'Meal plans',           label: 'Deluxe Veg Tiffin' },
    { key: 'tier-lunch-dinner',  group: 'Monthly subscription', label: 'Monthly Lunch + Dinner' },
    { key: 'tier-one-meal',      group: 'Monthly subscription', label: 'Monthly One-Time Meal' },
    { key: 'tier-single',        group: 'Monthly subscription', label: 'Single Meal' },
    { key: 'pack-dal',           group: 'Food packs',           label: 'Dal (400 ml)' },
    { key: 'pack-rice',          group: 'Food packs',           label: 'Rice (400 ml)' },
    { key: 'pack-roti',          group: 'Food packs',           label: '4 Roti' },
    { key: 'pack-shahi-paneer',  group: 'Food packs',           label: 'Shahi Paneer' },
    { key: 'pack-butter-paneer', group: 'Food packs',           label: 'Butter Paneer Masala' },
    { key: 'pack-raita',         group: 'Food packs',           label: 'Mixed Raita' },
    { key: 'pack-mutter-paneer', group: 'Food packs',           label: 'Mutter Paneer' },
    { key: 'pack-naan',          group: 'Food packs',           label: 'Butter Naan (2 pcs)' },
  ];

  /**
   * index.html shows three phone numbers, and data-phone="0|1|2" points at
   * these slots. The count is fixed on purpose: letting the owner add a fourth
   * would need a fourth place on the page to put it.
   */
  const PHONE_COUNT = 3;

  /** The address boxes the editor offers, in the order they read on the page. */
  const ADDRESS_FIELDS = [
    { key: 'addressLine1', label: 'Address line 1' },
    { key: 'addressLine2', label: 'Address line 2' },
    { key: 'city', label: 'City' },
    { key: 'statePin', label: 'State and PIN code' },
  ];

  /**
   * @param {object} state  { todaysSpecial, weeklyMenu, deliveryWindows, prices, contact }
   * @returns {Array<[('error'|'warn'), string]>} empty when the state is clean.
   *   'error' blocks saving; 'warn' is advice the owner may override.
   */
  function validate(state) {
    const issues = [];

    if (!state || typeof state !== 'object') return [['error', 'No menu data to check.']];

    if (!String(state.todaysSpecial || '').trim())
      issues.push(['error', 'Today’s special is empty. The website would show a blank line.']);

    const days = Array.isArray(state.weeklyMenu) ? state.weeklyMenu : [];
    if (days.length !== 7)
      issues.push(['error', `The week must have exactly 7 days; this has ${days.length}.`]);

    days.forEach(entry => {
      if (entry.closed) {
        if (!String(entry.note || '').trim())
          issues.push(['error', `${entry.day} is marked closed but has no message for customers.`]);
        return;
      }
      const items = Array.isArray(entry.items) ? entry.items : [];
      const filled = items.filter(d => String(d).trim());
      if (filled.length !== items.length)
        issues.push(['error', `${entry.day} has an empty dish box. Fill it in or remove it.`]);
      if (filled.length === 0)
        issues.push(['error', `${entry.day} has no dishes listed.`]);
      else if (filled.length < 3)
        issues.push(['warn', `${entry.day} lists only ${filled.length} dish${filled.length === 1 ? '' : 'es'}. ` +
          `Three or more looks more generous, and the website's own checks expect at least three.`]);
    });

    const windows = Array.isArray(state.deliveryWindows) ? state.deliveryWindows : [];
    if (windows.length === 0) issues.push(['error', 'There must be at least one delivery window.']);
    windows.forEach((win, i) => {
      if (!String(win.label || '').trim())
        issues.push(['error', `Delivery window ${i + 1} has no text for customers.`]);
      for (const [key, name] of [['startHour', 'Starts'], ['endHour', 'Ends']]) {
        const v = win[key];
        if (!Number.isInteger(v) || v < 0 || v > 23)
          issues.push(['error', `Delivery window ${i + 1}: “${name}” must be a whole number from 0 to 23.`]);
      }
      if (Number.isInteger(win.startHour) && Number.isInteger(win.endHour) && win.endHour <= win.startHour)
        issues.push(['error', `Delivery window ${i + 1} ends before it starts.`]);
    });

    /* ── prices ──────────────────────────────────────────────────────────────
       A price that is not a whole number above zero would be ignored by the
       website, which would then quietly keep showing the old amount — the
       worst failure here, because it looks like nothing happened. */
    const prices = state.prices && typeof state.prices === 'object' ? state.prices : null;
    if (!prices) {
      issues.push(['error', 'No prices found. Fill in every price box below.']);
    } else {
      for (const { key, label } of PRICE_FIELDS) {
        const v = prices[key];
        if (!Number.isInteger(v) || v <= 0)
          issues.push(['error', `${label}: enter the price as a whole number of rupees, more than 0.`]);
        else if (v > 99999)
          issues.push(['error', `${label}: ₹${v} looks like a typo — that is above ₹99,999.`]);
      }

      const single = prices['tier-single'], basic = prices['plan-basic'];
      if (Number.isInteger(single) && Number.isInteger(basic) && single !== basic)
        issues.push(['warn', `“Single Meal” is ₹${single} but “Basic Veg Tiffin” is ₹${basic}. ` +
          `Both appear on the same page as the price of one tiffin, so customers will ask which is right.`]);

      const pair = prices['tier-lunch-dinner'], one = prices['tier-one-meal'];
      if (Number.isInteger(pair) && Number.isInteger(one) && pair >= 2 * one)
        issues.push(['warn', `Lunch + Dinner at ₹${pair} is not cheaper than two One-Time Meal plans (₹${2 * one}). ` +
          `The “Saves ₹…” badge will disappear from the website rather than claim a saving you are not giving.`]);
    }

    /* ── phone numbers and address ───────────────────────────────────────────
       A wrong phone number is the most expensive mistake on this page: the ads
       keep running and every enquiry goes nowhere. */
    const contact = state.contact && typeof state.contact === 'object' ? state.contact : null;
    if (!contact) {
      issues.push(['error', 'No contact details found. Fill in the phone numbers and address below.']);
    } else {
      const wa = String(contact.whatsapp || '').replace(/\D/g, '');
      if (!/^91[6-9]\d{9}$/.test(wa))
        issues.push(['error', 'WhatsApp number must be 91 followed by a 10-digit mobile number, ' +
          'for example 917895590063.']);

      const phones = Array.isArray(contact.phones) ? contact.phones : [];
      if (phones.length !== PHONE_COUNT) {
        issues.push(['error', `There must be ${PHONE_COUNT} phone numbers.`]);
      } else {
        phones.forEach((raw, i) => {
          const only = digits(raw);
          if (!only)
            issues.push(['error', `Phone number ${i + 1} is empty. Every box must have a number in it.`]);
          else if (!/^[6-9]\d{9}$/.test(only))
            issues.push(['error', `Phone number ${i + 1} (“${raw}”) is not a 10-digit Indian mobile number. ` +
              `Write the 10 digits only, with no +91 and no spaces.`]);
        });
        const seen = phones.map(digits).filter(Boolean);
        if (new Set(seen).size !== seen.length)
          issues.push(['warn', 'The same phone number is listed more than once.']);
        if (seen[0] && !wa.endsWith(seen[0]))
          issues.push(['warn', `Your WhatsApp number and your main phone number are different. ` +
            `That is fine if you meant it — the Call buttons will ring ${seen[0]} and the ` +
            `WhatsApp buttons will message ${wa.replace(/^91/, '')}.`]);
      }

      for (const [key, label] of [['addressLine1', 'Address line 1'], ['city', 'City'], ['statePin', 'State and PIN code']])
        if (!String(contact[key] || '').trim())
          issues.push(['error', `${label} is empty. It appears in the contact section and the footer.`]);
    }

    return issues;
  }

  /**
   * Writes a complete, hand-editable js/content.js. The plain-English comment
   * block is reproduced deliberately — the owner may well edit this file by hand
   * later, and stripping the instructions would strand them.
   * @param {object} state
   * @returns {string}
   */
  function generate(state) {
    const days = state.weeklyMenu.map(entry => {
      const lines = [
        '    {',
        `      day: ${q(entry.day)},`,
        `      short: ${q(entry.short)},`,
      ];
      if (entry.closed) {
        lines.push('      closed: true,');
        lines.push(`      note: ${q(entry.note || '')},`);
        lines.push('      items: []');
      } else {
        const items = entry.items.filter(d => String(d).trim()).map(q).join(', ');
        lines.push(`      items: [${items}]`);
      }
      lines.push('    }');
      return lines.join('\n');
    }).join(',\n');

    const windows = state.deliveryWindows.map(w =>
      `    { label: ${q(w.label)}, startHour: ${w.startHour}, endHour: ${w.endHour} }`
    ).join(',\n');

    /* Prices, grouped exactly as the owner sees them on the page, with a blank
       line and a heading before each group so the file stays readable by hand. */
    const given = state.prices || {};
    const priceLines = [];
    let group = null;
    PRICE_FIELDS.forEach(field => {
      if (field.group !== group) {
        group = field.group;
        if (priceLines.length) priceLines.push('');
        priceLines.push(`    /* ${group} */`);
      }
      priceLines.push(`    ${q(field.key)}: ${Number(given[field.key]) || 0},`);
    });
    // The last entry must not carry a trailing comma before the closing brace.
    const last = priceLines.length - 1;
    priceLines[last] = priceLines[last].replace(/,$/, '');
    const prices = priceLines.join('\n');

    /* Contact details. Numbers are written as digits only — the website adds
       the +91 and the spacing — so anything the owner typed is stripped here
       rather than carried into the file. */
    const given_contact = state.contact || {};
    const phoneList = (Array.isArray(given_contact.phones) ? given_contact.phones : [])
      .map(number => q(digits(number)))
      .join(', ');
    const addressLines = ADDRESS_FIELDS
      .map(({ key }, i) => `    ${key}: ${q(String(given_contact[key] ?? '').trim())}` +
        (i === ADDRESS_FIELDS.length - 1 ? '' : ','))
      .join('\n');

    return `/* ============================================================================
 *  ✏️  THIS IS THE FILE YOU EDIT EVERY WEEK
 * ============================================================================
 *
 *  Easiest way to change anything here: open /admin/ on your website, edit the
 *  form, and press Copy. It writes this file for you.
 *
 *  To edit by hand instead — three rules, that is all:
 *
 *    1. Only change the words BETWEEN the quote marks "like this".
 *    2. Never delete a quote mark " a comma , a bracket [ ] or a brace { }.
 *    3. Save the file, upload it, then refresh the website.
 *
 *  HOW TO EDIT — example, changing Monday's food:
 *
 *      BEFORE:   items: ["Dal Tadka", "Mix Veg", "Rice", "4 Tawa Roti"]
 *      AFTER:    items: ["Kadhi", "Bhindi Masala", "Rice", "4 Tawa Roti"]
 *
 *  If the site shows the wrong thing after an edit, it is almost always a
 *  missing quote mark or comma. Compare your line with the ones around it.
 * ========================================================================== */

window.SITE = {

  /* ── Today's special ───────────────────────────────────────────────────────
     Shown in the box near the top of the page. Change it every morning.       */
  todaysSpecial: ${q(state.todaysSpecial)},

  /* ── The weekly menu ───────────────────────────────────────────────────────
     One block per day, Monday first. The website automatically opens on
     today's day, so a customer arriving on Wednesday sees Wednesday.

     Sunday has "closed: true" because the kitchen is shut. Leave that as it is
     unless you start delivering on Sundays.                                 */
  weeklyMenu: [
${days}
  ],

  /* ── Delivery windows ──────────────────────────────────────────────────────
     Used for the "Next delivery" tag at the top of the page, which updates
     itself based on the current time. Times are on the 24-hour clock:
     16 means 4 PM. Only change these if your delivery timings change.       */
  deliveryWindows: [
${windows}
  ],

  /* ── Prices ────────────────────────────────────────────────────────────────
     Every price on the website, in rupees. Write the NUMBER ONLY — no ₹ sign,
     no comma, no quote marks:

         "plan-basic": 80          ✅ correct
         "plan-basic": "₹80"       ❌ wrong — the website will show nothing
         "plan-basic": 1,200       ❌ wrong — write 1200

     Changing a number here changes it everywhere at once: the price on the
     card AND the price inside the WhatsApp message the customer sends you.

     Do not rename the words on the left. The website finds each price by
     that exact name.                                                        */
  prices: {
${prices}
  },

  /* ── Phone numbers and address ─────────────────────────────────────────────
     Changing a number here changes it everywhere on the website: every Call
     button, every WhatsApp button, the contact section and the footer.

     Phone numbers are 10 digits with NO spaces, no +91, no dashes. The
     WhatsApp number keeps the 91 in front, because WhatsApp needs it.       */
  contact: {
    whatsapp: ${q(digits(given_contact.whatsapp))},
    phones: [${phoneList}],
${addressLines}
  }
};
`;
  }

  globalThis.SwaadSeAdmin = { validate, generate, PRICE_FIELDS, ADDRESS_FIELDS, PHONE_COUNT };
})();
