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
  ],

  /* ── Prices ────────────────────────────────────────────────────────────────
     Every price on the website, in rupees.

     Write the NUMBER ONLY. No ₹ sign, no comma, no quote marks:

         "plan-basic": 80          ✅ correct
         "plan-basic": "₹80"       ❌ wrong — the website will show nothing
         "plan-basic": 1,200       ❌ wrong — write 1200

     Changing a number here changes it everywhere on the website at once:
     the price on the card AND the price inside the WhatsApp message the
     customer sends you. You never have to change the same price twice.

     Do not rename the words on the left. The website finds each price by
     that exact name.                                                        */
  prices: {

    /* The four tiffin plans — price per meal */
    "plan-basic": 80,
    "plan-standard": 120,
    "plan-premium": 150,
    "plan-deluxe": 170,

    /* Monthly subscription band */
    "tier-lunch-dinner": 4600,
    "tier-one-meal": 2400,
    "tier-single": 80,

    /* Food packs, ordered on their own */
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

     Write phone numbers as 10 digits with NO spaces, no +91, no dashes:

         "7895590063"      ✅ correct
         "78955 90063"     ❌ wrong
         "+91 78955 90063" ❌ wrong

     The website adds the +91 and the space itself.                          */
  contact: {

    /* The number that receives WhatsApp messages. This one keeps the 91 in
       front, because WhatsApp needs the country code. */
    whatsapp: "917895590063",

    /* Numbers customers can call. The first one is the main number and is used
       by every "Call Now" button. List one, two or three. */
    phones: ["7895590063", "7900778393", "8859008393"],

    /* The kitchen address, one line per box. */
    addressLine1: "37/1 Om Vihar",
    addressLine2: "Kamla Nagar",
    city: "Agra",
    statePin: "Uttar Pradesh 282005"
  }
};
