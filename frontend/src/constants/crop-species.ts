export type CropCategory = {
  label: string;
  species: string[];
};

export const CUSTOM_SPECIES = "Other (custom)";

export const CROP_CATEGORIES: CropCategory[] = [
  {
    label: "Shrimp",
    species: [
      "Vannamei",
      "Tiger Prawn",
      "Indian White Shrimp",
      "Banana Prawn",
      "Golda Prawn",
      "River Scampi",
    ],
  },
  {
    label: "Fish — Freshwater",
    species: [
      "Rohu",
      "Catla",
      "Mrigal",
      "Common Carp",
      "Grass Carp",
      "Tilapia",
      "Basa",
      "Murrel",
      "Magur",
      "Singhi",
      "Pearl Spot",
    ],
  },
  {
    label: "Fish — Brackish / Marine",
    species: [
      "Barramundi",
      "Milkfish",
      "Pompano",
      "Mullet",
      "Grouper",
      "Cobia",
      "Red Snapper",
    ],
  },
  {
    label: "Crab",
    species: ["Mud Crab", "Blue Crab"],
  },
  {
    label: "Mollusc",
    species: [
      "Pacific Oyster",
      "Backwater Oyster",
      "Green Mussel",
      "Pearl Mussel",
    ],
  },
  {
    label: "Seaweed",
    species: ["Cottonii", "Gracilaria"],
  },
  {
    label: "Other",
    species: [CUSTOM_SPECIES],
  },
];

export type SpeciesDuration = {
  minDays: number;
  maxDays: number;
};

export const SPECIES_DURATION_MAP: Record<string, SpeciesDuration> = {
  Vannamei: { minDays: 90, maxDays: 120 },
  "Tiger Prawn": { minDays: 120, maxDays: 180 },
  "Indian White Shrimp": { minDays: 90, maxDays: 120 },
  "Banana Prawn": { minDays: 120, maxDays: 150 },
  "Golda Prawn": { minDays: 120, maxDays: 150 },
  "River Scampi": { minDays: 120, maxDays: 150 },

  Rohu: { minDays: 180, maxDays: 270 },
  Catla: { minDays: 180, maxDays: 270 },
  Mrigal: { minDays: 180, maxDays: 270 },
  "Common Carp": { minDays: 180, maxDays: 270 },
  "Grass Carp": { minDays: 180, maxDays: 270 },
  Tilapia: { minDays: 150, maxDays: 210 },
  Basa: { minDays: 180, maxDays: 240 },
  Murrel: { minDays: 180, maxDays: 270 },
  Magur: { minDays: 180, maxDays: 270 },
  Singhi: { minDays: 180, maxDays: 270 },
  "Pearl Spot": { minDays: 180, maxDays: 270 },

  Barramundi: { minDays: 270, maxDays: 365 },
  Milkfish: { minDays: 180, maxDays: 270 },
  Pompano: { minDays: 180, maxDays: 270 },
  Mullet: { minDays: 180, maxDays: 270 },
  Grouper: { minDays: 270, maxDays: 365 },
  Cobia: { minDays: 270, maxDays: 365 },
  "Red Snapper": { minDays: 270, maxDays: 365 },

  "Mud Crab": { minDays: 60, maxDays: 90 },
  "Blue Crab": { minDays: 60, maxDays: 90 },

  "Pacific Oyster": { minDays: 180, maxDays: 270 },
  "Backwater Oyster": { minDays: 180, maxDays: 270 },
  "Green Mussel": { minDays: 180, maxDays: 270 },
  "Pearl Mussel": { minDays: 180, maxDays: 270 },

  Cottonii: { minDays: 45, maxDays: 60 },
  Gracilaria: { minDays: 45, maxDays: 60 },
};

export const getSpeciesForCategory = (categoryLabel: string) =>
  CROP_CATEGORIES.find((category) => category.label === categoryLabel)?.species ??
  [];

export const getCategoryLabels = () =>
  CROP_CATEGORIES.map((category) => category.label);

export const getAllSpecies = () =>
  CROP_CATEGORIES.flatMap((category) => category.species);

export const isCustomSpecies = (species: string) => species === CUSTOM_SPECIES;
