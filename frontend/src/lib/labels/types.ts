/**
 * Label configuration types for printable labels.
 */

export interface LabelSize {
  id: string;
  name: string;
  brand: string;
  width: number; // mm
  height: number; // mm
  labelsPerSheet?: number;
  columns?: number;
  rows?: number;
}

/**
 * Pre-defined label sizes for common label formats.
 * Sizes are in millimeters.
 */
export const LABEL_SIZES: LabelSize[] = [
  // Avery Address Labels - standard address labels
  {
    id: "avery-5160",
    name: "5160 Address",
    brand: "Avery",
    width: 66.7,
    height: 25.4,
    labelsPerSheet: 30,
    columns: 3,
    rows: 10,
  },
  // Dymo Labels
  {
    id: "dymo-30252",
    name: "30252 Address",
    brand: "Dymo",
    width: 89,
    height: 28,
  },
  {
    id: "dymo-30336",
    name: "30336 Small Multipurpose",
    brand: "Dymo",
    width: 57,
    height: 32,
  },
  // Brother P-touch - continuous tape labels
  {
    id: "brother-12mm",
    name: "12mm Tape",
    brand: "Brother P-touch",
    width: 12,
    height: 50,
  },
  {
    id: "brother-24mm",
    name: "24mm Tape",
    brand: "Brother P-touch",
    width: 24,
    height: 60,
  },
  // 4x6 thermal labels (common for shipping)
  {
    id: "thermal-4x6",
    name: "4x6 Thermal",
    brand: "Standard",
    width: 101.6,
    height: 152.4,
  },
];

export type LabelType = "item" | "location";

export interface LabelData {
  type: LabelType;
  id: string;
  name: string;
  category?: string;
  location?: string;
  description?: string;
  qrUrl: string;
}

export interface LabelPrintOptions {
  labelSize: LabelSize;
  showQrCode: boolean;
  showCategory: boolean;
  showLocation: boolean;
  showDescription: boolean;
}

export const DEFAULT_LABEL_OPTIONS: LabelPrintOptions = {
  labelSize: LABEL_SIZES[0],
  showQrCode: true,
  showCategory: true,
  showLocation: true,
  showDescription: false,
};
