import { useState } from "react";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { Collection } from "@shared/schema";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: Collection[];
  defaultCollectionId: string | null;
  onCreateCollection: (name: string) => void;
  onUpdateCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onUpdateDefaultCollection: (id: string | null) => void;
}

export default function SettingsDialog({
  open,
  onOpenChange,
  collections,
  defaultCollectionId,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onUpdateDefaultCollection,
}: SettingsDialogProps) {
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleCreate = () => {
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim());
      setNewCollectionName("");
    }
  };

  const handleStartEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setEditingName(collection.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onUpdateCollection(editingId, editingName.trim());
      setEditingId(null);
      setEditingName("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = (id: string) => {
    onDeleteCollection(id);
    if (defaultCollectionId === id) {
      onUpdateDefaultCollection("all");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            コレクションの管理と初期表示タブの設定
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>初期表示タブ</Label>
            <Select
              value={defaultCollectionId || "all"}
              onValueChange={(value) => onUpdateDefaultCollection(value === "all" ? null : value)}
            >
              <SelectTrigger data-testid="select-default-tab">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>コレクション管理</Label>
            
            <div className="flex gap-2">
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="新しいコレクション名"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreate();
                  }
                }}
                data-testid="input-new-collection"
              />
              <Button onClick={handleCreate} disabled={!newCollectionName.trim()} data-testid="button-add-collection">
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>

            <div className="space-y-2">
              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  コレクションがありません
                </p>
              ) : (
                collections.map((collection) => (
                  <Card key={collection.id} data-testid={`collection-item-${collection.id}`}>
                    <CardContent className="p-3">
                      {editingId === collection.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit();
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                            data-testid={`input-edit-collection-${collection.id}`}
                          />
                          <Button size="sm" onClick={handleSaveEdit} data-testid={`button-save-collection-${collection.id}`}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit} data-testid={`button-cancel-edit-${collection.id}`}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{collection.name}</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEdit(collection)}
                              data-testid={`button-edit-collection-${collection.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(collection.id)}
                              data-testid={`button-delete-collection-${collection.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
