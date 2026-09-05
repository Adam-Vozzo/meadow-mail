export type Upgrade = 'bridge' | 'garden' | 'shortcut' | 'boots';
export type GameState = {
  version: 1;
  delivered: number;
  carrying: boolean;
  stamps: number;
  upgrades: Record<Upgrade, boolean>;
  elapsed: number;
  x: number;
  z: number;
};
export const costs: Record<Upgrade, number> = {
  bridge: 3,
  garden: 2,
  shortcut: 2,
  boots: 3,
};
export const POST = [-17, -12] as const;
export const DOCK = [38, 9] as const;
export const FAR_DOCK = [63, -15] as const;
export const deliveries = [
  {
    id: 'seeds',
    title: 'A little room to grow.',
    recipient: 'Molly the rabbit',
    animal: '🐰',
    kind: 'package',
    position: [-24, 4],
    hint: 'A parcel of sunflower seeds for Molly, beside her little blue cottage.',
    story:
      'Grandma’s sunflower seeds! Molly plants them by her cottage. Some kinds of love grow taller every summer.',
  },
  {
    id: 'picnic',
    title: 'It’s been too long.',
    recipient: 'Bramble the bear',
    animal: '🐻',
    kind: 'letter',
    position: [-11, -24],
    hint: 'Molly’s picnic invitation is for Bramble, in the northern woods.',
    story:
      '“I thought she’d forgotten.” Bramble puts the kettle on. Molly joins him beneath the trees, and two old friends begin again.',
  },
  {
    id: 'harbour',
    title: 'Something on the horizon.',
    recipient: 'Oren the otter',
    animal: '🦦',
    kind: 'package',
    position: [22, -9],
    hint: 'Deliver the workshop blueprints to Oren, across the creek by the windmill.',
    story:
      'Oren’s harbour workshop opens! As a thank-you, the Little Mallow is yours to borrow. There are letters beyond this island, too.',
  },
  {
    id: 'lighthouse',
    title: 'Across a little blue.',
    recipient: 'Pip the puffin',
    animal: '🐧',
    kind: 'letter',
    position: [81, -18],
    hint: 'Sail from the eastern jetty to Gull Island. Pip waits by the lighthouse.',
    story:
      'A letter from home. Pip lights the lighthouse again, so every traveller can find their way back.',
  },
  {
    id: 'home',
    title: 'Wish you were here.',
    recipient: 'Molly & Bramble',
    animal: '🐰',
    kind: 'letter',
    position: [-15, -23],
    hint: 'Bring Pip’s postcard to the friends at their woodland picnic.',
    story:
      '“Next time, we’ll all go.” Five deliveries, a sea of dreams, and a meadow full of neighbours who feel a little less far apart.',
  },
] as const;
export function initialState(): GameState {
  return {
    version: 1,
    delivered: 0,
    carrying: false,
    stamps: 0,
    upgrades: { bridge: false, garden: false, shortcut: false, boots: false },
    elapsed: 0,
    x: -18,
    z: 17,
  };
}
export function parseSave(raw: string | null): GameState {
  if (!raw) return initialState();
  try {
    const d = JSON.parse(raw);
    if (
      d.version !== 1 ||
      !Number.isInteger(d.delivered) ||
      d.delivered < 0 ||
      d.delivered > 5 ||
      !Number.isInteger(d.stamps) ||
      d.stamps < 0 ||
      d.stamps > 15 ||
      typeof d.carrying !== 'boolean' ||
      !Number.isFinite(d.elapsed) ||
      d.elapsed < 0 ||
      !Number.isFinite(d.x) ||
      !Number.isFinite(d.z) ||
      !d.upgrades ||
      Object.keys(costs).some((k) => typeof d.upgrades[k] !== 'boolean')
    )
      return initialState();
    const s = initialState();
    s.delivered = d.delivered;
    s.carrying = d.carrying && d.delivered < 5;
    s.stamps = d.stamps;
    s.elapsed = d.elapsed;
    for (const k of Object.keys(costs) as Upgrade[])
      s.upgrades[k] = d.upgrades[k];
    if (
      isLand(d.x, d.z) &&
      Math.abs(d.x) < 105 &&
      Math.abs(d.z) < 50 &&
      (d.x < 53 || d.delivered >= 3)
    ) {
      s.x = d.x;
      s.z = d.z;
    }
    return s;
  } catch {
    return initialState();
  }
}
export function inCreek(x: number, z: number) {
  return x > 3.5 && x < 9 && z < 17 && z > -44;
}
export function isLand(x: number, z: number) {
  return (
    (Math.hypot(x, z) < 42.5 && !inCreek(x, z)) ||
    Math.hypot(x - 80, z + 15) < 18
  );
}
export function canWalk(x: number, z: number, s: GameState) {
  if (s.upgrades.bridge && x >= 2 && x <= 10.5 && Math.abs(z) < 2.2)
    return true;
  if (!s.upgrades.shortcut && Math.abs(z + 18) < 0.7 && x > -23 && x < -17)
    return false;
  return isLand(x, z);
}
export function pickUp(s: GameState): GameState {
  return s.delivered < 5 && !s.carrying ? { ...s, carrying: true } : s;
}
export function deliver(s: GameState): GameState {
  return s.carrying && s.delivered < 5
    ? {
        ...s,
        delivered: s.delivered + 1,
        stamps: s.stamps + 3,
        carrying: false,
      }
    : s;
}
export function purchase(s: GameState, id: Upgrade): GameState {
  return s.upgrades[id] || s.stamps < costs[id]
    ? s
    : {
        ...s,
        stamps: s.stamps - costs[id],
        upgrades: { ...s.upgrades, [id]: true },
      };
}
