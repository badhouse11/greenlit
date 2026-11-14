/**
 * Studio sets. Each studio gets a main colour, two support colours and its own stamp.
 * The keys stay the same as the original ticket stocks so saved games still load.
 */
export type StampKey = 'iris' | 'canister' | 'horizon' | 'spools' | 'chrome' | 'reel' | 'zigzag' | 'quarters' | 'sprocket' | 'lens' | 'clapper' | 'play';

export interface StudioSet {
  name: string; // the colour's name
  bg: string; // main colour
  ink: string; // text on the main colour
  edge: string; // a darker shade, for edges
  support: [string, string];
  stamp: StampKey;
  stampName: string;
}

export const PALETTE: Record<string, StudioSet> = {
  grenadine: { name: 'Rewind Red', bg: '#E5331F', ink: '#FBF4E6', edge: '#B5240F', support: ['#F9A204', '#1A1F25'], stamp: 'iris', stampName: 'The Iris' },
  darlington: { name: 'Rental Green', bg: '#006633', ink: '#F2E6CF', edge: '#004A25', support: ['#7CC4A0', '#F9A204'], stamp: 'canister', stampName: 'The Canister' },
  beeswax: { name: 'Amber', bg: '#F9A204', ink: '#1A1F25', edge: '#C47F00', support: ['#E5331F', '#FBF4E6'], stamp: 'horizon', stampName: 'The Horizon' },
  powder: { name: 'Tape Teal', bg: '#026C80', ink: '#F2E6CF', edge: '#014F5E', support: ['#6FB7D9', '#F9A204'], stamp: 'spools', stampName: 'The Spools' },
  mustard: { name: 'Sunset', bg: '#FF6A13', ink: '#1A1F25', edge: '#D2510A', support: ['#FFC72C', '#7A2943'], stamp: 'chrome', stampName: 'The Chrome' },
  lilac: { name: 'Plum', bg: '#7A2943', ink: '#F7DDE6', edge: '#5C1D31', support: ['#E85A8C', '#F9A204'], stamp: 'reel', stampName: 'The Reel' },
  bubblegum: { name: 'Hot Pink', bg: '#E85A8C', ink: '#1A1F25', edge: '#C73D6F', support: ['#FBF4E6', '#7A2943'], stamp: 'zigzag', stampName: 'The Zigzag' },
  tangerine: { name: 'Sky', bg: '#6FB7D9', ink: '#1A1F25', edge: '#4E98BC', support: ['#026C80', '#FBF4E6'], stamp: 'quarters', stampName: 'The Quarters' },
  pistachio: { name: 'Mint', bg: '#7CC4A0', ink: '#1A1F25', edge: '#5AA67F', support: ['#006633', '#FBF4E6'], stamp: 'sprocket', stampName: 'The Sprocket' },
  bellhop: { name: 'Midnight', bg: '#1A1F25', ink: '#F2E6CF', edge: '#000000', support: ['#E5331F', '#F9A204'], stamp: 'lens', stampName: 'The Lens' },
  latte: { name: 'Café', bg: '#78614D', ink: '#F3D9A8', edge: '#5E4A3A', support: ['#F9A204', '#1A1F25'], stamp: 'clapper', stampName: 'The Clapper' },
  velvet: { name: 'Cream', bg: '#FBF4E6', ink: '#1A1F25', edge: '#D9CBB0', support: ['#E5331F', '#026C80'], stamp: 'play', stampName: 'The Play' },
};

export const PALETTE_KEYS = Object.keys(PALETTE);

export const stock = (key: string) => PALETTE[key] ?? PALETTE.beeswax;

export const STUDIO_NAMES = [
  'Badhouse Pictures',
  'Moonlight Films',
  'Golden Age Studios',
  'The Last Take',
  'Velvet Rope Pictures',
  'Second Unit',
  'Dolly Zoom Ltd',
  'Final Cut Pictures',
  'Back Lot Pictures',
  'Matinee Idol & Co.',
  'Gaffer Tape Films',
  'Day for Night',
  'Craft Services',
  'Overbudget Pictures',
];
