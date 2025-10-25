import { useState, useRef } from "react";
import { Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface BookmarkInputProps {
  onAddBookmark: (url: string) => void;
}

export default function BookmarkInput({ onAddBookmark }: BookmarkInputProps) {
  const [url, setUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedUrl = e.dataTransfer.getData("text/plain");
    if (droppedUrl) {
      setUrl(droppedUrl);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      setIsAdding(true);
      console.log("Adding bookmark:", url);
      onAddBookmark(url);
      setTimeout(() => {
        setUrl("");
        setIsAdding(false);
      }, 500);
    }
  };

  const handleDropZoneClick = () => {
    inputRef.current?.focus();
  };

  return (
    <Card className="p-6">
      <div
        className={`border-2 border-dashed rounded-lg transition-all duration-200 ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleDropZoneClick}
      >
        <div className="p-8 text-center">
          <Link2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            URLをドラッグ&ドロップするか、下に入力してください
          </p>
          
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
                data-testid="input-bookmark-url"
              />
              <Button
                type="submit"
                disabled={!url.trim() || isAdding}
                data-testid="button-add-bookmark"
              >
                <Plus className="h-4 w-4 mr-2" />
                追加
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Card>
  );
}
