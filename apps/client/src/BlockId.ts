import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { v7 as uuidv7 } from "uuid";

const blockNodeTypes = ["paragraph", "heading", "blockquote", "codeBlock", "listItem"];

export const BlockId = Extension.create({
  name: "blockId",
  addGlobalAttributes() {
    return [{
      types: blockNodeTypes,
      attributes: {
        blockId: {
          default: null,
          keepOnSplit: false,
          parseHTML: (element) => element.getAttribute("data-block-id"),
          renderHTML: (attributes) => attributes.blockId ? { "data-block-id": attributes.blockId } : {}
        }
      }
    }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey("blockId"),
      appendTransaction: (_transactions, _oldState, newState) => {
        let transaction = newState.tr;
        let changed = false;
        const seen = new Set<string>();
        newState.doc.descendants((node, position) => {
          if (!blockNodeTypes.includes(node.type.name)) return;
          const currentId = typeof node.attrs.blockId === "string" ? node.attrs.blockId : null;
          if (currentId && !seen.has(currentId)) {
            seen.add(currentId);
            return;
          }
          const blockId = uuidv7();
          seen.add(blockId);
          transaction = transaction.setNodeMarkup(position, undefined, { ...node.attrs, blockId });
          changed = true;
        });
        return changed ? transaction : null;
      }
    })];
  }
});
