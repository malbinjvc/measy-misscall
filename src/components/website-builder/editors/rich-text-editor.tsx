"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef, useState, useCallback } from "react";
import { Bold, Italic, Underline as UnderlineIcon, Paintbrush, Highlighter, RemoveFormatting } from "lucide-react";
import { COLOR_PRESETS } from "../constants";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  multiline?: boolean;
}

function InlineColorPicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-background border rounded-md shadow-lg p-2 space-y-2"
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 h-7 rounded border px-1.5 text-xs font-mono bg-background"
          placeholder="#000000"
        />
      </div>
      <div className="flex flex-wrap gap-1 max-w-[160px]">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(preset);
            }}
            className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-110 transition-transform"
            style={{ backgroundColor: preset }}
            title={preset}
          />
        ))}
      </div>
    </div>
  );
}

export function RichTextEditor({ content, onChange, multiline }: RichTextEditorProps) {
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#facc15");
  const isInternalUpdate = useRef(false);
  const isReady = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        hardBreak: multiline ? {} : false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content,
    immediatelyRender: false,
    onCreate: () => {
      isReady.current = true;
    },
    onUpdate: ({ editor: ed }) => {
      if (!isReady.current) return;
      isInternalUpdate.current = true;
      onChangeRef.current(ed.getHTML());
    },
    editorProps: {
      handleKeyDown: multiline
        ? undefined
        : (_view, event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              return true;
            }
            return false;
          },
      attributes: {
        class: "prose-editor",
      },
    },
  });

  // Sync external content changes (e.g., undo at parent level)
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const currentHTML = editor.getHTML();
    if (currentHTML !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const handleTextColor = useCallback(
    (color: string) => {
      setTextColor(color);
      if (editor) {
        editor.chain().focus().setColor(color).run();
      }
    },
    [editor]
  );

  const handleHighlight = useCallback(
    (color: string) => {
      setHighlightColor(color);
      if (editor) {
        editor.chain().focus().toggleHighlight({ color }).run();
      }
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="space-y-1">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Text Color */}
        <div className="relative">
          <ToolbarButton
            active={showTextColor}
            onClick={() => {
              setShowTextColor(!showTextColor);
              setShowHighlight(false);
            }}
            title="Text Color"
          >
            <Paintbrush className="h-3.5 w-3.5" />
            <div className="w-3.5 h-0.5 rounded-full mt-px" style={{ backgroundColor: textColor }} />
          </ToolbarButton>
          {showTextColor && (
            <InlineColorPicker
              value={textColor}
              onChange={handleTextColor}
              onClose={() => setShowTextColor(false)}
            />
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <ToolbarButton
            active={showHighlight}
            onClick={() => {
              setShowHighlight(!showHighlight);
              setShowTextColor(false);
            }}
            title="Highlight"
          >
            <Highlighter className="h-3.5 w-3.5" />
            <div className="w-3.5 h-0.5 rounded-full mt-px" style={{ backgroundColor: highlightColor }} />
          </ToolbarButton>
          {showHighlight && (
            <InlineColorPicker
              value={highlightColor}
              onChange={handleHighlight}
              onClose={() => setShowHighlight(false)}
            />
          )}
        </div>

        <div className="w-px h-5 bg-border mx-0.5" />

        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="rounded-md border bg-background">
        <EditorContent editor={editor} />
      </div>

      {/* Minimal ProseMirror styles */}
      <style>{`
        .prose-editor {
          outline: none;
          padding: 6px 10px;
          min-height: ${multiline ? "72px" : "34px"};
          font-size: 14px;
          line-height: 1.5;
        }
        .prose-editor p {
          margin: 0;
        }
        .prose-editor mark {
          border-radius: 2px;
          padding: 0 1px;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // prevent editor blur
        onClick();
      }}
      title={title}
      className={`flex flex-col items-center justify-center p-1.5 rounded border text-xs transition-colors ${
        active ? "bg-primary text-white border-primary" : "bg-background hover:bg-muted border-transparent"
      }`}
    >
      {children}
    </button>
  );
}
