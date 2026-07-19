const fs = require('fs');
let content = fs.readFileSync('src/components/Grid.tsx', 'utf8');

// Add props
content = content.replace(/targetRowIdx\?: number \| null;\n\}/, "targetRowIdx?: number | null;\n  onCellsEdit?: (updates: {r: number, c: number, v: any}[]) => void;\n  undo?: () => void;\n  redo?: () => void;\n}");
content = content.replace(/onCellEdit, targetRowIdx/, "onCellEdit, targetRowIdx, onCellsEdit, undo, redo");

// Update handleKeyDown
content = content.replace(/if \(e\.key === 'v' \|\| e\.key === 'V'\) \{ pasteFromClipboard\(\); return; \}/, "if (e.key === 'v' || e.key === 'V') { pasteFromClipboard(); return; }\n      if (e.key === 'z' || e.key === 'Z') { e.shiftKey ? redo?.() : undo?.(); return; }\n      if (e.key === 'y' || e.key === 'Y') { redo?.(); return; }");

// Update copyToClipboard cut
content = content.replace(/if \(cut\) \{\n       for \(let r = r1; r <= r2; r\+\+\) \{\n         for \(let c = c1; c <= c2; c\+\+\) \{\n           onCellEdit\(r, c, null\);\n         \}\n       \}\n    \}/, `if (cut) {
       if (onCellsEdit) {
         const updates = [];
         for (let r = r1; r <= r2; r++) {
           for (let c = c1; c <= c2; c++) {
             updates.push({r, c, v: null});
           }
         }
         onCellsEdit(updates);
       } else {
         for (let r = r1; r <= r2; r++) {
           for (let c = c1; c <= c2; c++) {
             onCellEdit(r, c, null);
           }
         }
       }
    }`);

// Update pasteFromClipboard
content = content.replace(/for\(let i=0; i<rows\.length; i\+\+\) \{\n        for\(let j=0; j<rows\[i\]\.length; j\+\+\) \{\n           let val = rows\[i\]\[j\];\n           if \(val\.startsWith\('"'\) && val\.endsWith\('"'\)\) \{\n             val = val\.slice\(1, -1\)\.replace\(\/""\/g, '"'\);\n           \}\n           onCellEdit\(activeCell\.row \+ i, activeCell\.col \+ j, val\);\n        \}\n      \}/, `
      const updates: {r: number, c: number, v: string}[] = [];
      for(let i=0; i<rows.length; i++) {
        for(let j=0; j<rows[i].length; j++) {
           let val = rows[i][j];
           if (val.startsWith('"') && val.endsWith('"')) {
             val = val.slice(1, -1).replace(/""/g, '"');
           }
           updates.push({r: activeCell.row + i, c: activeCell.col + j, v: val});
        }
      }
      if (onCellsEdit) onCellsEdit(updates);
      else updates.forEach(u => onCellEdit(u.r, u.c, u.v));
`);

fs.writeFileSync('src/components/Grid.tsx', content);
