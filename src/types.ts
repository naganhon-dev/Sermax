export interface TabData {
  id: string;
  name: string;
  order: number;
}

export interface StyleData {
  bg?: string; // background color hex without #
  fc?: string; // font color hex without #
  b?: number; // bold 1/0
  i?: number; // italic 1/0
  ha?: 'l' | 'c' | 'r'; // horizontal align
  w?: number; // wrap text 1/0
}

export interface SheetData {
  id: string;
  name: string;
  hidden: boolean;
  order: number;
  merges: string[];
  colWidths: Record<string, number>;
  chunkCount: number;
  styles?: StyleData[];
  frozenCols?: number;
}

export type CellPrimitive = string | number | boolean | null;
export type CellObject = { f?: string; v?: any; s?: number };
export type CellValue = CellPrimitive | CellObject;

export type RowData = CellValue[] | { rs: number; c: CellValue[] };

export interface ChunkData {
  start: number;
  data: string; // JSON string of RowData[]
}

export interface ImportManifest {
  order: string[]; // array of tabIds
  formatVersion?: number;
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
    frozenCols?: number;
    styles?: StyleData[];
    rows: RowData[];
  }[];
}
