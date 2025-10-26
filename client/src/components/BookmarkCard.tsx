import { useState } from "react";
import { Edit2, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import FaviconInput from "@/components/FaviconInput";
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
import type { Bookmark } from "@shared/schema";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onUpdateMemo: (id: string, memo: string) => void;
  onUpdateFavicon: (id: string, favicon: string) => void;
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

export default function BookmarkCard({ bookmark, onUpdateMemo, onUpdateFavicon, onDelete }: BookmarkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [memo, setMemo] = useState(bookmark.memo || '');
  const [favicon, setFavicon] = useState(bookmark.favicon || '');

  const handleSave = () => {
    console.log("Saving memo for bookmark:", bookmark.id);
    onUpdateMemo(bookmark.id, memo);
    if (favicon !== (bookmark.favicon || '')) {
      onUpdateFavicon(bookmark.id, favicon);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setMemo(bookmark.memo || '');
    setFavicon(bookmark.favicon || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    console.log("Deleting bookmark:", bookmark.id);
    onDelete(bookmark.id);
  };

  const thumbnailUrl = bookmark.favicon || `https://via.placeholder.com/70x70/64748b/fff?text=${encodeURIComponent(bookmark.domain.charAt(0).toUpperCase())}`;

  return (
    <Card className="p-2 shadow-none border" data-testid={`card-bookmark-${bookmark.id}`}>
      <div className="flex gap-2">
        <div className="flex-shrink-0">
          <img
            src={thumbnailUrl}
            alt={bookmark.title}
            className="w-[70px] h-[70px] object-cover rounded-sm bg-muted"
            data-testid={`img-thumbnail-${bookmark.id}`}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
                    {bookmark.domain}
                  </span>
                </div>
              </div>
              
              {isEditing ? (
                <div className="space-y-1.5 mt-1">
                  <FaviconInput
                    value={favicon}
                    onChange={setFavicon}
                    bookmarkId={bookmark.id}
                  />
                  <Textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="メモを追加..."
                    className="h-[3.375rem] resize-none text-xs rounded-sm leading-[1.125rem]"
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
                <div className="h-[3.375rem] mt-0.5 overflow-hidden">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-[1.125rem]" data-testid={`text-notes-${bookmark.id}`}>
                    {bookmark.memo || ''}
                  </p>
                </div>
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
