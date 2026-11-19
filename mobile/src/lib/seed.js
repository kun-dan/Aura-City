// Starting data: a slice of Prayagraj with issues at every stage of the pipeline.
import { computeBounty, FEE_RATE } from './rules';

export const DEPARTMENTS = [
  { id: 'd-roads', code: 'roads', name: 'Roads & Transport', color: '#fb923c', base_bounty: 2500, icon: 'car' },
  { id: 'd-water', code: 'water', name: 'Water Supply', color: '#38bdf8', base_bounty: 1800, icon: 'water' },
  { id: 'd-elec', code: 'electricity', name: 'Electricity', color: '#facc15', base_bounty: 1500, icon: 'flash' },
  { id: 'd-sanit', code: 'sanitation', name: 'Sanitation', color: '#4ade80', base_bounty: 1000, icon: 'trash' },
  { id: 'd-parks', code: 'parks', name: 'Parks & Gardens', color: '#34d399', base_bounty: 1200, icon: 'leaf' },
  { id: 'd-general', code: 'general', name: 'General Works', color: '#c084fc', base_bounty: 1000, icon: 'construct' },
];

const person = (id, full_name, role, department_id = null) => ({ id, full_name, role, department_id, points: 0, wallet_balance: 0 });

export const PEOPLE = [
  person('u-asha', 'Asha Verma', 'citizen'),
  person('u-rohan', 'Rohan Mehta', 'citizen'),
  person('u-priya', 'Priya Singh', 'citizen'),
  person('u-ravi', 'Ravi Kumar', 'resolver', 'd-roads'),
  person('u-imran', 'Imran Shaikh', 'resolver', 'd-water'),
  person('u-meena', 'Meena Patel', 'resolver', 'd-elec'),
  person('u-suresh', 'Suresh Yadav', 'resolver', 'd-sanit'),
  person('u-kavya', 'Kavya Rao', 'resolver', 'd-parks'),
  person('u-arjun', 'Arjun Nair', 'resolver', 'd-general'),
  person('u-neha', 'Neha Joshi', 'admin'),
];

const SEED = [
  { scene: 'pothole', category: 'Pothole', dept: 'd-roads', summary: 'Deep pothole across the left lane, risk to two-wheelers.', description: 'Big pothole near the crossing, bikes swerving', address: 'Civil Lines, MG Marg', lat: 25.4526, lng: 81.8343, severity: 4, reporter: 'u-asha', status: 'assigned', resolver: 'u-ravi', upvotes: ['u-rohan', 'u-priya'], hoursAgo: 20 },
  { scene: 'garbage', category: 'Garbage dump', dept: 'd-sanit', summary: 'Overflowing garbage pile on the footpath beside shops.', description: 'Garbage not collected for days', address: 'Katra Market', lat: 25.4447, lng: 81.8545, severity: 3, reporter: 'u-rohan', status: 'assigned', resolver: 'u-suresh', upvotes: ['u-asha'], hoursAgo: 30 },
  { scene: 'streetlight', category: 'Broken streetlight', dept: 'd-elec', summary: 'Streetlight is off and wiring is exposed at the pole base.', description: 'Street light not working, very dark at night', address: 'George Town', lat: 25.4419, lng: 81.8414, severity: 4, reporter: 'u-priya', status: 'verified', resolver: 'u-meena', upvotes: ['u-asha', 'u-rohan'], hoursAgo: 72, rating: 5 },
  { scene: 'leak', category: 'Water leak', dept: 'd-water', summary: 'Burst pipeline flooding the road shoulder.', description: 'Pipe leaking clean water since morning', address: 'Tagore Town', lat: 25.4562, lng: 81.8562, severity: 4, reporter: 'u-asha', status: 'needs_review', resolver: 'u-imran', upvotes: ['u-priya'], hoursAgo: 40 },
  { scene: 'park', category: 'Fallen tree', dept: 'd-parks', summary: 'Fallen branch blocking the park walkway, bench damaged.', description: 'Tree fell in park after storm', address: 'Chandra Shekhar Azad Park', lat: 25.4579, lng: 81.8606, severity: 3, reporter: 'u-rohan', status: 'verified', resolver: 'u-kavya', upvotes: [], hoursAgo: 96, rating: 4 },
  { scene: 'pothole', category: 'Road damage', dept: 'd-roads', summary: 'Broken asphalt patch at the bus stop entry.', description: 'Road broken near bus stop', address: 'Jhalwa, near IIIT', lat: 25.4301, lng: 81.7714, severity: 2, reporter: 'u-priya', status: 'assigned', resolver: 'u-ravi', upvotes: ['u-asha', 'u-rohan'], hoursAgo: 6 },
  { scene: 'garbage', category: 'Garbage dump', dept: 'd-sanit', summary: 'Waste dumped at the corner of the residential lane.', description: 'Garbage dumped in the lane', address: 'Allahpur', lat: 25.4385, lng: 81.8711, severity: 2, reporter: 'u-asha', status: 'assigned', resolver: 'u-suresh', upvotes: [], hoursAgo: 3 },
  { scene: 'leak', category: 'Drain overflow', dept: 'd-water', summary: 'Water pooling over the road from a leaking main.', description: 'Water logging on main road', address: 'Naini Bridge approach', lat: 25.4177, lng: 81.8723, severity: 3, reporter: 'u-rohan', status: 'verified', resolver: 'u-imran', upvotes: ['u-priya'], hoursAgo: 120, rating: 4 },
];

