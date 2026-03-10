"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";

interface MediaUploaderProps {
  label: string;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  onMediaChange: (url: string | null, type: "image" | "video") => void;
}

export function MediaUploader({ label, mediaUrl, mediaType, onMediaChange }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await new Promise<{ success: boolean; data?: { url: string; mediaType: "image" | "video" }; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            resolve(json);
          } catch {
            reject(new Error("Invalid response"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      if (data.success && data.data) {
        onMediaChange(data.data.url, data.data.mediaType);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {!mediaUrl ? (
        <div className="space-y-2">
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          >
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Click to upload</p>
              </>
            )}
          </div>
          {uploading && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={handleUpload}
            className="hidden"
          />
          <div className="flex gap-2">
            <select
              value={mediaType}
              onChange={(e) => onMediaChange(null, e.target.value as "image" | "video")}
              className="h-7 rounded border px-2 text-xs bg-background"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <Input
              placeholder="https://..."
              onChange={(e) => {
                if (e.target.value) onMediaChange(e.target.value, mediaType);
              }}
              className="h-7 text-xs flex-1"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative rounded border overflow-hidden bg-gray-100">
            {mediaType === "video" ? (
              <video src={mediaUrl} muted className="w-full h-24 object-cover" />
            ) : (
              <img src={mediaUrl} alt="" className="w-full h-24 object-cover" />
            )}
            <button
              onClick={() => onMediaChange(null, mediaType)}
              className="absolute top-1 right-1 bg-red-600 text-white p-0.5 rounded-full hover:bg-red-700"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground truncate">{mediaUrl}</p>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
