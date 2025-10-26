import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FaviconInputProps {
  value: string;
  onChange: (value: string) => void;
  bookmarkId: string;
}

export default function FaviconInput({ value, onChange, bookmarkId }: FaviconInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      onChange(url);
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onChange(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onChange(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={`favicon-${bookmarkId}`} className="text-xs">
        アイコンURL（URLまたは画像をドロップ）
      </Label>
      <div
        className={`relative border-2 border-dashed rounded-sm transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Input
          id={`favicon-${bookmarkId}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... または画像をドロップ"
          className="h-8 text-xs rounded-sm border-0 pr-8"
          data-testid={`input-favicon-${bookmarkId}`}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover-elevate rounded-sm"
          data-testid={`button-upload-favicon-${bookmarkId}`}
        >
          <Upload className="h-3 w-3" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          data-testid={`input-file-favicon-${bookmarkId}`}
        />
      </div>
      {isDragging && (
        <p className="text-xs text-muted-foreground">画像またはURLをドロップ</p>
      )}
    </div>
  );
}