export const STATE_VERSION = 2;

export function buildSeed() {
  const now = Date.now();
  const iso = (h) => new Date(now - h * 3600_000).toISOString();
  const s = {
    version: STATE_VERSION,
    departments: DEPARTMENTS.map((d) => ({ ...d })),
    profiles: PEOPLE.map((p) => ({ ...p })),
    issues: [],
    upvotes: [],
    audits: [],
    ledger: [],
    treasury: { balance: 500000, fee_rate: FEE_RATE },
    moods: [
      { user_id: 'u-rohan', mood: 'concerned', created_at: iso(0.5) },
      { user_id: 'u-priya', mood: 'calm', created_at: iso(1.2) },
      { user_id: 'seed-1', mood: 'concerned', created_at: iso(0.8) },
      { user_id: 'seed-2', mood: 'happy', created_at: iso(0.3) },
    ],
  };
  let ledgerId = 1;
  const pushLedger = (e) => s.ledger.unshift({ id: ledgerId++, ...e });
  pushLedger({ created_at: iso(200), kind: 'budget_topup', amount: 500000, issue_id: null, audit_id: null, profile_id: 'u-neha', treasury_balance_after: 500000, note: 'Ward 12 repair budget, Q4' });

  [...SEED].sort((a, b) => b.hoursAgo - a.hoursAgo).forEach((x, i) => {
    const dept = s.departments.find((d) => d.id === x.dept);
    const id = `i-seed-${i + 1}`;
    const hasAfter = ['pending_audit', 'needs_review', 'verified'].includes(x.status);
    const issue = {
      id, created_at: iso(x.hoursAgo), reporter_id: x.reporter, lat: x.lat, lng: x.lng, address: x.address,
      description: x.description, before_photo_url: `asset:${x.scene}-before`, after_photo_url: hasAfter ? `asset:${x.scene}-after` : null,
      status: x.status, category: x.category, department_id: x.dept, summary: x.summary, severity: x.severity,
      ai_confidence: 0.86 + (i % 3) * 0.04, bounty: computeBounty(dept.base_bounty, x.severity),
      upvotes: x.upvotes.length, assigned_to: x.resolver, assigned_at: iso(x.hoursAgo - 0.1),
      resolved_at: hasAfter ? iso(x.hoursAgo / 3) : null, verified_at: null,
    };
    s.issues.unshift(issue);
    x.upvotes.forEach((u) => s.upvotes.push({ issue_id: id, user_id: u }));
    s.profiles.find((p) => p.id === x.reporter).points += 10;

    if (hasAfter) {
      const auditId = `a-seed-${i + 1}`;
      const review = x.status === 'needs_review';
      s.audits.unshift({
        id: auditId, created_at: iso(x.hoursAgo / 3 - 0.05), issue_id: id, resolver_id: x.resolver,
        rating: review ? 3 : x.rating, confidence: review ? 0.58 : 0.91, is_legit: true,
        reasoning: review
          ? 'Leak appears sealed but the after photo is taken from a different angle; cannot fully confirm it is the same spot.'
          : 'Same location confirmed by matching buildings and road markings. The reported problem is no longer visible and the repair looks complete.',
        model: 'seed data', decision: review ? 'needs_review' : 'approved', reviewed_by: null, review_note: null, reviewed_at: null,
      });
      if (!review) {
        const fee = Math.round(issue.bounty * FEE_RATE * 100) / 100;
        s.treasury.balance -= issue.bounty;
        pushLedger({ created_at: iso(x.hoursAgo / 3 - 0.04), kind: 'payout', amount: issue.bounty, issue_id: id, audit_id: auditId, profile_id: x.resolver, treasury_balance_after: s.treasury.balance, note: 'Payout for verified repair' });
        s.treasury.balance -= fee;
        pushLedger({ created_at: iso(x.hoursAgo / 3 - 0.04), kind: 'platform_fee', amount: fee, issue_id: id, audit_id: auditId, profile_id: null, treasury_balance_after: s.treasury.balance, note: 'Auracity platform fee' });
        s.profiles.find((p) => p.id === x.resolver).wallet_balance += issue.bounty;
        s.profiles.find((p) => p.id === x.reporter).points += 5;
        issue.verified_at = iso(x.hoursAgo / 3 - 0.04);
      }
    }
  });
  return s;
}
