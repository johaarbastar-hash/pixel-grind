// The wallet, owned gear and worn gear, saved in storage. No DOM access.
// Coins are added as they are picked up (main.js) and the wallet is saved when
// a run pauses or ends, not on every pickup.

import { getSetting, setSetting } from './storage.js';
import { ITEMS, SLOTS, DEFAULT_GEAR, itemById } from './gear.js';

export function createShop(cfg) {
  const owned = new Set();
  const savedOwned = getSetting('owned', []);
  if (Array.isArray(savedOwned)) for (const id of savedOwned) if (itemById(id)) owned.add(id);
  for (const it of ITEMS) if (cfg.shop.prices[it.tier] === 0) owned.add(it.id);

  // Worn gear, falling back to the default for anything unknown or not owned.
  const saved = getSetting('gear', null) || {};
  const gear = {};
  for (const slot of SLOTS) {
    const it = itemById(saved[slot]);
    gear[slot] = it && it.slot === slot && owned.has(it.id) ? it.id : DEFAULT_GEAR[slot];
  }

  const shop = {
    wallet: Math.max(0, Math.floor(Number(getSetting('coins', 0)) || 0)),
    gear,
    price: (it) => cfg.shop.prices[it.tier],
    owns: (id) => owned.has(id),
    wearing: (id) => {
      const it = itemById(id);
      return !!it && gear[it.slot] === id;
    },
    addCoins(n) {
      shop.wallet += n;
    },
    // Pays n coins (and saves) if the wallet has them; returns false if not.
    spend(n) {
      if (shop.wallet < n) return false;
      shop.wallet -= n;
      shop.save();
      return true;
    },
    save() {
      setSetting('coins', shop.wallet);
    },
    // Buying also puts it on. Returns false if it can't be bought.
    buy(id) {
      const it = itemById(id);
      if (!it || owned.has(id) || shop.wallet < shop.price(it)) return false;
      shop.wallet -= shop.price(it);
      owned.add(id);
      setSetting('owned', [...owned]);
      shop.save();
      shop.wear(id);
      return true;
    },
    wear(id) {
      const it = itemById(id);
      if (!it || !owned.has(id)) return false;
      gear[it.slot] = id;
      setSetting('gear', { ...gear });
      return true;
    },
  };
  return shop;
}
