const fs = require('fs');
let content = fs.readFileSync('src/components/Grid.tsx', 'utf8');

// Add selection state
const stateRepl = `
  const [activeCell, setActiveCell] = useState<{ row: number, col: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ row: number, col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number, col: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
`;
content = content.replace(/const \[activeCell, setActiveCell\] = useState<\{ row: number, col: number \} \| null>\(null\);/, stateRepl);

// Extract selection bounds
const boundsRepl = `
  const selectionBounds = useMemo(() => {
    if (!activeCell) return null;
    let r1 = activeCell.row;
    let c1 = activeCell.col;
    let r2 = activeCell.row;
    let c2 = activeCell.col;
    
    if (selectionStart && selectionEnd) {
      r1 = Math.min(selectionStart.row, selectionEnd.row);
      r2 = Math.max(selectionStart.row, selectionEnd.row);
      c1 = Math.min(selectionStart.col, selectionEnd.col);
      c2 = Math.max(selectionStart.col, selectionEnd.col);
    }
    return { r1, c1, r2, c2 };
  }, [activeCell, selectionStart, selectionEnd]);

  const isCellSelected = useCallback((r: number, c: number) => {
    if (!selectionBounds) return false;
    return r >= selectionBounds.r1 && r <= selectionBounds.r2 && c >= selectionBounds.c1 && c <= selectionBounds.c2;
  }, [selectionBounds]);

  const handlePointerDown = useCallback((e: React.PointerEvent, r: number, c: number) => {
    if (e.shiftKey && activeCell) {
       setSelectionStart(activeCell);
       setSelectionEnd({row: r, col: c});
       e.preventDefault();
    } else {
       setActiveCell({row: r, col: c});
       setSelectionStart({row: r, col: c});
       setSelectionEnd({row: r, col: c});
       setIsSelecting(true);
       if (isEditing) saveEdit();
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, [activeCell, isEditing, saveEdit]);

  const handlePointerEnter = useCallback((e: React.PointerEvent, r: number, c: number) => {
    if (isSelecting) {
       setSelectionEnd({row: r, col: c});
    }
  }, [isSelecting]);

  const handlePointerUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  useEffect(() => {
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerUp]);
`;

content = content.replace(/const handleScroll = useCallback\(\(e: React.UIEvent<HTMLDivElement>\) => \{/, boundsRepl + "\n  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {");

// Change Cell invocation
const cellMapRepl = `
                    const { value, styleIndex } = getCellValueAndStyle(sheetMatrix[r], c);
                    const cellStyle = styleIndex !== undefined ? sheet.styles?.[styleIndex] : undefined;
                    const isSelected = isCellSelected(r, c);
                    return (
                      <td 
                        key={c}
                        className="p-0 border-0"
                        onPointerDown={(e) => handlePointerDown(e, r, c)}
                        onPointerEnter={(e) => handlePointerEnter(e, r, c)}
                      >
                      <Cell
                        r={r}
                        c={c}
                        sheetId={sheetId}
                        hf={hf}
                        hfVersion={hfVersion}
                        rawVal={value}
                        cellStyle={cellStyle}
                        rowSpan={merge?.rowSpan}
                        colSpan={merge?.colSpan}
                        isActive={isActive}
                        isEditing={isActive && isEditing}
                        editValue={isActive ? editValue : ''}
                        setEditValue={handleSetEditValue}
                        saveEdit={saveEdit}
                        startEdit={startEdit}
                        setActiveCell={setCell}
                        isSelected={isSelected}
                      />
                      </td>
`;
// Wait, the previous cell mapping was returning <Cell directly.
content = content.replace(/return \([\s\S]*?<Cell[\s\S]*?setActiveCell=\{setCell\}\n\s*\/>\n\s*\);/g, cellMapRepl);

fs.writeFileSync('src/components/Grid.tsx', content);
