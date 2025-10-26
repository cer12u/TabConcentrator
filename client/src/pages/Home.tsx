import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import BookmarkInput from "@/components/BookmarkInput";
import BookmarkCard from "@/components/BookmarkCard";
import EmptyState from "@/components/EmptyState";
import LoginPage from "@/components/LoginPage";
import type { Bookmark } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();

  const { data: currentUser, isLoading: isCheckingAuth } = useQuery<{
    id: string;
    username: string;
  } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: bookmarks = [], isLoading: isLoadingBookmarks } = useQuery<Bookmark[]>({
    queryKey: ["/api/bookmarks"],
    enabled: !!currentUser,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "ログインエラー",
        description: error.error || "ログインに失敗しました",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", { username, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "登録エラー",
        description: error.error || "登録に失敗しました",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const createBookmarkMutation = useMutation({
    mutationFn: async (url: string) => {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const title = domain;
      
      const res = await apiRequest("POST", "/api/bookmarks", {
        url,
        title,
        domain,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        memo: "",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.error || "ブックマークの追加に失敗しました",
      });
    },
  });

  const updateBookmarkMutation = useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo: string }) => {
      const res = await apiRequest("PATCH", `/api/bookmarks/${id}`, { memo });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.error || "メモの更新に失敗しました",
      });
    },
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/bookmarks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.error || "ブックマークの削除に失敗しました",
      });
    },
  });

  const handleLogin = (username: string, password: string) => {
    loginMutation.mutate({ username, password });
  };

  const handleRegister = (username: string, password: string) => {
    registerMutation.mutate({ username, password });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleAddBookmark = (url: string) => {
    createBookmarkMutation.mutate(url);
  };

  const handleUpdateMemo = (id: string, memo: string) => {
    updateBookmarkMutation.mutate({ id, memo });
  };

  const handleDelete = (id: string) => {
    deleteBookmarkMutation.mutate(id);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={{ name: currentUser.username, avatar: `https://via.placeholder.com/32/3b82f6/fff?text=${currentUser.username.charAt(0).toUpperCase()}` }} 
        onLogout={handleLogout} 
      />
      
      <main className="max-w-4xl mx-auto px-4 py-4">
        <div className="space-y-3">
          <BookmarkInput onAddBookmark={handleAddBookmark} />
          
          {isLoadingBookmarks ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">読み込み中...</p>
            </div>
          ) : bookmarks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2" data-testid="bookmark-list">
              {bookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onUpdateMemo={handleUpdateMemo}
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
