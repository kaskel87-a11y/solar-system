// v7.5.97: old save ids that used a borrowed name, rewritten on load. Shown names changed with them.
// Stored mission ids (halo-*) and crew flags stay; only the kit id below was a product name.
export function migrateSave(p) {
  if (!p || typeof p !== 'object') return p;
  const out = { ...p };
  if (p.equip && typeof p.equip === 'object') {
    out.equip = { ...p.equip };
    if (out.equip.kit === 'roadster') out.equip.kit = 'lowline';
  }
  if (Array.isArray(p.unlocks)) out.unlocks = p.unlocks.map(u => u === 'kit:roadster' ? 'kit:lowline' : u);
  return out;
}
