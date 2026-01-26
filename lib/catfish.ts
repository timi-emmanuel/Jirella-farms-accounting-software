export type CatfishStage = 'FRIES' | 'FINGERLINGS' | 'JUVENILES' | 'MELANGE' | 'ADULTS' | 'PARENT_STOCK';

type StageRange = { min: number; max: number | null; label: CatfishStage };

const STAGE_RANGES: StageRange[] = [
  { label: 'FRIES', min: 0, max: 2 },
  { label: 'FINGERLINGS', min: 3, max: 6 },
  { label: 'JUVENILES', min: 7, max: 12 },
  { label: 'MELANGE', min: 13, max: 20 },
  { label: 'ADULTS', min: 21, max: 32 },
  { label: 'PARENT_STOCK', min: 33, max: null }
];

export const getCatfishAgeWeeks = (startDate?: string | null) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const diffMs = Date.now() - start.getTime();
  const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
  return Math.max(0, weeks);
};

export const getCatfishStage = (startDate?: string | null): CatfishStage => {
  const weeks = getCatfishAgeWeeks(startDate);
  const match = STAGE_RANGES.find((range) => weeks >= range.min && (range.max === null || weeks <= range.max));
  return match?.label ?? 'FRIES';
};

export const formatCatfishStage = (stage: CatfishStage) => {
  switch (stage) {
    case 'FRIES':
      return 'Fries (0-2 wks)';
    case 'FINGERLINGS':
      return 'Fingerlings (3-6 wks)';
    case 'JUVENILES':
      return 'Juveniles (7-12 wks)';
    case 'MELANGE':
      return 'Melange (13-20 wks)';
    case 'ADULTS':
      return 'Adults (21-32 wks)';
    case 'PARENT_STOCK':
      return 'Parent Stock (33+ wks)';
    default:
      return stage;
  }
};
