import type { Audit, Department, Issue, LedgerEntry, Profile } from './types';
import { computeBounty } from './rules';

export type Scene = 'pothole' | 'garbage' | 'streetlight' | 'leak' | 'park';

export function scenePhoto(scene: Scene, fixed = false, seed = 0): string {
  const hue = (seed * 37) % 40;
  const sky = `hsl(${200 + hue},70%,${fixed ? 78 : 70}%)`;
  const parts: string[] = [
    `<rect width="640" height="480" fill="${sky}"/>`,
    `<rect y="250" width="640" height="230" fill="#6b7280"/>`,
    `<rect x="${60 + hue}" y="120" width="120" height="130" fill="#d6b88c"/><rect x="${80 + hue}" y="150" width="30" height="30" fill="#334155"/><rect x="${130 + hue}" y="150" width="30" height="30" fill="#334155"/>`,
    `<rect x="470" y="90" width="110" height="160" fill="#c7a17a"/><rect x="490" y="120" width="25" height="25" fill="#334155"/><rect x="535" y="120" width="25" height="25" fill="#334155"/>`,
    `<g stroke="#f8fafc" stroke-width="6" stroke-dasharray="40 30"><line x1="0" y1="380" x2="640" y2="380"/></g>`,
  ];
  if (scene === 'pothole')
    parts.push(
      fixed
        ? `<ellipse cx="320" cy="400" rx="120" ry="40" fill="#374151"/><ellipse cx="320" cy="400" rx="120" ry="40" fill="none" stroke="#4b5563" stroke-width="3"/>`
        : `<ellipse cx="320" cy="400" rx="120" ry="40" fill="#1f2937"/><ellipse cx="310" cy="405" rx="80" ry="22" fill="#5b4636"/><path d="M200 395 l-30 -12 M440 398 l35 -10 M320 360 l5 -25" stroke="#111827" stroke-width="4"/>`,
    );
  if (scene === 'garbage')
    parts.push(
      fixed
        ? `<rect x="250" y="300" width="70" height="90" rx="6" fill="#16a34a"/><rect x="330" y="300" width="70" height="90" rx="6" fill="#2563eb"/>`
        : `<path d="M180 420 Q240 300 320 330 Q400 280 470 420 Z" fill="#78350f"/><circle cx="260" cy="370" r="22" fill="#e11d48"/><circle cx="330" cy="350" r="18" fill="#fde047"/><rect x="380" y="360" width="40" height="30" fill="#f8fafc"/><circle cx="300" cy="395" r="15" fill="#0ea5e9"/>`,
    );
  if (scene === 'streetlight')
    parts.push(
      `<rect x="300" y="110" width="12" height="270" fill="#1f2937"/><rect x="300" y="110" width="80" height="10" fill="#1f2937"/><rect x="360" y="118" width="34" height="14" rx="4" fill="#111827"/>`,
      fixed
        ? `<polygon points="362,132 392,132 440,330 314,330" fill="#fde68a" opacity="0.55"/><circle cx="377" cy="128" r="9" fill="#fef08a"/>`
        : `<path d="M310 250 q30 40 -10 80 q40 10 20 60" stroke="#111827" stroke-width="4" fill="none"/><circle cx="377" cy="128" r="7" fill="#334155"/>`,
    );
  if (scene === 'leak')
    parts.push(
      `<rect x="120" y="330" width="400" height="22" fill="#475569"/>`,
      fixed
        ? `<rect x="300" y="324" width="40" height="34" fill="#0f766e"/>`
        : `<path d="M320 330 q-10 -60 -40 -80 M320 330 q10 -70 45 -85 M320 330 q0 -80 0 -95" stroke="#38bdf8" stroke-width="7" fill="none"/><ellipse cx="320" cy="420" rx="170" ry="35" fill="#0ea5e9" opacity="0.6"/>`,
    );
  if (scene === 'park')
    parts.push(
      `<rect y="250" width="640" height="230" fill="#4d7c0f"/>`,
      fixed
        ? `<rect x="290" y="250" width="22" height="120" fill="#78350f"/><circle cx="300" cy="230" r="70" fill="#15803d"/><rect x="380" y="350" width="120" height="14" fill="#92400e"/>`
        : `<path d="M240 400 L420 330" stroke="#78350f" stroke-width="22"/><circle cx="430" cy="320" r="55" fill="#15803d"/><rect x="380" y="380" width="120" height="14" fill="#92400e" transform="rotate(15 440 387)"/>`,
    );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">${parts.join('')}</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

export const DEMO_DEPARTMENTS: Department[] = [
  { id: 'd-roads', code: 'roads', name: 'Roads & Transport', color: '#f97316', base_bounty: 2500 },
  { id: 'd-water', code: 'water', name: 'Water Supply', color: '#0ea5e9', base_bounty: 1800 },
  { id: 'd-elec', code: 'electricity', name: 'Electricity', color: '#eab308', base_bounty: 1500 },
  { id: 'd-sanit', code: 'sanitation', name: 'Sanitation', color: '#22c55e', base_bounty: 1000 },
  { id: 'd-parks', code: 'parks', name: 'Parks & Gardens', color: '#10b981', base_bounty: 1200 },
  { id: 'd-general', code: 'general', name: 'General Works', color: '#a855f7', base_bounty: 1000 },
];

const p = (id: string, full_name: string, role: Profile['role'], department_id: string | null = null, points = 0): Profile => ({
  id, full_name, role, department_id, points, wallet_balance: 0,
});

export const DEMO_PROFILES: Profile[] = [
  p('u-asha', 'Asha Verma', 'citizen', null, 0),
  p('u-rohan', 'Rohan Mehta', 'citizen', null, 0),
  p('u-priya', 'Priya Singh', 'citizen', null, 0),
  p('u-ravi', 'Ravi Kumar', 'resolver', 'd-roads'),
  p('u-imran', 'Imran Shaikh', 'resolver', 'd-water'),
  p('u-meena', 'Meena Patel', 'resolver', 'd-elec'),
  p('u-suresh', 'Suresh Yadav', 'resolver', 'd-sanit'),
  p('u-kavya', 'Kavya Rao', 'resolver', 'd-parks'),
  p('u-arjun', 'Arjun Nair', 'resolver', 'd-general'),
  p('u-neha', 'Neha Joshi (Ward Admin)', 'admin'),
];

interface SeedIssue {
  scene: Scene;
  category: string;
  dept: string;
  summary: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  severity: number;
  reporter: string;
  status: Issue['status'];
  resolver?: string;
  upvotes: string[];
  hoursAgo: number;
  rating?: number;
}

const SEED: SeedIssue[] = [
  { scene: 'pothole', category: 'Pothole', dept: 'd-roads', summary: 'Deep pothole across the left lane, risk to two-wheelers.', description: 'Big pothole near the crossing, bikes swerving', address: 'Civil Lines, MG Marg', lat: 25.4526, lng: 81.8343, severity: 4, reporter: 'u-asha', status: 'assigned', resolver: 'u-ravi', upvotes: ['u-rohan', 'u-priya'], hoursAgo: 20 },
  { scene: 'garbage', category: 'Garbage dump', dept: 'd-sanit', summary: 'Overflowing garbage pile on the footpath beside shops.', description: 'Garbage not collected for days', address: 'Katra Market', lat: 25.4447, lng: 81.8545, severity: 3, reporter: 'u-rohan', status: 'pending_audit', resolver: 'u-suresh', upvotes: ['u-asha'], hoursAgo: 30 },
  { scene: 'streetlight', category: 'Broken streetlight', dept: 'd-elec', summary: 'Streetlight is off and wiring is exposed at the pole base.', description: 'Street light not working, very dark at night', address: 'George Town', lat: 25.4419, lng: 81.8414, severity: 4, reporter: 'u-priya', status: 'verified', resolver: 'u-meena', upvotes: ['u-asha', 'u-rohan'], hoursAgo: 72, rating: 5 },
  { scene: 'leak', category: 'Water leak', dept: 'd-water', summary: 'Burst pipeline flooding the road shoulder.', description: 'Pipe leaking clean water since morning', address: 'Tagore Town', lat: 25.4562, lng: 81.8562, severity: 4, reporter: 'u-asha', status: 'needs_review', resolver: 'u-imran', upvotes: ['u-priya'], hoursAgo: 40 },
  { scene: 'park', category: 'Fallen tree', dept: 'd-parks', summary: 'Fallen branch blocking the park walkway, bench damaged.', description: 'Tree fell in park after storm', address: 'Chandra Shekhar Azad Park', lat: 25.4579, lng: 81.8606, severity: 3, reporter: 'u-rohan', status: 'verified', resolver: 'u-kavya', upvotes: [], hoursAgo: 96, rating: 4 },
  { scene: 'pothole', category: 'Road damage', dept: 'd-roads', summary: 'Broken asphalt patch at the bus stop entry.', description: 'Road broken near bus stop', address: 'Jhalwa, near IIIT', lat: 25.4301, lng: 81.7714, severity: 2, reporter: 'u-priya', status: 'assigned', resolver: 'u-ravi', upvotes: ['u-asha', 'u-rohan'], hoursAgo: 6 },
  { scene: 'garbage', category: 'Garbage dump', dept: 'd-sanit', summary: 'Waste dumped at the corner of the residential lane.', description: 'garbage dumped in the lane', address: 'Allahpur', lat: 25.4385, lng: 81.8711, severity: 2, reporter: 'u-asha', status: 'assigned', resolver: 'u-suresh', upvotes: [], hoursAgo: 3 },
  { scene: 'leak', category: 'Drain overflow', dept: 'd-water', summary: 'Water pooling over the road from a leaking main.', description: 'water logging on main road', address: 'Naini Bridge approach', lat: 25.4177, lng: 81.8723, severity: 3, reporter: 'u-rohan', status: 'verified', resolver: 'u-imran', upvotes: ['u-priya'], hoursAgo: 120, rating: 4 },
];

export interface DemoState {
  version: number;
  departments: Department[];
  profiles: Profile[];
  issues: Issue[];
  upvotes: { issue_id: string; user_id: string }[];
  audits: Audit[];
  ledger: LedgerEntry[];
  treasury: { balance: number; fee_rate: number };
  moods: { user_id: string; mood: 'happy' | 'calm' | 'concerned' | 'angry'; created_at: string }[];
}

export const DEMO_VERSION = 1;

export function buildSeed(): DemoState {
  const now = Date.now();
  const iso = (h: number) => new Date(now - h * 3600_000).toISOString();
  const s: DemoState = {
    version: DEMO_VERSION,
    departments: DEMO_DEPARTMENTS.map((d) => ({ ...d })),
    profiles: DEMO_PROFILES.map((x) => ({ ...x })),
    issues: [],
    upvotes: [],
    audits: [],
    ledger: [],
    treasury: { balance: 0, fee_rate: 0.02 },
    moods: [],
  };
  let ledgerId = 1;
  const pushLedger = (e: Omit<LedgerEntry, 'id'>) => s.ledger.unshift({ id: ledgerId++, ...e });

  s.treasury.balance = 500000;
  pushLedger({ created_at: iso(200), kind: 'budget_topup', amount: 500000, issue_id: null, audit_id: null, profile_id: 'u-neha', treasury_balance_after: 500000, note: 'Ward 12 repair budget, Q4' });

  const ordered = [...SEED].sort((a, b) => b.hoursAgo - a.hoursAgo);
  ordered.forEach((x, i) => {
    const dept = s.departments.find((d) => d.id === x.dept)!;
    const id = `i-seed-${i + 1}`;
    const fixedPhoto = ['pending_audit', 'needs_review', 'verified'].includes(x.status);
    const issue: Issue = {
      id, created_at: iso(x.hoursAgo), reporter_id: x.reporter, lat: x.lat, lng: x.lng, address: x.address,
      description: x.description, before_photo_url: scenePhoto(x.scene, false, i),
      after_photo_url: fixedPhoto ? scenePhoto(x.scene, true, i) : null,
      status: x.status, category: x.category, department_id: x.dept, summary: x.summary, severity: x.severity,
      ai_confidence: 0.86 + (i % 3) * 0.04, bounty: computeBounty(dept.base_bounty, x.severity),
      upvotes: x.upvotes.length, assigned_to: x.resolver ?? null, assigned_at: iso(x.hoursAgo - 0.1),
      resolved_at: fixedPhoto ? iso(x.hoursAgo / 3) : null, verified_at: null,
    };
    s.issues.unshift(issue);
    x.upvotes.forEach((u) => s.upvotes.push({ issue_id: id, user_id: u }));
    s.profiles.find((pp) => pp.id === x.reporter)!.points += 10;

    if (x.status === 'verified' || x.status === 'needs_review') {
      const auditId = `a-seed-${i + 1}`;
      const review = x.status === 'needs_review';
      s.audits.unshift({
        id: auditId, created_at: iso(x.hoursAgo / 3 - 0.05), issue_id: id, resolver_id: x.resolver!,
        rating: review ? 3 : x.rating!, confidence: review ? 0.58 : 0.91, is_legit: true,
        reasoning: review
          ? 'Leak appears sealed but the after photo is taken from a different angle; cannot fully confirm it is the same spot.'
          : 'Same location confirmed by matching buildings and road markings. The reported problem is no longer visible and the repair looks complete.',
        model: 'demo-seed', decision: review ? 'needs_review' : 'approved', reviewed_by: null, review_note: null, reviewed_at: null,
      });
      if (!review) {
        const fee = Math.round(issue.bounty! * s.treasury.fee_rate * 100) / 100;
        s.treasury.balance -= issue.bounty!;
        pushLedger({ created_at: iso(x.hoursAgo / 3 - 0.04), kind: 'payout', amount: issue.bounty!, issue_id: id, audit_id: auditId, profile_id: x.resolver!, treasury_balance_after: s.treasury.balance, note: 'Payout for verified repair' });
        s.treasury.balance -= fee;
        pushLedger({ created_at: iso(x.hoursAgo / 3 - 0.04), kind: 'platform_fee', amount: fee, issue_id: id, audit_id: auditId, profile_id: null, treasury_balance_after: s.treasury.balance, note: 'Auracity platform fee' });
        s.profiles.find((pp) => pp.id === x.resolver)!.wallet_balance += issue.bounty!;
        s.profiles.find((pp) => pp.id === x.reporter)!.points += 5;
        issue.verified_at = iso(x.hoursAgo / 3 - 0.04);
      }
    }
  });

  s.moods = [
    { user_id: 'u-rohan', mood: 'concerned', created_at: iso(0.5) },
    { user_id: 'u-priya', mood: 'calm', created_at: iso(1.2) },
    { user_id: 'seed-1', mood: 'concerned', created_at: iso(0.8) },
    { user_id: 'seed-2', mood: 'happy', created_at: iso(0.3) },
    { user_id: 'seed-3', mood: 'concerned', created_at: iso(1.5) },
  ];
  return s;
}
