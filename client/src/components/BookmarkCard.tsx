import { useState } from "react";
import { Edit2, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  notes: string;
  favicon?: string;
}

interface BookmarkCardProps {
  bookmark: Bookmark;
  onUpdateNotes: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
}

function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

export default function BookmarkCard({ bookmark, onUpdateNotes, onDelete }: BookmarkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(bookmark.notes);

  const handleSave = () => {
    console.log("Saving notes for bookmark:", bookmark.id);
    onUpdateNotes(bookmark.id, notes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNotes(bookmark.notes);
    setIsEditing(false);
  };

  const handleDelete = () => {
    console.log("Deleting bookmark:", bookmark.id);
    onDelete(bookmark.id);
  };

  const domain = getDomain(bookmark.url);

  return (
    <Card className="p-2 hover-elevate" data-testid={`card-bookmark-${bookmark.id}`}>
      <div className="flex gap-2">
        <div className="flex-shrink-0">
          <img
            src={bookmark.thumbnail}
            alt={bookmark.title}
            className="w-[50px] h-[50px] object-cover rounded-md bg-muted"
            data-testid={`img-thumbnail-${bookmark.id}`}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:text-primary truncate"
                  data-testid={`text-title-${bookmark.id}`}
                >
                  {bookmark.title}
                </a>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {bookmark.favicon && (
                    <img src={bookmark.favicon} alt="" className="w-3 h-3" />
                  )}
                  <span
                    className="text-xs font-mono text-muted-foreground"
                    data-testid={`text-domain-${bookmark.id}`}
                  >
                    {domain}
                  </span>
                </div>
              </div>
              
              {isEditing ? (
                <div className="space-y-1.5 mt-1">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="メモを追加..."
                    className="min-h-[2.5rem] resize-none text-xs"
                    autoFocus
                    data-testid={`textarea-notes-${bookmark.id}`}
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={handleSave} data-testid={`button-save-${bookmark.id}`}>
                      <Save className="h-3 w-3 mr-1" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      data-testid={`button-cancel-${bookmark.id}`}
                    >
                      <X className="h-3 w-3 mr-1" />
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                bookmark.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5" data-testid={`text-notes-${bookmark.id}`}>
                    {bookmark.notes}
                  </p>
                )
              )}
            </div>
            
            <div className="flex gap-0.5 flex-shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setIsEditing(!isEditing)}
                data-testid={`button-edit-${bookmark.id}`}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    data-testid={`button-delete-${bookmark.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ブックマークを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作は取り消せません。このブックマークとメモが完全に削除されます。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid={`button-cancel-delete-${bookmark.id}`}>
                      キャンセル
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover-elevate"
                      data-testid={`button-confirm-delete-${bookmark.id}`}
                    >
                      削除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
