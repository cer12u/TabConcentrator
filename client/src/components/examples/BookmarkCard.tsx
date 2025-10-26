import BookmarkCard from '../BookmarkCard';
import type { Bookmark } from "@shared/schema";

const mockBookmark: Bookmark = {
  id: '1',
  userId: 'mock-user',
  collectionId: null,
  url: 'https://example.com',
  title: 'Example Website',
  domain: 'example.com',
  memo: 'これは便利なサンプルサイトです。デザインの参考にしています。',
  favicon: 'https://via.placeholder.com/16x16/3b82f6/fff?text=E',
  createdAt: new Date(),
};

export default function BookmarkCardExample() {
  const handleUpdateMemo = (id: string, memo: string) => {
    console.log('Update memo for', id, ':', memo);
  };

  const handleUpdateFavicon = (id: string, favicon: string) => {
    console.log('Update favicon for', id, ':', favicon);
  };

  const handleDelete = (id: string) => {
    console.log('Delete bookmark:', id);
  };

  return (
    <BookmarkCard
      bookmark={mockBookmark}
      onUpdateMemo={handleUpdateMemo}
      onUpdateFavicon={handleUpdateFavicon}
      onDelete={handleDelete}
    />
  );
}
