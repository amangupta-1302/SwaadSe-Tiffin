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

**The easy way: open `/admin/` on your website.** Enter your password, edit the
form, press **Copy the file**, then paste it over `js/content.js` in your hosting
File Manager. The editor checks your work as you type and refuses to save
anything broken, so the layout cannot break. Full setup is in README.md under
**Admin area**.

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

**File: `index.html`**

Search for `✏️ EDIT: PRICES`. Each plan has **two** places with the price:

```html
<span class="price">₹120</span>
```

and, further down in the same card, the WhatsApp message:

```html
?text=Hi%20SwaadSe%20Tiffin%2C%20I%20want%20to%20order%20the%20Standard%20Veg%20Tiffin%20%28%E2%82%B9120%20per%20meal%29.
```

**Change both.** If you only change the first, customers will message you quoting
your old price. In that long line, `%E2%82%B9` means `₹` and `%20` means a space —
so `%E2%82%B9120` is `₹120`. Change only the digits.

Food pack prices work the same way: the visible `₹180` and the `%E2%82%B9180`
inside that pack's link.

Monthly plan prices are in the green section — search for `tier__price`.

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

## 5. Changing a phone number

The primary number `7895590063` appears **33 times** across three files:

| File | Times |
|---|---|
| `index.html` | 31 |
| `privacy.html` | 1 |
| `terms.html` | 1 |

Use your editor's **Replace All** (Ctrl+H / Cmd+H) on each file: find
`7895590063`, replace with your new number. Then check the count is zero:

```bash
grep -c 7895590063 index.html privacy.html terms.html
```

The other two numbers (`7900778393`, `8859008393`) appear twice each, in the
Contact section and the footer of `index.html`.

Numbers are written two ways and **both** must match:
`tel:+917895590063` and `wa.me/917895590063` — note the `+91` on one and the bare
`91` on the other. Replacing just the ten digits handles both correctly.

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
