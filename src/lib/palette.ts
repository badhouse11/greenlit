/** Studio ticket stocks. Each studio prints on its own colour. */
export const PALETTE: Record<string, { name: string; bg: string; ink: string; edge: string }> = {
  grenadine: { name: 'Grenadine', bg: '#D44720', ink: '#FFF1DC', edge: '#A9341A' },
  beeswax: { name: 'Beeswax', bg: '#E9A752', ink: '#5A2A14', edge: '#C38431' },
  darlington: { name: 'Darlington', bg: '#ACCAB2', ink: '#2F4A3A', edge: '#8AAE93' },
  powder: { name: 'Powder Blue', bg: '#9DBFD4', ink: '#22405A', edge: '#7AA1BA' },
  lilac: { name: 'Lobby Lilac', bg: '#BBA4CC', ink: '#3E2A55', edge: '#9D85B2' },
  bubblegum: { name: 'Bubblegum', bg: '#E8939F', ink: '#5B1F2B', edge: '#CB7280' },
  mustard: { name: 'Mustard', bg: '#D8B23A', ink: '#4A3510', edge: '#B79222' },
  latte: { name: 'Café Latte', bg: '#78614D', ink: '#F3D9A8', edge: '#5E4A3A' },
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
