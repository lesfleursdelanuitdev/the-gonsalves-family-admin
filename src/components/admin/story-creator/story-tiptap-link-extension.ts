import Link from "@tiptap/extension-link";

export const StoryLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      entityType: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-type"),
        renderHTML: (attributes) =>
          attributes.entityType ? { "data-entity-type": String(attributes.entityType) } : {},
      },
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-id"),
        renderHTML: (attributes) =>
          attributes.entityId ? { "data-entity-id": String(attributes.entityId) } : {},
      },
      entityXref: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-xref"),
        renderHTML: (attributes) =>
          attributes.entityXref ? { "data-entity-xref": String(attributes.entityXref) } : {},
      },
    };
  },
});
