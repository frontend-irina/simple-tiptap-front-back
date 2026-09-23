import type { BlockNoteBlock, BlockOperation, RelativePosition } from "@app/shared";

type IndexedBlock = {
  block: BlockNoteBlock;
  parentId: string | null;
  position: RelativePosition;
  positionIndex: number;
};

function indexBlocks(blocks: BlockNoteBlock[]) {
  const index = new Map<string, IndexedBlock>();
  const visit = (items: BlockNoteBlock[], parentId: string | null) => {
    items.forEach((block, position) => {
      index.set(block.id, {
        block,
        parentId,
        positionIndex: position,
        position: {
          before: items[position - 1]?.id ?? null,
          after: items[position + 1]?.id ?? null
        }
      });
      visit(block.children, block.id);
    });
  };
  visit(blocks, null);
  return index;
}

function persistedPart(block: BlockNoteBlock) {
  return { type: block.type, props: block.props, content: block.content };
}

function sameContent(left: BlockNoteBlock, right: BlockNoteBlock) {
  return JSON.stringify(persistedPart(left)) === JSON.stringify(persistedPart(right));
}

function stableSequence(ids: string[], before: Map<string, IndexedBlock>) {
  const tails: number[] = [];
  const previous = new Array<number>(ids.length).fill(-1);

  ids.forEach((id, index) => {
    const value = before.get(id)!.positionIndex;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (before.get(ids[tails[middle]])!.positionIndex < value) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[index] = tails[low - 1];
    tails[low] = index;
  });

  const stable = new Set<string>();
  let cursor = tails.at(-1) ?? -1;
  while (cursor >= 0) {
    stable.add(ids[cursor]);
    cursor = previous[cursor];
  }
  return stable;
}

export function diffBlocks(previous: BlockNoteBlock[], current: BlockNoteBlock[]): BlockOperation[] {
  const before = indexBlocks(previous);
  const after = indexBlocks(current);
  const operations: BlockOperation[] = [];
  const moved = new Set<string>();
  const currentSiblings = new Map<string | null, string[]>();

  for (const [blockId, next] of after) {
    const prior = before.get(blockId);
    if (!prior) continue;
    if (prior.parentId !== next.parentId) {
      moved.add(blockId);
      continue;
    }
    const siblings = currentSiblings.get(next.parentId) ?? [];
    siblings.push(blockId);
    currentSiblings.set(next.parentId, siblings);
  }

  for (const siblingIds of currentSiblings.values()) {
    const stable = stableSequence(siblingIds, before);
    for (const blockId of siblingIds) if (!stable.has(blockId)) moved.add(blockId);
  }

  for (const [blockId] of before) {
    if (!after.has(blockId)) operations.push({ type: "delete", blockId });
  }

  for (const [blockId, next] of after) {
    const prior = before.get(blockId);
    if (!prior) {
      const { children: _children, ...block } = next.block;
      operations.push({ type: "create", block, parentId: next.parentId, position: next.position });
      continue;
    }
    if (!sameContent(prior.block, next.block)) {
      operations.push({ type: "update", blockId, block: persistedPart(next.block) });
    }
    if (moved.has(blockId)) {
      operations.push({ type: "move", blockId, parentId: next.parentId, position: next.position });
    }
  }

  return operations;
}
