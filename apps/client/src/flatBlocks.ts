import type { BlockNoteBlock, FlatBlock } from "@app/shared";
import { MAX_BLOCK_DEPTH } from "@app/shared/constants";

export function flatBlocksToTree(flatBlocks: FlatBlock[]): BlockNoteBlock[] {
  const blocks = new Map<string, BlockNoteBlock>();
  const roots: BlockNoteBlock[] = [];

  for (const flat of flatBlocks) {
    const { parentId: _parentId, position: _position, ...block } = flat;
    blocks.set(flat.id, { ...block, children: [] });
  }

  for (const flat of flatBlocks) {
    const block = blocks.get(flat.id)!;
    if (flat.parentId === null) roots.push(block);
    else {
      const parent = blocks.get(flat.parentId);
      if (!parent) throw new Error(`Родительский блок ${flat.parentId} не найден`);
      parent.children.push(block);
    }
  }

  const visited = new Set<string>();
  const validate = (items: BlockNoteBlock[], depth: number) => {
    for (const block of items) {
      if (depth > MAX_BLOCK_DEPTH) throw new Error(`Максимальная вложенность блоков — ${MAX_BLOCK_DEPTH} уровней`);
      if (visited.has(block.id)) throw new Error(`Обнаружена циклическая ссылка на блок ${block.id}`);
      visited.add(block.id);
      validate(block.children, depth + 1);
    }
  };
  validate(roots, 1);
  if (visited.size !== flatBlocks.length) throw new Error("Не все блоки связаны с корнем заметки: проверьте parentId");

  return roots;
}
