/**
 * SwaadSe Tiffin — the only real logic on the page, tested across every day.
 *
 * Two functions matter:
 *   nextDelivery()  drives the "Next delivery" tag in the hero. Getting it wrong
 *                   means the page states a delivery time the kitchen will not
 *                   honour — on a page whose whole job is earning trust.
 *   menuIndexFor()  maps JavaScript's Sunday-first getDay() onto content.js,
 *                   which lists Monday first. An off-by-one here shows Tuesday's
 *                   food on a Monday.
 *
 * August 2026 calendar used below: the 1st is a Saturday, so 2nd = Sunday,
 * 3rd = Monday … 8th = Saturday.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;          // main.js reads globalThis.SITE
await import('../js/main.js');           // no document in Node, so DOM work is skipped
const { nextDelivery, menuIndexFor, isDeliveryDay, addressSlots } = globalThis.SwaadSeSchedule;

const WINDOWS = [
  { label: '7:00 – 9:00 AM', startHour: 7, endHour: 9 },
  { label: '4:00 – 5:00 PM', startHour: 16, endHour: 17 },
];
/** August 2026, local time. */
const aug = (day, hour, minute = 0) => new Date(2026, 7, day, hour, minute);

test('the module loaded without a DOM', () => {
  assert.equal(typeof nextDelivery, 'function');
  assert.equal(typeof menuIndexFor, 'function');
});

test('Sunday is the only closed day', () => {
  assert.equal(isDeliveryDay(0), false, 'Sunday must be closed');
  for (const day of [1, 2, 3, 4, 5, 6])
    assert.equal(isDeliveryDay(day), true, `day ${day} should be open`);
});

test('before the morning window, the next delivery is this morning', () => {
  assert.deepEqual(nextDelivery(aug(3, 6, 0), WINDOWS),
    { when: 'Today', label: '7:00 – 9:00 AM' });
});

test('a window stays reachable until the minute it closes', () => {
  assert.deepEqual(nextDelivery(aug(3, 8, 59), WINDOWS),
    { when: 'Today', label: '7:00 – 9:00 AM' });
  // At exactly 09:00 the morning window has closed and the evening one is next.
  assert.deepEqual(nextDelivery(aug(3, 9, 0), WINDOWS),
    { when: 'Today', label: '4:00 – 5:00 PM' });
});

test('between windows, the evening slot is offered', () => {
  assert.deepEqual(nextDelivery(aug(3, 13, 30), WINDOWS),
    { when: 'Today', label: '4:00 – 5:00 PM' });
  assert.deepEqual(nextDelivery(aug(3, 16, 45), WINDOWS),
    { when: 'Today', label: '4:00 – 5:00 PM' });
});

test('after the last window, it rolls to tomorrow morning', () => {
  assert.deepEqual(nextDelivery(aug(3, 18, 0), WINDOWS),
    { when: 'Tomorrow', label: '7:00 – 9:00 AM' });
});

test('Saturday evening skips Sunday and names Monday', () => {
  // The important case: "Tomorrow" would be a lie, because Sunday is closed.
  assert.deepEqual(nextDelivery(aug(1, 20, 0), WINDOWS),
    { when: 'Monday', label: '7:00 – 9:00 AM' });
});

test('on a Sunday, the next delivery is tomorrow morning', () => {
  assert.deepEqual(nextDelivery(aug(2, 10, 0), WINDOWS),
    { when: 'Tomorrow', label: '7:00 – 9:00 AM' });
  // Sunday must never offer a slot "Today", whatever the hour.
  for (const hour of [0, 6, 8, 12, 16, 23])
    assert.notEqual(nextDelivery(aug(2, hour), WINDOWS).when, 'Today',
      `Sunday ${hour}:00 offered a delivery today`);
});

test('Friday night says Tomorrow, because Saturday is open', () => {
  assert.deepEqual(nextDelivery(aug(7, 22, 0), WINDOWS),
    { when: 'Tomorrow', label: '7:00 – 9:00 AM' });
});

test('every day and hour yields a real, non-Sunday window', () => {
  for (let day = 1; day <= 8; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const result = nextDelivery(aug(day, hour), WINDOWS);
      assert.ok(result, `no window found for Aug ${day} ${hour}:00`);
      assert.ok(WINDOWS.some(w => w.label === result.label));
      assert.notEqual(result.when, 'Sunday', 'never promise a Sunday delivery');
    }
  }
});

test('missing or empty delivery windows degrade to null, not a crash', () => {
  assert.equal(nextDelivery(aug(3, 6), []), null);
  assert.equal(nextDelivery(aug(3, 6), undefined), null);
});

