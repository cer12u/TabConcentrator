import BookmarkCard, { type Bookmark } from '../BookmarkCard';

const mockBookmark: Bookmark = {
  id: '1',
  url: 'https://example.com',
  title: 'Example Website - The Best Example Site on the Web',
  thumbnail: 'https://via.placeholder.com/120x80/e2e8f0/64748b?text=Example',
  notes: 'これは便利なサンプルサイトです。デザインの参考にしています。',
  favicon: 'https://via.placeholder.com/16x16/3b82f6/fff?text=E',
};

export default function BookmarkCardExample() {
  const handleUpdateNotes = (id: string, notes: string) => {
    console.log('Update notes for', id, ':', notes);
  };

  const handleDelete = (id: string) => {
    console.log('Delete bookmark:', id);
  };

  return (
    <BookmarkCard
      bookmark={mockBookmark}
      onUpdateNotes={handleUpdateNotes}
      onDelete={handleDelete}
    />
  );
}
