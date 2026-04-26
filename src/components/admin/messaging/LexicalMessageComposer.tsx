"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import {
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
  type EditorState,
} from "lexical";
import { useCallback, useEffect, type MutableRefObject } from "react";
import { cn } from "@/lib/utils";

function PlainTextGetterPlugin({ textGetterRef }: { textGetterRef: MutableRefObject<(() => string) | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    textGetterRef.current = () => {
      let text = "";
      editor.getEditorState().read(() => {
        text = $getRoot().getTextContent();
      });
      return text;
    };
    return () => {
      textGetterRef.current = null;
    };
  }, [editor, textGetterRef]);
  return null;
}

function EnterLineBreakPlugin({ onSubmitOnEnter }: { onSubmitOnEnter?: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onSubmitOnEnter) return;

    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event?.shiftKey) {
          event.preventDefault();
          editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, true);
          return true;
        }
        if (event) event.preventDefault();
        onSubmitOnEnter();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onSubmitOnEnter]);

  return null;
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}

function MessageChangePlugin({ onChangeText }: { onChangeText: (text: string) => void }) {
  const onChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        onChangeText($getRoot().getTextContent());
      });
    },
    [onChangeText],
  );
  return <OnChangePlugin onChange={onChange} />;
}

export type LexicalMessageComposerProps = {
  /** Bump to clear editor contents (e.g. after successful send). */
  resetKey?: number;
  placeholder?: string;
  onChangeText: (text: string) => void;
  /**
   * When set, exposes a function that reads the latest plain text from Lexical (for send handlers;
   * avoids stale React state vs editor content).
   */
  textGetterRef?: MutableRefObject<(() => string) | null>;
  /** When set, Enter sends (Shift+Enter inserts a line break). */
  onSubmitOnEnter?: () => void;
  disabled?: boolean;
  /** `compact` = thread reply strip; `tall` = new message body. */
  variant?: "compact" | "tall";
  className?: string;
  "aria-label"?: string;
};

const composerTheme = {
  paragraph: "m-0",
};

export function LexicalMessageComposer({
  resetKey = 0,
  placeholder = "Write a message…",
  onChangeText,
  textGetterRef,
  onSubmitOnEnter,
  disabled = false,
  variant = "compact",
  className,
  "aria-label": ariaLabel,
}: LexicalMessageComposerProps) {
  const initialConfig = {
    namespace: "AdminMessageComposer",
    theme: composerTheme,
    editable: !disabled,
    onError: (e: Error) => {
      console.error(e);
    },
  };

  const editableClass =
    variant === "tall"
      ? "min-h-[220px] max-h-[min(60vh,520px)] overflow-y-auto px-3 py-2 text-sm leading-relaxed"
      : "min-h-[40px] max-h-[120px] overflow-y-auto py-1.5 text-sm leading-relaxed";

  return (
    <LexicalComposer key={resetKey} initialConfig={initialConfig}>
      <div className={cn("relative flex-1 min-w-0", className)}>
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "w-full resize-none bg-transparent text-base-content outline-none focus:outline-none",
                editableClass,
              )}
              aria-label={ariaLabel ?? placeholder}
            />
          }
          placeholder={() => (
            <div
              className={cn(
                "pointer-events-none absolute select-none text-sm text-muted-foreground/50",
                variant === "tall" ? "left-3 top-2" : "left-0 top-1.5",
              )}
            >
              {placeholder}
            </div>
          )}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <EditablePlugin editable={!disabled} />
        <MessageChangePlugin onChangeText={onChangeText} />
        {textGetterRef ? <PlainTextGetterPlugin textGetterRef={textGetterRef} /> : null}
        {onSubmitOnEnter ? <EnterLineBreakPlugin onSubmitOnEnter={onSubmitOnEnter} /> : null}
      </div>
    </LexicalComposer>
  );
}