test('menuIndexFor maps every weekday onto the Monday-first menu', () => {
  const expected = [
    [1, 0, 'Monday'], [2, 1, 'Tuesday'], [3, 2, 'Wednesday'], [4, 3, 'Thursday'],
    [5, 4, 'Friday'], [6, 5, 'Saturday'], [0, 6, 'Sunday'],
  ];
  for (const [getDay, index, name] of expected) {
    // Aug 2 2026 is a Sunday, so Aug 2 + getDay lands on that weekday.
    const date = aug(2 + getDay, 12);
    assert.equal(date.getDay(), getDay, `fixture for ${name} is wrong`);
    assert.equal(menuIndexFor(date), index, `${name} should map to index ${index}`);
  }
});

test('menuIndexFor never returns an index outside the seven-day menu', () => {
  for (let day = 1; day <= 31; day++) {
    const index = menuIndexFor(aug(day, 9));
    assert.ok(index >= 0 && index <= 6, `Aug ${day} produced index ${index}`);
  }
});

// ─── delivery windows arrive in whatever order the owner added them ──────────
test('an out-of-order window list still advertises the earliest slot', () => {
  // /admin/ appends a new window to the end of the list, and validate() checks
  // each window on its own but never their order. A midday slot added after the
  // evening one used to make the page skip straight to "4:00 – 5:00 PM".
  const jumbled = [
    { label: '7:00 – 9:00 AM', startHour: 7, endHour: 9 },
    { label: '4:00 – 5:00 PM', startHour: 16, endHour: 17 },
    { label: '12:00 – 1:00 PM', startHour: 12, endHour: 13 },
  ];

  assert.deepEqual(nextDelivery(aug(3, 6, 0), jumbled),
    { when: 'Today', label: '7:00 – 9:00 AM' }, 'before opening, the morning slot is next');
  assert.deepEqual(nextDelivery(aug(3, 11, 0), jumbled),
    { when: 'Today', label: '12:00 – 1:00 PM' }, 'the midday slot must not be skipped');
  assert.deepEqual(nextDelivery(aug(3, 14, 0), jumbled),
    { when: 'Today', label: '4:00 – 5:00 PM' }, 'after midday closes, the evening slot is next');
  // Tomorrow means the first delivery of tomorrow, not windows[0].
  assert.deepEqual(nextDelivery(aug(3, 20, 0), jumbled),
    { when: 'Tomorrow', label: '7:00 – 9:00 AM' });
});

test('sorting the windows does not reorder the caller\'s array', () => {
  const windows = [
    { label: 'evening', startHour: 16, endHour: 17 },
    { label: 'morning', startHour: 7, endHour: 9 },
  ];
  nextDelivery(aug(3, 6), windows);
  assert.equal(windows[0].label, 'evening', 'content.js order must survive untouched');
});

// ─── address: a cleared optional line is an edit, not a missing value ────────
test('clearing address line 2 blanks its slots instead of keeping stale text', () => {
  // validate() requires line 1, city and PIN but not line 2, so emptying it is
  // a legal owner edit. Treating '' as "unset" left the old line 2 on the page
  // beside a street slot that had already dropped it — two addresses, one page.
  const slots = addressSlots({
    addressLine1: '37/1 Om Vihar', addressLine2: '', city: 'Agra', statePin: 'Uttar Pradesh 282005',
  });
  assert.equal(slots.line2, '', 'line 2 must be blanked, not left undefined');
  assert.equal(slots.street, '37/1 Om Vihar', 'street must not carry the cleared line');
  assert.equal(slots.short, '37/1 Om Vihar, Agra');
  assert.equal(slots['city-state'], 'Agra, Uttar Pradesh 282005');
});

test('a filled address produces every slot index.html asks for', () => {
  const slots = addressSlots({
    addressLine1: '37/1 Om Vihar', addressLine2: 'Kamla Nagar', city: 'Agra', statePin: 'Uttar Pradesh 282005',
  });
  assert.deepEqual(slots, {
    line1: '37/1 Om Vihar',
    line2: 'Kamla Nagar',
    'city-state': 'Agra, Uttar Pradesh 282005',
    street: '37/1 Om Vihar, Kamla Nagar',
    short: '37/1 Om Vihar, Kamla Nagar, Agra',
  });
});

test('no address at all leaves the baked markup alone', () => {
  // null is the signal main.js uses to skip the [data-contact] loop entirely.
  for (const contact of [{}, undefined, { addressLine1: '   ' }, { city: 'Agra' }])
    assert.equal(addressSlots(contact), null, `${JSON.stringify(contact)} should not overwrite the page`);
});
