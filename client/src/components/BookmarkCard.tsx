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

  return (
    <Card className="p-6 hover-elevate" data-testid={`card-bookmark-${bookmark.id}`}>
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <img
            src={bookmark.thumbnail}
            alt={bookmark.title}
            className="w-[120px] h-[80px] object-cover rounded-md bg-muted"
            data-testid={`img-thumbnail-${bookmark.id}`}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium line-clamp-2 mb-1" data-testid={`text-title-${bookmark.id}`}>
            {bookmark.title}
          </h3>
          
          <div className="flex items-center gap-2 mb-3">
            {bookmark.favicon && (
              <img src={bookmark.favicon} alt="" className="w-4 h-4" />
            )}
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground hover:text-foreground truncate"
              data-testid={`link-url-${bookmark.id}`}
            >
              {bookmark.url}
            </a>
          </div>
          
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="メモを追加..."
                className="min-h-24 resize-none"
                autoFocus
                data-testid={`textarea-notes-${bookmark.id}`}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} data-testid={`button-save-${bookmark.id}`}>
                  <Save className="h-3 w-3 mr-2" />
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  data-testid={`button-cancel-${bookmark.id}`}
                >
                  <X className="h-3 w-3 mr-2" />
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <>
              {bookmark.notes && (
                <p className="text-sm text-foreground mb-3" data-testid={`text-notes-${bookmark.id}`}>
                  {bookmark.notes}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  data-testid={`button-edit-${bookmark.id}`}
                >
                  <Edit2 className="h-3 w-3 mr-2" />
                  {bookmark.notes ? "編集" : "メモを追加"}
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-delete-${bookmark.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      削除
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
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
