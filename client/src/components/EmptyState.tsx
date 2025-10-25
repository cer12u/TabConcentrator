import { Bookmark } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="text-center py-16" data-testid="empty-state">
      <Bookmark className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">ブックマークがありません</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        上のフィールドにURLを入力するか、ドラッグ&ドロップして最初のブックマークを追加しましょう
      </p>
    </div>
  );
}
