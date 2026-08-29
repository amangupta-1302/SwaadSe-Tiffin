# How to update your website

No coding needed. Everything below is find-the-text-and-change-it.

**Two rules that prevent every common mistake:**

1. Only change words **between** quote marks, or **between** `>` and `<`.
2. Never delete a quote mark `"`, a comma `,`, an angle bracket `< >`, or a brace `{ }`.

Open the files in Notepad (Windows), TextEdit (Mac), or VS Code. Save, upload the
changed file, then refresh the website. Press **Ctrl+F** (Windows) or **Cmd+F**
(Mac) to search for the text mentioned in each section below.

Before you upload anything, run this once to check you have not broken something:

```bash
npm test
```

If the last line says `fail 0`, you are safe to upload. If something fails, it
tells you exactly what — undo your last change and try again.

---

## 1. Today's menu and today's special — the weekly job

**The easy way: open `/admin/` on your website.** Edit the form, log in with
your email and password at the bottom, and press **Save to the website** — it
is live about a minute later. (Forgot the password? The login form has a
"Forgot password?" button that emails you a reset link.) The editor checks your
work as you type and refuses to save anything broken, so the layout cannot
break. Full setup is in README.md under **Admin area** and in DEPLOY.md.

Everything below describes editing the same file **by hand**, if you prefer that
or the admin page is not set up yet.

**File: `js/content.js`** — this is the only file you need for menu updates.

Near the top you will find:

```js
todaysSpecial: "Dal Tadka · Mix Veg · Jeera Rice · 4 Tawa Roti",
```

Change the words inside the quotes. Keep the comma at the end.

Below that is the week. Each day looks like this:

```js
{
  day: "Monday",
  short: "Mon",
  items: ["Dal Tadka", "Mix Veg", "Rice", "4 Tawa Roti"]
},
```

Change the dishes inside `items`. Each dish needs its own quote marks and a comma
between them. You can add or remove dishes freely:

```js
items: ["Kadhi", "Bhindi Masala", "Jeera Rice", "4 Tawa Roti", "Papad"]
```

The website opens automatically on today's day, so a customer visiting on
Wednesday sees Wednesday first. You do not need to do anything for that.

**Leave Sunday's `closed: true` alone** unless you start delivering on Sundays.

> There is a second copy of the week inside `index.html`. That copy is only shown
> to the rare visitor whose phone has JavaScript switched off. Normal customers
> always see `js/content.js`. Refresh the `index.html` copy whenever convenient —
> it is not urgent.

---

## 2. Changing a price

**The easy way: open `/admin/` and use the Prices panel.** Every price on the
website has its own box. Change the number, press **Copy the file**, paste it
over `js/content.js`. That is the whole job.

By hand, it is the same file: **`js/content.js`**, in the `prices` block at the
bottom.

```js
prices: {
  "plan-basic": 80,
  "plan-standard": 120,
  ...
}
```

**Write the number only** — no `₹`, no comma, no quote marks around the number.
`120` is right; `"₹120"` and `1,200` are both wrong, and the website will keep
showing the old price rather than a broken one.

One number changes the price everywhere it appears: the card, the green monthly
section, the sentence in the FAQ, **and the WhatsApp message the customer sends
you**. You never have to change the same price twice.

Which name is which:

| Starts with | Where it appears |
|---|---|
| `plan-` | the four tiffin cards under "Choose Your Tiffin" |
| `tier-` | the green Monthly Subscription section |
| `pack-` | the Food Packs cards |

**The "Saves ₹200" badge looks after itself.** It is worked out from your two
monthly prices. If you ever price the Lunch + Dinner plan so it is no longer
cheaper than two single plans, the badge disappears rather than claim a saving
you are not giving.

### The three places prices are not updated automatically

These are read by Google and by WhatsApp's link preview **before** the page
runs, so they have to be text sitting in `index.html`. If you change the ₹80
cheapest price, the ₹2400 monthly price, or the ₹170 top price, ask your
developer to update these three lines too — or do it yourself, they are all in
the first 60 lines of `index.html`:

1. `<meta name="description"` — the grey text under your Google result
2. `<meta property="og:description"` — the preview when someone shares your link
3. `"priceRange": "₹80–₹170"` — the price range on your Google business listing

Nothing breaks if you forget. Your website will be right and only those three
descriptions will be out of date. `npm test` does not check them against
`content.js`, precisely so that changing a price never makes the tests fail.

