import { z } from "zod";

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

export const blockSchema: z.ZodType<BlockNoteBlock> = z.lazy(() => z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
  content: z.union([z.array(inlineContentSchema), z.record(z.string(), z.unknown())]),
  children: z.array(blockSchema)
}));

export const documentInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  blocks: z.array(blockSchema).min(1)
});

export type DocumentInput = z.infer<typeof documentInputSchema>;
export type DocumentRecord = DocumentInput & { id: string; createdAt: string; updatedAt: string };
