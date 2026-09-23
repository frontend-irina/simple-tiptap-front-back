import { useEffect } from "react";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { BlockNoteBlock } from "@app/shared";
import { blockNoteToTiptap, tiptapToBlockNote } from "./blocknote";
import { BlockId } from "./BlockId";

type Props = { blocks: BlockNoteBlock[]; onChange: (blocks: BlockNoteBlock[]) => void };

export function Editor({ blocks, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), BlockId],
    content: blockNoteToTiptap(blocks),
    editorProps: { attributes: { class: "editor-content" } },
    onUpdate: ({ editor }) => onChange(tiptapToBlockNote(editor.getJSON()))
  });

  useEffect(() => {
    if (editor && !editor.isFocused) editor.commands.setContent(blockNoteToTiptap(blocks), { emitUpdate: false });
  }, [editor, blocks]);

  if (!editor) return null;
  const link = () => {
    const url = window.prompt("Адрес ссылки", editor.getAttributes("link").href ?? "https://");
    if (url === null) return;
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return <div className="editor-shell">
    <div className="toolbar">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "active" : ""}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "active" : ""}><i>I</i></button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive("heading", { level: 2 }) ? "active" : ""}>H2</button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "active" : ""}>• Список</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive("orderedList") ? "active" : ""}>1. Список</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive("blockquote") ? "active" : ""}>Цитата</button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive("codeBlock") ? "active" : ""}>{"</>"}</button>
      <button onClick={link} className={editor.isActive("link") ? "active" : ""}>Ссылка</button>
    </div>
    <EditorContent editor={editor} />
  </div>;
}
