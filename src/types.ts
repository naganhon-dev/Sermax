export interface TabData {
  id: string;
  name: string;
  order: number;
}

export interface SheetData {
  id: string;
  name: string;
  hidden: boolean;
  order: number;
  merges: string[];
  colWidths: Record<string, number>;
  chunkCount: number;
}

export interface ChunkData {
  start: number;
  data: string; // JSON string of CellValue[][]
}

export type CellValue = string | number | null | { f: string; v: any };

export interface ImportManifest {
  order: string[]; // array of tabIds
}

export interface ImportTabFile {
  tabId: string;
  tabName: string;
  sheets: {
    id: string;
    name: string;
    hidden: boolean;
    merges: string[];
    colWidths: Record<string, number>;
    rows: CellValue[][];
  }[];
}
