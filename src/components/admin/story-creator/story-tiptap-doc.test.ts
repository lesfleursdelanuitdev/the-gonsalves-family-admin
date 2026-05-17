import { describe, expect, it } from "vitest";
import { unwrapSingleCellTablesToParagraphContent } from "@/components/admin/story-creator/story-tiptap-doc";

describe("unwrapSingleCellTablesToParagraphContent", () => {
  it("unwraps one-cell pasted tables into normal story paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [
                    {
                      type: "paragraph",
                      attrs: { textAlign: null },
                      content: [
                        { type: "text", text: "A " },
                        { type: "text", marks: [{ type: "italic" }], text: "marked" },
                        { type: "text", text: " paragraph." },
                      ],
                    },
                    {
                      type: "paragraph",
                      attrs: { textAlign: "justify" },
                      content: [{ type: "text", text: "A second paragraph." }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { type: "paragraph", attrs: { textAlign: null } },
      ],
    };

    expect(unwrapSingleCellTablesToParagraphContent(doc)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            { type: "text", text: "A " },
            { type: "text", marks: [{ type: "italic" }], text: "marked" },
            { type: "text", text: " paragraph." },
          ],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "justify" },
          content: [{ type: "text", text: "A second paragraph." }],
        },
      ],
    });
  });

  it("keeps real multi-cell tables intact", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }] },
              ],
            },
          ],
        },
      ],
    };

    expect(unwrapSingleCellTablesToParagraphContent(doc)).toEqual(doc);
  });
});
