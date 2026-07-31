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

  /**
   * @param {object} state  { todaysSpecial, weeklyMenu, deliveryWindows }
   * @returns {Array<[('error'|'warn'), string]>} empty when the state is clean
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
  ]
};
`;
  }

  globalThis.SwaadSeAdmin = { validate, generate };
})();
