/** Verfügbare Segmentierungsmodelle (transformers.js, Apache-2.0). Reihenfolge = Anzeigereihenfolge. */
export interface SamModellInfo {
  id: string;
  anzeige: string;
  repo: string;
  art: 'sam' | 'sam2';
  /** dtype-Angaben für transformers.js (quantisiert = klein und schnell) */
  dtype: Record<string, string> | string;
  /** dtype auf WebGPU: unquantisiert (Quantisierung läuft auf der Grafikkarte oft nicht oder langsam) */
  dtypeGpu?: string;
  /** ungefähre Ladegrösse in MB (Summe der geladenen Dateien) */
  mb: number;
  lizenz: string;
}

export const SAM_MODELLE: SamModellInfo[] = [
  {
    id: 'slimsam-77',
    anzeige: 'SlimSAM-77 (klein)',
    repo: 'Xenova/slimsam-77-uniform',
    art: 'sam',
    dtype: 'q8',
    dtypeGpu: 'fp32',
    mb: 14,
    lizenz: 'Apache-2.0',
  },
  {
    id: 'slimsam-50',
    anzeige: 'SlimSAM-50 (mittel)',
    repo: 'Xenova/slimsam-50-uniform',
    art: 'sam',
    dtype: 'q8',
    dtypeGpu: 'fp32',
    mb: 35,
    lizenz: 'Apache-2.0',
  },
  {
    id: 'sam2-tiny',
    anzeige: 'SAM 2.1 tiny (nicht gewählt)',
    repo: 'onnx-community/sam2.1-hiera-tiny-ONNX',
    art: 'sam2',
    dtype: 'q4f16',
    mb: 33,
    lizenz: 'Apache-2.0',
  },
];

export const STANDARD_SAM = 'slimsam-77';
export const holeModell = (id: string): SamModellInfo =>
  SAM_MODELLE.find((m) => m.id === id) ?? SAM_MODELLE[0]!;
