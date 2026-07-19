const fs = require('fs');
let content = fs.readFileSync('src/components/Cell.tsx', 'utf8');

// add isSelected, onPointerDown, onPointerEnter
content = content.replace(/isActive: boolean;/, "isActive: boolean;\n  isSelected?: boolean;\n  onPointerDown?: (e: React.PointerEvent) => void;\n  onPointerEnter?: (e: React.PointerEvent) => void;");

content = content.replace(/isActive, isEditing, editValue,/, "isActive, isSelected, isEditing, editValue, onPointerDown, onPointerEnter,");

content = content.replace(/<td \n      rowSpan=\{rowSpan\}\n      colSpan=\{colSpan\}/, `<td \n      rowSpan={rowSpan}\n      colSpan={colSpan}\n      onPointerDown={onPointerDown}\n      onPointerEnter={onPointerEnter}`);

// Add selection styling
content = content.replace(/className=\{\`border-b border-r/, "className={`border-b border-r ${isSelected ? 'bg-blue-100/50 mix-blend-multiply' : ''} ");

fs.writeFileSync('src/components/Cell.tsx', content);

// Now fix Grid.tsx to pass them instead of wrapping in <td>
let gridContent = fs.readFileSync('src/components/Grid.tsx', 'utf8');
gridContent = gridContent.replace(/<td[\s\S]*?onPointerEnter=\{.*?\}\n\s*>/g, "");
gridContent = gridContent.replace(/<\/td>\n\s*$/gm, ""); // This might be dangerous, let's just do an exact match.

// Wait, I can just rewrite Grid.tsx cell map
const cellMapRepl = `
                    const { value, styleIndex } = getCellValueAndStyle(sheetMatrix[r], c);
                    const cellStyle = styleIndex !== undefined ? sheet.styles?.[styleIndex] : undefined;
                    const isSelected = isCellSelected(r, c);
                    return (
                      <Cell
                        key={c}
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
                        isSelected={isSelected}
                        isEditing={isActive && isEditing}
                        editValue={isActive ? editValue : ''}
                        setEditValue={handleSetEditValue}
                        saveEdit={saveEdit}
                        startEdit={startEdit}
                        setActiveCell={setCell}
                        onPointerDown={(e) => handlePointerDown(e, r, c)}
                        onPointerEnter={(e) => handlePointerEnter(e, r, c)}
                      />
                    );
`;
gridContent = gridContent.replace(/return \([\s\S]*?isSelected=\{isSelected\}\n\s*\/>\n\s*<\/td>\n\s*\);/g, cellMapRepl);
fs.writeFileSync('src/components/Grid.tsx', gridContent);

