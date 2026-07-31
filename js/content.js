/* ============================================================================
 *  ✏️  THIS IS THE FILE YOU EDIT EVERY WEEK
 * ============================================================================
 *
 *  Everything below controls Today's Special and the weekly menu on the website.
 *  You do NOT need to touch any other file to change the menu.
 *
 *  HOW TO EDIT — three rules, that is all:
 *
 *    1. Only change the words BETWEEN the quote marks "like this".
 *    2. Never delete a quote mark " a comma , a bracket [ ] or a brace { }.
 *    3. Save the file, upload it, then refresh the website.
 *
 *  Example — changing Monday's food:
 *
 *      BEFORE:   items: ["Dal Tadka", "Mix Veg", "Rice", "4 Tawa Roti"]
 *      AFTER:    items: ["Kadhi", "Bhindi Masala", "Rice", "4 Tawa Roti"]
 *
 *  You can list as many or as few dishes as you like on any day.
 *
 *  If the site ever shows the wrong thing after an edit, it is almost always a
 *  missing quote mark or a missing comma. Compare your line against the ones
 *  around it — they all follow the same shape.
 * ========================================================================== */

window.SITE = {

  /* ── Today's special ───────────────────────────────────────────────────────
     Shown in the box near the top of the page. Change it every morning.
     Keep it short — one line reads best on a phone.                         */
  todaysSpecial: "Dal Tadka · Mix Veg · Jeera Rice · 4 Tawa Roti",

  /* ── The weekly menu ───────────────────────────────────────────────────────
     One block per day, Monday first. The website automatically opens on
     today's day, so a customer arriving on Wednesday sees Wednesday.

     Sunday has "closed: true" because the kitchen is shut. Leave that as it is
     unless you start delivering on Sundays.                                 */
  weeklyMenu: [
    {
      day: "Monday",
      short: "Mon",
      items: ["Dal Tadka", "Mix Veg", "Rice", "4 Tawa Roti"]
    },
    {
      day: "Tuesday",
      short: "Tue",
      items: ["Rajma", "Aloo Gobhi", "Rice", "4 Tawa Roti"]
    },
    {
      day: "Wednesday",
      short: "Wed",
      items: ["Chana Masala", "Lauki Kofta", "Rice", "4 Tawa Roti"]
    },
    {
      day: "Thursday",
      short: "Thu",
      items: ["Dal Fry", "Aloo Matar", "Rice", "4 Tawa Roti"]
    },
    {
      day: "Friday",
      short: "Fri",
      items: ["Kadhi Pakoda", "Bhindi Masala", "Rice", "4 Tawa Roti"]
    },
    {
      day: "Saturday",
      short: "Sat",
      items: ["Dal Makhani", "Seasonal Sabji", "Rice", "4 Tawa Roti"]
    },
    {
      day: "Sunday",
      short: "Sun",
      closed: true,
      note: "Kitchen closed on Sundays. Monthly plans resume Monday morning.",
      items: []
    }
  ],

  /* ── Delivery windows ──────────────────────────────────────────────────────
     Used for the "Next delivery" tag at the top of the page, which updates
     itself based on the current time. Times are on the 24-hour clock:
     16 means 4 PM. Only change these if your delivery timings change.       */
  deliveryWindows: [
    { label: "7:00 – 9:00 AM", startHour: 7, endHour: 9 },
    { label: "4:00 – 5:00 PM", startHour: 16, endHour: 17 }
  ]
};
