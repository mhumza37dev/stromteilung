/**
 * Mock seller fixtures used until the marketplace backend is in place.
 *
 * Each entry is shaped to match the `Seller` domain type and groups sellers
 * by their German city. Buyer-side filtering and the hero preview both read
 * from this list.
 *
 * To swap real data later, replace these arrays with the result of a fetch
 * call — consumers only need `getSellersByCity` to keep working.
 */
import type { Seller } from '../types';

export const SELLERS_BY_CITY: Record<string, Seller[]> = {
  München: [
    { id: 1, name: 'Solarpark Grüntal GmbH', rate: 0.18, nightRate: 0.14, capacity: 850,  rating: 4.8, reviews: 23, distance: 120, transformer: 'TR-2847', location: 'Maximilianstr. 12',         whatsapp: '4915123456789' },
    { id: 2, name: 'Familie Hoffmann',        rate: 0.21, nightRate: null, capacity: 320,  rating: 4.5, reviews: 11, distance: 280, transformer: 'TR-2847', location: 'Schillerstr. 5',            whatsapp: '4915987654321' },
    { id: 3, name: 'BioEnergie Koch GmbH',    rate: 0.16, nightRate: 0.12, capacity: 1200, rating: 4.9, reviews: 47, distance: 380, transformer: 'TR-2847', location: 'Goethestr. 18',             whatsapp: '4916011223344' },
    { id: 4, name: 'Windkraft Bergmann',       rate: 0.19, nightRate: null, capacity: 600,  rating: 4.3, reviews:  8, distance: 450, transformer: 'TR-2847', location: 'Beethovenstr. 3',           whatsapp: '4915566778899' },
  ],
  Berlin: [
    { id: 1, name: 'Solar Spandau eG',         rate: 0.17, nightRate: 0.13, capacity: 920,  rating: 4.7, reviews: 34, distance:  95, transformer: 'TR-1392', location: 'Kantstr. 18',               whatsapp: '4916055443322' },
    { id: 2, name: 'Familie Schulze',           rate: 0.22, nightRate: null, capacity: 280,  rating: 4.4, reviews:  9, distance: 220, transformer: 'TR-1392', location: 'Bismarckstr. 8',            whatsapp: '4915677889900' },
    { id: 3, name: 'GreenWatt Berlin GmbH',     rate: 0.15, nightRate: 0.11, capacity: 1400, rating: 4.9, reviews: 52, distance: 340, transformer: 'TR-1392', location: 'Leibnizstr. 22',            whatsapp: '4915999887766' },
    { id: 4, name: 'Windpark Charlottenburg',    rate: 0.20, nightRate: null, capacity: 550,  rating: 4.2, reviews: 12, distance: 470, transformer: 'TR-1392', location: 'Knesebeckstr. 5',           whatsapp: '4916122334455' },
  ],
  Frankfurt: [
    { id: 1, name: 'Mainstrom AG',             rate: 0.18, nightRate: 0.14, capacity: 780,  rating: 4.6, reviews: 28, distance: 150, transformer: 'TR-5104', location: 'Goethestr. 12',             whatsapp: '4915788776655' },
    { id: 2, name: 'Familie Müller',            rate: 0.20, nightRate: null, capacity: 340,  rating: 4.5, reviews: 14, distance: 260, transformer: 'TR-5104', location: 'Eschenheimer Anlage 4',     whatsapp: '4916088997744' },
    { id: 3, name: 'EcoEnergie Hessen',          rate: 0.16, nightRate: 0.12, capacity: 1100, rating: 4.8, reviews: 41, distance: 410, transformer: 'TR-5104', location: 'Bockenheimer Landstr. 88', whatsapp: '4915211223344' },
  ],
  Köln: [
    { id: 1, name: 'RheinSolar GmbH',           rate: 0.19, nightRate: 0.15, capacity: 880,  rating: 4.7, reviews: 31, distance: 110, transformer: 'TR-3711', location: 'Beethovenstr. 14',          whatsapp: '4915844556677' },
    { id: 2, name: 'Familie Krämer',             rate: 0.21, nightRate: null, capacity: 310,  rating: 4.4, reviews: 10, distance: 240, transformer: 'TR-3711', location: 'Mozartstr. 8',              whatsapp: '4916177889900' },
    { id: 3, name: 'Kölner Bürgerenergie eG',    rate: 0.17, nightRate: 0.13, capacity: 1050, rating: 4.9, reviews: 44, distance: 350, transformer: 'TR-3711', location: 'Aachener Str. 32',          whatsapp: '4915933221100' },
    { id: 4, name: 'Windkraft Rhein-Süd',         rate: 0.20, nightRate: null, capacity: 620,  rating: 4.3, reviews: 11, distance: 480, transformer: 'TR-3711', location: 'Severinstr. 16',           whatsapp: '4915466778899' },
  ],
};

/**
 * Map a free-text location string to the matching seller list.
 *
 * Falls back to München so the UI always has something to show — useful for
 * the hero preview where the auto-detected default city may not exist yet.
 */
export function getCityFromLocation(loc: string | null | undefined): string {
  if (!loc) return 'München';
  for (const city of Object.keys(SELLERS_BY_CITY)) {
    if (loc.includes(city)) return city;
  }
  return 'München';
}

/** Convenience accessor used by the buyer dashboard. */
export function getSellersByCity(city: string): Seller[] {
  return SELLERS_BY_CITY[city] ?? SELLERS_BY_CITY.München;
}

/** Sellers shown in the landing-page hero preview. */
export const HERO_SELLERS = SELLERS_BY_CITY.München;
