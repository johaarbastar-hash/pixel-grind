// Gear the skater can wear, bought in the shop with coins. Pure data, no DOM:
// colours are palette names (see COL in sprites.js), resolved when the
// skater's sprites are built. Prices are by tier in CONFIG.shop.prices.
//
// A colour can also be a two-colour pattern: { a, b, kind } where kind is
// 'rows' (stripes), 'cols' or 'check'. Avoid ink (the outline colour) on the
// body: it merges with the outline and the silhouette breaks up.
//
// Hat designs are drawn in sprites.js (HATS). 'hat' is the main colour (also
// used for the hat in the wipeout frames), 'hatB' the detail colour.

export const SLOTS = ['hat', 'shirt', 'pants', 'board'];
export const SLOT_NAMES = { hat: 'HAT', shirt: 'SHIRT', pants: 'PANTS', board: 'BOARD' };

export const ITEMS = [
  // Hats
  { id: 'cap', slot: 'hat', name: 'CAP', tier: 'free', design: 'cap', hat: 'teal' },
  { id: 'hair', slot: 'hat', name: 'NO HAT', tier: 'free', design: 'hair', hat: 'brown' },
  { id: 'backcap', slot: 'hat', name: 'BACK CAP', tier: 'cheap', design: 'backcap', hat: 'rose' },
  { id: 'beanie', slot: 'hat', name: 'BEANIE', tier: 'cheap', design: 'beanie', hat: 'orange', hatB: 'gold' },
  { id: 'helmet', slot: 'hat', name: 'HELMET', tier: 'mid', design: 'helmet', hat: 'white', hatB: 'rose' },
  { id: 'phones', slot: 'hat', name: 'HEADPHONES', tier: 'high', design: 'phones', hat: 'rose', hatB: 'slate' },
  { id: 'crown', slot: 'hat', name: 'CROWN', tier: 'top', design: 'crown', hat: 'gold', hatB: 'rose' },

  // Shirts
  { id: 'rosetee', slot: 'shirt', name: 'ROSE TEE', tier: 'free', shirt: 'rose' },
  { id: 'tealtee', slot: 'shirt', name: 'TEAL TEE', tier: 'cheap', shirt: 'teal' },
  { id: 'whitetee', slot: 'shirt', name: 'WHITE TEE', tier: 'cheap', shirt: 'white' },
  { id: 'minttee', slot: 'shirt', name: 'MINT TEE', tier: 'cheap', shirt: 'mint' },
  { id: 'goldtee', slot: 'shirt', name: 'GOLD TEE', tier: 'mid', shirt: 'gold' },
  { id: 'purpletee', slot: 'shirt', name: 'PURPLE TEE', tier: 'mid', shirt: 'purple' },
  { id: 'stripes', slot: 'shirt', name: 'STRIPES', tier: 'high', shirt: { a: 'cream', b: 'navy', kind: 'rows' } },

  // Trousers
  { id: 'jeans', slot: 'pants', name: 'JEANS', tier: 'free', pants: 'indigo' },
  { id: 'rosepants', slot: 'pants', name: 'ROSE', tier: 'cheap', pants: 'rose' },
  { id: 'cargo', slot: 'pants', name: 'CARGO', tier: 'cheap', pants: 'brown' },
  { id: 'grey', slot: 'pants', name: 'GREY', tier: 'cheap', pants: 'steel' },
  { id: 'tealpants', slot: 'pants', name: 'TEAL', tier: 'mid', pants: 'teal' },
  { id: 'whitepants', slot: 'pants', name: 'WHITE', tier: 'mid', pants: 'cream' },
  { id: 'checks', slot: 'pants', name: 'CHECKS', tier: 'high', pants: { a: 'slate', b: 'cream', kind: 'check' } },

  // Boards: deck underside (shows in flips) and wheels
  { id: 'classic', slot: 'board', name: 'CLASSIC', tier: 'free', deck: 'gold', wheel: 'cream' },
  { id: 'roseboard', slot: 'board', name: 'ROSE', tier: 'cheap', deck: 'rose', wheel: 'cream' },
  { id: 'tealboard', slot: 'board', name: 'TEAL', tier: 'cheap', deck: 'teal', wheel: 'mint' },
  { id: 'night', slot: 'board', name: 'NIGHT', tier: 'mid', deck: 'purple', wheel: 'gold' },
  { id: 'mintboard', slot: 'board', name: 'MINT', tier: 'mid', deck: 'mint', wheel: 'white' },
  { id: 'checker', slot: 'board', name: 'CHECKER', tier: 'high', deck: { a: 'ink', b: 'white', kind: 'check' }, wheel: 'rose' },
  { id: 'flame', slot: 'board', name: 'FLAME', tier: 'high', deck: { a: 'orange', b: 'rose', kind: 'cols' }, wheel: 'gold' },
];

const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

export const DEFAULT_GEAR = { hat: 'cap', shirt: 'rosetee', pants: 'jeans', board: 'classic' };

export function itemById(id) {
  return BY_ID.get(id) || null;
}

export function itemsIn(slot) {
  return ITEMS.filter((it) => it.slot === slot);
}

// Worn gear ({ slot: item id }) -> the colours and hat design the skater's
// sprites are built with.
export function lookFor(gear) {
  const get = (slot) => itemById(gear[slot]) || itemById(DEFAULT_GEAR[slot]);
  const hat = get('hat');
  const board = get('board');
  return {
    hatDesign: hat.design,
    hat: hat.hat,
    hatB: hat.hatB || hat.hat,
    shirt: get('shirt').shirt,
    pants: get('pants').pants,
    deck: board.deck,
    wheel: board.wheel,
  };
}