> There is also a copy of every price written into `index.html` itself. That copy
> is only seen by the rare visitor whose phone has JavaScript switched off.
> Normal customers always see `js/content.js`.

---

## 3. Adding or replacing a review

**File: `index.html`** — search for `data-placeholder="true"`.

There are three sample reviews on the site now. **Replace all three before you
start advertising.** Publishing invented testimonials misleads customers and can
get your Google Ads account suspended.

For each card, change three things and then delete `data-placeholder="true"`:

```html
<blockquote>The food tastes like home and reaches my office by 12:30 every day.</blockquote>
...
<span class="review__name">Ravi S.</span><br>
<span class="review__meta">Dayalbagh · Monthly one-time meal</span>
```

To add a fourth review, copy everything from one `<li class="card card--lift review"`
line down to its closing `</li>` line, paste it after, then edit the copy.

Reviews that name a specific dish or a specific delivery time convince people far
more than "very good food". Ask two or three regular customers on WhatsApp — most
are happy to send a line.

---

## 4. Swapping a photo

Put your photo in the `images/` folder using **exactly the same filename** as the
placeholder it replaces. Nothing in the code changes.

See `IMAGES.md` for the full list of filenames and the size each one should be.

---

## 5. Changing a phone number or the address

**The easy way: open `/admin/` → "Phone numbers and address".** One box per
number. Changing the main number updates every Call button on the website, and
changing the WhatsApp number updates all 25 WhatsApp buttons.

By hand it is the `contact` block at the bottom of **`js/content.js`**:

```js
contact: {
  whatsapp: "917895590063",
  phones: ["7895590063", "7900778393", "8859008393"],
  addressLine1: "37/1 Om Vihar",
  ...
}
```

Phone numbers are **10 digits, nothing else** — no `+91`, no spaces, no dashes.
The website adds those itself. The WhatsApp number is the exception: it keeps
`91` in front, because WhatsApp needs the country code.

The first number in `phones` is the main one, and every "Call Now" button uses
it.

### Two places that are not updated automatically

Same rule as prices. These are read by Google before the page runs, so they are
plain text in `index.html`:

1. `"telephone"` and `"streetAddress"` in the business listing data near the top
2. the map link — search `data-map-src` and `google.com/maps`

Also update your **Google Business Profile** separately. That is what most
customers actually see, and it is not part of this website.

---

## 5b. The Privacy and Terms pages — developer note

`privacy.html` and `terms.html` load **no JavaScript at all**, on purpose: they
are two pages of text that never change and do not need any. So the phone number
and address written into them are *not* updated by `/admin/`.

Each holds the main number once and the address two or three times. After a
number or address change, update them by hand:

```bash
grep -n '7895590063\|Om Vihar' privacy.html terms.html
```

`npm test` fails if these two pages disagree with the address and number baked
into `index.html`, so a half-finished change gets caught rather than shipped.

The same applies to the business-listing data and the map link in `index.html`
itself (section 5 above). None of it is urgent — the front page is right, and
these are secondary — but do it before the old number stops working.

---

## 6. Adding your Google review rating to search results

**Do this only once you actually have Google reviews.** Google penalises websites
that publish ratings for reviews that do not exist, and it is a common reason for
Google Ads disapproval.

When you have real reviews, open `index.html`, find the comment that begins
`✏️ AFTER YOU HAVE REAL GOOGLE REVIEWS`, and add this just before the closing `}`
of the business block above it — putting your real numbers in:

```json
  ,"aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "37"
  }
```

Keep it updated as your review count grows. Also paste your Google Business
Profile link into the "See us on Google" button — search for
`✏️ EDIT: paste your Google Business Profile link`.

---

## 7. Other small edits

| What | Where to search in `index.html` |
|---|---|
| FSSAI number | `FSSAI Reg. No.` |
| Copyright year | `© 2026` |
| Instagram / Facebook links | `✏️ EDIT: replace the #` |
| Delivery timings | `7:00 AM – 9:00 AM` (appears in 3 places, plus the schema in `<head>`) |
| Delivery radius | `5 KM` |

**If you change delivery timings, change them in four places:** the Delivery
Information section, the Contact section, the footer, and the
`openingHoursSpecification` block in `<head>`. `npm test` fails if you miss one.

**If you change the weekly menu's delivery windows**, also update
`deliveryWindows` at the bottom of `js/content.js` — that drives the
"Next delivery" tag at the top of the page.
