import type { BlockNoteBlock, FlatBlock } from "@app/shared";

export function treeToFlatBlocks(blocks: BlockNoteBlock[]): FlatBlock[] {
  const result: FlatBlock[] = [];
  const visit = (items: BlockNoteBlock[], parentId: string | null) => {
    items.forEach((block, index) => {
      const { children, ...stored } = block;
      result.push({
        ...stored,
        parentId,
        position: {
          before: items[index - 1]?.id ?? null,
          after: items[index + 1]?.id ?? null
        }
      });
      visit(children, block.id);
    });
  };
  visit(blocks, null);
  return result;
}
