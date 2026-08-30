/* ============================================================================
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
    /* Meal plans */
    "plan-basic": 80,
    "plan-standard": 120,
    "plan-premium": 150,
    "plan-deluxe": 170,

    /* Monthly subscription */
    "tier-lunch-dinner": 4600,
    "tier-one-meal": 2400,
    "tier-single": 80,

    /* Food packs */
    "pack-dal": 180,
    "pack-rice": 140,
    "pack-roti": 80,
    "pack-shahi-paneer": 220,
    "pack-butter-paneer": 260,
    "pack-raita": 140,
    "pack-mutter-paneer": 140,
    "pack-naan": 50
  },

  /* ── Phone numbers and address ─────────────────────────────────────────────
     Changing a number here changes it everywhere on the website: every Call
     button, every WhatsApp button, the contact section and the footer.

     Phone numbers are 10 digits with NO spaces, no +91, no dashes. The
     WhatsApp number keeps the 91 in front, because WhatsApp needs it.       */
  contact: {
    whatsapp: "917895590063",
    phones: ["7895590063", "7900778393", "8859008393"],
    addressLine1: "37/1 Om Vihar",
    addressLine2: "Kamla Nagar",
    city: "Agra",
    statePin: "Uttar Pradesh 282005"
  }
};
