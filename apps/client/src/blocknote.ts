import type { BlockNoteBlock, InlineContent } from "@app/shared";
import type { JSONContent } from "@tiptap/react";
import { v7 as uuidv7 } from "uuid";

const defaultProps = { backgroundColor: "default", textColor: "default", textAlignment: "left" };

function toInline(nodes: JSONContent[] = []): InlineContent[] {
  return nodes.flatMap((node): InlineContent[] => {
    if (node.type === "hardBreak") return [{ type: "text", text: "\n", styles: {} }];
    if (node.type !== "text") return [];
    const styles: Record<string, boolean | string | number> = {};
    let href: string | undefined;
    for (const mark of node.marks ?? []) {
      if (["bold", "italic", "underline", "strike", "code"].includes(mark.type!)) styles[mark.type!] = true;
      if (mark.type === "link") href = String(mark.attrs?.href ?? "");
    }
    const text = node.text ?? "";
    return href ? [{ type: "link", href, content: [{ type: "text", text, styles }] }] : [{ type: "text", text, styles }];
  });
}

function block(type: string, node: JSONContent, props: Record<string, unknown> = {}, children: BlockNoteBlock[] = []): BlockNoteBlock {
  return { id: uuidv7(), type, props: { ...defaultProps, ...props }, content: toInline(node.content), children };
}

function convertNode(node: JSONContent): BlockNoteBlock[] {
  switch (node.type) {
    case "heading": return [block("heading", node, { level: Number(node.attrs?.level ?? 1) })];
    case "blockquote": return (node.content ?? []).map((child) => block("quote", child));
    case "codeBlock": return [block("codeBlock", node, { language: node.attrs?.language ?? "text" })];
    case "bulletList": return (node.content ?? []).map((item) => listItem("bulletListItem", item));
    case "orderedList": return (node.content ?? []).map((item) => listItem("numberedListItem", item));
    default: return [block("paragraph", node)];
  }
}

function listItem(type: string, item: JSONContent): BlockNoteBlock {
  const [first, ...nested] = item.content ?? [];
  return block(type, first ?? { type: "paragraph" }, {}, nested.flatMap(convertNode));
}

export function tiptapToBlockNote(doc: JSONContent): BlockNoteBlock[] {
  const blocks = (doc.content ?? []).flatMap(convertNode);
  return blocks.length ? blocks : [block("paragraph", { type: "paragraph" })];
}

function marksFromStyles(styles: Record<string, unknown>) {
  return Object.entries(styles).filter(([, active]) => active === true).map(([type]) => ({ type }));
}

function fromInline(content: BlockNoteBlock["content"]): JSONContent[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((item): JSONContent[] => {
    if (item.type === "link") return item.content.map((text) => ({ type: "text", text: text.text, marks: [...marksFromStyles(text.styles), { type: "link", attrs: { href: item.href } }] }));
    return [{ type: "text", text: item.text, marks: marksFromStyles(item.styles) }];
  });
}

function paragraph(block: BlockNoteBlock): JSONContent { return { type: "paragraph", content: fromInline(block.content) }; }

function fromBlock(block: BlockNoteBlock): JSONContent {
  if (block.type === "heading") return { type: "heading", attrs: { level: Number(block.props.level ?? 1) }, content: fromInline(block.content) };
  if (block.type === "quote") return { type: "blockquote", content: [paragraph(block)] };
  if (block.type === "codeBlock") return { type: "codeBlock", attrs: { language: block.props.language ?? null }, content: fromInline(block.content) };
  if (["bulletListItem", "numberedListItem"].includes(block.type)) {
    return { type: block.type === "bulletListItem" ? "bulletList" : "orderedList", content: [{ type: "listItem", content: [paragraph(block), ...block.children.map(fromBlock)] }] };
  }
  return paragraph(block);
}

export function blockNoteToTiptap(blocks: BlockNoteBlock[]): JSONContent {
  const content: JSONContent[] = [];
  for (const current of blocks) {
    const converted = fromBlock(current);
    const previous = content.at(-1);
    if ((converted.type === "bulletList" || converted.type === "orderedList") && previous?.type === converted.type) previous.content?.push(...(converted.content ?? []));
    else content.push(converted);
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
