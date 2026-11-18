// Example invariants for a booking-style system. COPY AND ADAPT: table names, columns, and above
// all the rules. Write down what must ALWAYS be true for your business, then check it here.
//
// Assumed shape (rename to match yours):
//   bookings(id, reference, booking_date date, start_min int, end_min int, barber_id, service_id,
//            status text, total_pence int, user_id, created_at, cancelled_at, status_changed_at, ...)
//   statuses: pending, confirmed, cancelled, completed, no_show
const MAX_UPCOMING_PER_CUSTOMER = 3; // a rule the owner stated

module.exports = async ({ db, now }) => {
  const rows = (await db.from("bookings").select("*")).data || [];
  const problems = [];
  const active = (b) => ["pending", "confirmed"].includes(b.status);
  const started = (b) => b.booking_date < now.date || (b.booking_date === now.date && b.start_min <= now.min);
  const ref = (b) => b.reference || b.id;

  // 1. No double booking: one resource cannot have overlapping active bookings.
  const act = rows.filter(active);
  for (let i = 0; i < act.length; i++) {
    for (let j = i + 1; j < act.length; j++) {
      const a = act[i], c = act[j];
      if (a.barber_id === c.barber_id && a.booking_date === c.booking_date && a.start_min < c.end_min && c.start_min < a.end_min) {
        problems.push(`OVERLAP ${ref(a)} vs ${ref(c)}`);
      }
    }
  }

  // 2. The per-customer cap holds (upcoming = active and not yet started).
  const upcoming = {};
  for (const b of act) if (b.user_id && !started(b)) (upcoming[b.user_id] ||= []).push(b);
  for (const [u, l] of Object.entries(upcoming)) {
    if (l.length > MAX_UPCOMING_PER_CUSTOMER) problems.push(`CAP exceeded: customer ${u.slice(0, 8)} has ${l.length} upcoming`);
  }

  // 3. Audit fields agree with status.
  for (const b of rows) {
    if (b.status === "cancelled" && !b.cancelled_at) problems.push(`cancelled without cancelled_at: ${ref(b)}`);
    if (b.status !== "cancelled" && b.cancelled_at) problems.push(`cancelled_at set but status is ${b.status}: ${ref(b)}`);
    if (["completed", "no_show"].includes(b.status) && !started(b)) problems.push(`future booking is ${b.status}: ${ref(b)}`);
    if (["completed", "no_show"].includes(b.status) && !b.status_changed_at) problems.push(`no audit stamp on ${ref(b)}`);
  }

  // 4. Totals are never negative (add: free items cost 0, paid items match the price list at the time).
  for (const b of rows) if (b.total_pence < 0) problems.push(`negative total ${ref(b)}`);

  const counts = {};
  for (const b of rows) counts[b.status] = (counts[b.status] || 0) + 1;
  return { summary: `bookings ${rows.length} ${JSON.stringify(counts)}`, problems };
};
