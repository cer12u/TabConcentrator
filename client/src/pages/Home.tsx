import { useState } from "react";
import Header from "@/components/Header";
import BookmarkInput from "@/components/BookmarkInput";
import BookmarkCard, { type Bookmark } from "@/components/BookmarkCard";
import EmptyState from "@/components/EmptyState";
import LoginPage from "@/components/LoginPage";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string; avatar?: string } | undefined>();
  
  // todo: remove mock functionality
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([
    {
      id: '1',
      url: 'https://replit.com',
      title: 'Replit - Build software faster',
      thumbnail: 'https://via.placeholder.com/120x80/3b82f6/fff?text=Replit',
      notes: 'オンラインでコードを書けるプラットフォーム。すぐに開発を始められて便利。',
      favicon: 'https://via.placeholder.com/16x16/3b82f6/fff?text=R',
    },
    {
      id: '2',
      url: 'https://github.com',
      title: 'GitHub: Where the world builds software',
      thumbnail: 'https://via.placeholder.com/120x80/171717/fff?text=GitHub',
      notes: '',
      favicon: 'https://via.placeholder.com/16x16/171717/fff?text=G',
    },
    {
      id: '3',
      url: 'https://developer.mozilla.org',
      title: 'MDN Web Docs',
      thumbnail: 'https://via.placeholder.com/120x80/000/fff?text=MDN',
      notes: 'Web開発のリファレンス。いつもお世話になってます。',
      favicon: 'https://via.placeholder.com/16x16/000/fff?text=M',
    },
  ]);

  const handleLogin = (username: string, password: string) => {
    console.log("Login:", username, password);
    // todo: remove mock functionality
    setUser({ name: username, avatar: `https://via.placeholder.com/32/3b82f6/fff?text=${username.charAt(0)}` });
    setIsLoggedIn(true);
  };

  const handleRegister = (username: string, password: string) => {
    console.log("Register:", username, password);
    // todo: remove mock functionality
    setUser({ name: username, avatar: `https://via.placeholder.com/32/3b82f6/fff?text=${username.charAt(0)}` });
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    console.log("Logout");
    setIsLoggedIn(false);
    setUser(undefined);
  };

  const handleAddBookmark = (url: string) => {
    console.log("Adding bookmark:", url);
    // todo: remove mock functionality - Extract real metadata from URL
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      url,
      title: `New Bookmark - ${url}`,
      thumbnail: `https://via.placeholder.com/120x80/64748b/fff?text=New`,
      notes: '',
      favicon: `https://via.placeholder.com/16x16/64748b/fff?text=N`,
    };
    setBookmarks([newBookmark, ...bookmarks]);
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    console.log("Update notes:", id, notes);
    setBookmarks(bookmarks.map(b => b.id === id ? { ...b, notes } : b));
  };

  const handleDelete = (id: string) => {
    console.log("Delete bookmark:", id);
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={handleLogout} />
      
      <main className="max-w-4xl mx-auto px-4 py-4">
        <div className="space-y-3">
          <BookmarkInput onAddBookmark={handleAddBookmark} />
          
          {bookmarks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2" data-testid="bookmark-list">
              {bookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onUpdateNotes={handleUpdateNotes}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
