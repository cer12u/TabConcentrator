import BookmarkInput from '../BookmarkInput';

export default function BookmarkInputExample() {
  const handleAddBookmark = (url: string) => {
    console.log('Bookmark added:', url);
  };

  return <BookmarkInput onAddBookmark={handleAddBookmark} />;
}
