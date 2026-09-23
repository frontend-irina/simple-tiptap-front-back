import { z } from "zod";
import { MAX_BLOCK_DEPTH } from "./constants.js";

export { MAX_BLOCK_DEPTH } from "./constants.js";

export const inlineContentSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string(), styles: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])) }),
  z.object({ type: z.literal("link"), href: z.string(), content: z.array(z.object({ type: z.literal("text"), text: z.string(), styles: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])) })) })
]);

export type InlineContent = z.infer<typeof inlineContentSchema>;

export type BlockNoteBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: InlineContent[] | Record<string, unknown>;
  children: BlockNoteBlock[];
};

const storedBlockSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
  content: z.union([z.array(inlineContentSchema), z.record(z.string(), z.unknown())])
});

export const blockSchema: z.ZodType<BlockNoteBlock> = z.lazy(() => storedBlockSchema.extend({ children: z.array(blockSchema) }));

export const blockTreeSchema = z.array(blockSchema).superRefine((blocks, context) => {
  const visit = (items: BlockNoteBlock[], depth: number) => {
    for (const block of items) {
      if (depth > MAX_BLOCK_DEPTH) {
        context.addIssue({
          code: "custom",
          message: `Максимальная вложенность блоков — ${MAX_BLOCK_DEPTH} уровней`
        });
        return;
      }
      visit(block.children, depth + 1);
    }
  };
  visit(blocks, 1);
});

export const documentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  blocks: blockTreeSchema.refine((blocks) => blocks.length > 0, { message: "Заметка должна содержать хотя бы один блок" })
});

export const noteTitleSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

export type DocumentInput = z.infer<typeof documentInputSchema>;
export type DocumentRecord = DocumentInput & { id: string; createdAt: string; updatedAt: string };
export type DocumentSummary = Omit<DocumentRecord, "blocks">;

export type StoredBlock = Omit<BlockNoteBlock, "children">;

export const relativePositionSchema = z.object({
  before: z.string().uuid().nullable(),
  after: z.string().uuid().nullable()
});

export type RelativePosition = z.infer<typeof relativePositionSchema>;
export type FlatBlock = StoredBlock & { parentId: string | null; position: RelativePosition };
export type NoteResponse = Omit<DocumentRecord, "blocks"> & { blocks: FlatBlock[] };

export const blockOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), block: storedBlockSchema, parentId: z.string().uuid().nullable(), position: relativePositionSchema }),
  z.object({ type: z.literal("update"), blockId: z.string().uuid(), block: storedBlockSchema.omit({ id: true }) }),
  z.object({ type: z.literal("delete"), blockId: z.string().uuid() }),
  z.object({ type: z.literal("move"), blockId: z.string().uuid(), parentId: z.string().uuid().nullable(), position: relativePositionSchema })
]);

export const blockChangesSchema = z.object({
  clientMutationId: z.string().uuid(),
  operations: z.array(blockOperationSchema).min(1)
});

export const saveTransactionSchema = z.object({
  id: z.string().uuid(),
  operations: z.array(blockOperationSchema).min(1)
});

export const saveTransactionsSchema = z.object({
  transactions: z.array(saveTransactionSchema).min(1).max(100)
});

export type BlockOperation = z.infer<typeof blockOperationSchema>;
export type BlockChanges = z.infer<typeof blockChangesSchema>;
export type SaveTransaction = z.infer<typeof saveTransactionSchema>;
export type SaveTransactions = z.infer<typeof saveTransactionsSchema>;
