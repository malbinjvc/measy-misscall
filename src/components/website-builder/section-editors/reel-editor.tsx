"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ReelSectionConfig, ReelCard } from "@/types";
import { TextConfigEditor } from "../editors/text-config-editor";
import { MediaUploader } from "../editors/media-uploader";
import { OverlayEditor } from "../editors/overlay-editor";
import { createDefaultReelCard } from "../constants";

interface ReelEditorProps {
  section: ReelSectionConfig;
  onChange: (updates: Partial<ReelSectionConfig>) => void;
}

export function ReelEditor({ section, onChange }: ReelEditorProps) {
  const [openCard, setOpenCard] = useState<number | null>(null);

  const updateCard = (index: number, updates: Partial<ReelCard>) => {
    const cards = section.cards.map((card, i) =>
      i === index ? { ...card, ...updates } : card
    );
    onChange({ cards });
  };

  const addCard = () => {
    const newCard = createDefaultReelCard(section.cards.length);
    onChange({ cards: [...section.cards, newCard] });
    setOpenCard(section.cards.length);
  };

  const removeCard = (index: number) => {
    if (section.cards.length <= 1) return;
    const cards = section.cards.filter((_, i) => i !== index);
    onChange({ cards });
    setOpenCard(null);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Section Name</Label>
        <Input
          value={section.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 text-sm"
          placeholder="Section name"
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Cards ({section.cards.length})
        </h4>

        {section.cards.map((card, index) => {
          const isOpen = openCard === index;
          return (
            <div key={card.id} className="rounded-lg border">
              {/* Card header */}
              <button
                className={`flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                  isOpen ? "border-b bg-muted/30" : ""
                }`}
                onClick={() => setOpenCard(isOpen ? null : index)}
              >
                {/* Thumbnail */}
                <div className="w-8 h-12 rounded bg-gray-100 overflow-hidden shrink-0 border">
                  {card.mediaUrl ? (
                    card.mediaType === "video" ? (
                      <video src={card.mediaUrl} muted className="w-full h-full object-cover" />
                    ) : (
                      <img src={card.mediaUrl} alt="" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
                      {index + 1}
                    </div>
                  )}
                </div>

                <span className="text-sm font-medium flex-1">Card {index + 1}</span>
                {section.cards.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCard(index); }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove card"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {/* Card body */}
              {isOpen && (
                <div className="p-3 space-y-4">
                  {/* Live preview */}
                  <div className="space-y-1">
                    <Label className="text-xs">Preview</Label>
                    <div
                      className="relative w-full rounded-lg overflow-hidden border bg-black"
                      style={{ aspectRatio: "9/16", maxHeight: 280 }}
                    >
                      {card.mediaUrl ? (
                        card.mediaType === "video" ? (
                          <video
                            src={card.mediaUrl}
                            muted
                            loop
                            autoPlay
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={card.mediaUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
                          No media
                        </div>
                      )}

                      {/* Overlay */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundColor: card.overlay.color,
                          opacity: card.overlay.opacity,
                        }}
                      />

                      {/* Text overlay at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                        {card.headline.content && (
                          <p
                            style={{
                              fontFamily: `'${card.headline.fontFamily}', sans-serif`,
                              fontSize: Math.min(card.headline.fontSize * 0.5, 16),
                              fontWeight: card.headline.fontWeight,
                              color: card.headline.color,
                              textAlign: card.headline.alignment,
                              lineHeight: card.headline.lineHeight,
                            }}
                          >
                            {card.headline.content}
                          </p>
                        )}
                        {card.subtitle.content && (
                          <p
                            style={{
                              fontFamily: `'${card.subtitle.fontFamily}', sans-serif`,
                              fontSize: Math.min(card.subtitle.fontSize * 0.5, 12),
                              fontWeight: card.subtitle.fontWeight,
                              color: card.subtitle.color,
                              textAlign: card.subtitle.alignment,
                              lineHeight: card.subtitle.lineHeight,
                            }}
                          >
                            {card.subtitle.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <MediaUploader
                    label="Media"
                    mediaUrl={card.mediaUrl}
                    mediaType={card.mediaType}
                    onMediaChange={(url, type) => updateCard(index, { mediaUrl: url, mediaType: type })}
                  />

                  <TextConfigEditor
                    label="Headline"
                    value={card.headline}
                    onChange={(headline) => updateCard(index, { headline })}
                  />

                  <TextConfigEditor
                    label="Subtitle"
                    value={card.subtitle}
                    onChange={(subtitle) => updateCard(index, { subtitle })}
                  />

                  <OverlayEditor
                    value={card.overlay}
                    onChange={(overlay) => updateCard(index, { overlay })}
                  />
                </div>
              )}
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={addCard}
        >
          <Plus className="h-4 w-4" />
          Add Card
        </Button>
      </div>
    </div>
  );
}
