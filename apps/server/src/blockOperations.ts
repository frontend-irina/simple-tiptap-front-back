import type { BlockNoteBlock, BlockOperation, RelativePosition } from "@app/shared";

function locate(blocks: BlockNoteBlock[], blockId: string): { block: BlockNoteBlock; siblings: BlockNoteBlock[]; index: number } | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.id === blockId) return { block, siblings: blocks, index };
    const nested = locate(block.children, blockId);
    if (nested) return nested;
  }
  return null;
}

function destination(blocks: BlockNoteBlock[], parentId: string | null) {
  if (parentId === null) return blocks;
  const parent = locate(blocks, parentId)?.block;
  if (!parent) throw new Error(`Родительский блок ${parentId} не найден`);
  return parent.children;
}

function insertAt(blocks: BlockNoteBlock[], block: BlockNoteBlock, position: RelativePosition) {
  const beforeIndex = position.before === null ? -1 : blocks.findIndex((item) => item.id === position.before);
  const afterIndex = position.after === null ? -1 : blocks.findIndex((item) => item.id === position.after);

  if (position.before !== null && beforeIndex < 0) throw new Error(`Предыдущий блок ${position.before} не найден`);
  // `after` may point to a sibling created later in the same transaction.
  // `before` is the insertion anchor; `after` is a consistency hint.
  if (beforeIndex >= 0 && afterIndex >= 0 && beforeIndex + 1 !== afterIndex) {
    throw new Error("Блоки before и after не являются соседними");
  }

  // A null `before` is an explicit beginning-of-list anchor. Otherwise insert
  // directly after the preceding sibling; `after` verifies the other side.
  const index = position.before === null ? 0 : beforeIndex + 1;
  blocks.splice(index, 0, block);
}

export function applyBlockOperations(source: BlockNoteBlock[], operations: BlockOperation[]) {
  const blocks = structuredClone(source);

  for (const operation of operations) {
    if (operation.type === "create") {
      if (locate(blocks, operation.block.id)) throw new Error(`Блок ${operation.block.id} уже существует`);
      insertAt(destination(blocks, operation.parentId), { ...operation.block, children: [] }, operation.position);
      continue;
    }

    const current = locate(blocks, operation.blockId);
    if (operation.type === "delete") {
      if (current) current.siblings.splice(current.index, 1);
      continue;
    }
    if (!current) throw new Error(`Блок ${operation.blockId} не найден`);

    if (operation.type === "update") {
      Object.assign(current.block, operation.block);
      continue;
    }

    // MOVE preserves the block and its complete subtree. Removing it first also
    // prevents moving a block inside one of its own descendants.
    const [moving] = current.siblings.splice(current.index, 1);
    insertAt(destination(blocks, operation.parentId), moving, operation.position);
  }

  return blocks;
}
