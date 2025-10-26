import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, resetCSRFToken, ApiError } from "@/lib/queryClient";
import { Settings } from "lucide-react";
import Header from "@/components/Header";
import BookmarkInput from "@/components/BookmarkInput";
import BookmarkCard from "@/components/BookmarkCard";
import EmptyState from "@/components/EmptyState";
import LoginPage from "@/components/LoginPage";
import SettingsDialog from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Bookmark, Collection } from "@shared/schema";

const DEFAULT_TAB_KEY = "bookmark-manager-default-tab";

export default function Home() {
  const { toast } = useToast();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [defaultCollectionId, setDefaultCollectionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const { data: collections = [], isLoading: isLoadingCollections } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(DEFAULT_TAB_KEY);
      const savedId = saved || "all";
      setDefaultCollectionId(savedId === "all" ? null : savedId);
      setSelectedCollectionId(savedId === "all" ? null : savedId);
    }
  }, [currentUser]);

  const { data: bookmarks = [], isLoading: isLoadingBookmarks } = useQuery<Bookmark[]>({
    queryKey: ["/api/bookmarks", selectedCollectionId],
    queryFn: async () => {
      const params = selectedCollectionId === "all" || selectedCollectionId === null 
        ? "" 
        : `?collectionId=${selectedCollectionId}`;
      const res = await fetch(`/api/bookmarks${params}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!currentUser,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      try {
        const res = await apiRequest("POST", "/api/auth/login", { username, password });
        return res.json();
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          if (error.status === 401) {
            throw new Error("ユーザー名またはパスワードが正しくありません");
          }
          throw new Error(error.message || "ログインに失敗しました");
        }

        if (error instanceof Error) {
          throw new Error(error.message || "ログインに失敗しました");
        }

        throw new Error("ログインに失敗しました");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, email, password }: { username: string; email: string; password: string }) => {
      try {
        const res = await apiRequest("POST", "/api/auth/register", { username, email, password });
        return res.json();
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          if (error.status === 400 && /使用されています/.test(error.message)) {
            throw new Error("ユーザー名またはメールアドレスは既に使用されています");
          }
          throw new Error(error.message || "登録に失敗しました");
        }

        if (error instanceof Error) {
          throw new Error(error.message || "登録に失敗しました");
        }

        throw new Error("登録に失敗しました");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      return res.json();
    },
    onSuccess: () => {
      resetCSRFToken();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/collections", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : undefined;
      toast({
        variant: "destructive",
        title: "エラー",
        description: message || "コレクションの作成に失敗しました",
      });
    },
  });

  const updateCollectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/collections/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : undefined;
      toast({
        variant: "destructive",
        title: "エラー",
        description: message || "コレクションの更新に失敗しました",
      });
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/collections/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
      setSelectedCollectionId(null);
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
        favicon: null,
        memo: "",
        collectionId: selectedCollectionId === "all" ? null : selectedCollectionId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : undefined;
      toast({
        variant: "destructive",
        title: "エラー",
        description: message || "ブックマークの追加に失敗しました",
      });
    },
  });

  const updateBookmarkMutation = useMutation({
    mutationFn: async ({ id, memo, favicon }: { id: string; memo?: string; favicon?: string }) => {
      const res = await apiRequest("PATCH", `/api/bookmarks/${id}`, { memo, favicon });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : undefined;
      toast({
        variant: "destructive",
        title: "エラー",
        description: message || "ブックマークの更新に失敗しました",
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
    onError: (error: unknown) => {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : undefined;
      toast({
        variant: "destructive",
        title: "エラー",
        description: message || "ブックマークの削除に失敗しました",
      });
    },
  });

  const handleLogin = async (username: string, password: string) => {
    return new Promise<void>((resolve, reject) => {
      loginMutation.mutate(
        { username, password },
        {
          onSuccess: () => resolve(),
          onError: (error: any) => reject(error),
        }
      );
    });
  };

  const handleRegister = async (username: string, email: string, password: string) => {
    return new Promise<void>((resolve, reject) => {
      registerMutation.mutate(
        { username, email, password },
        {
          onSuccess: () => resolve(),
          onError: (error: any) => reject(error),
        }
      );
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleAddBookmark = (url: string) => {
    createBookmarkMutation.mutate(url);
  };

  const handleUpdateBookmark = (id: string, memo?: string, favicon?: string) => {
    updateBookmarkMutation.mutate({ id, memo, favicon });
  };

  const handleDelete = (id: string) => {
    deleteBookmarkMutation.mutate(id);
  };

  const handleCreateCollection = (name: string) => {
    createCollectionMutation.mutate(name);
  };

  const handleUpdateCollection = (id: string, name: string) => {
    updateCollectionMutation.mutate({ id, name });
  };

  const handleDeleteCollection = (id: string) => {
    deleteCollectionMutation.mutate(id);
  };

  const handleUpdateDefaultCollection = (id: string | null) => {
    const saveValue = id || "all";
    localStorage.setItem(DEFAULT_TAB_KEY, saveValue);
    setDefaultCollectionId(id);
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
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-lg font-semibold">ブックマーク</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSettingsOpen(true)}
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4 mr-1" />
              設定
            </Button>
          </div>

          <Tabs value={selectedCollectionId || "all"} onValueChange={(value) => setSelectedCollectionId(value === "all" ? null : value)} className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-1">
              <TabsTrigger 
                value="all" 
                data-testid="tab-all"
                className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent pb-2"
              >
                すべて
              </TabsTrigger>
              {collections.map((collection) => (
                <TabsTrigger 
                  key={collection.id} 
                  value={collection.id} 
                  data-testid={`tab-collection-${collection.id}`}
                  className="data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent pb-2"
                >
                  {collection.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCollectionId || "all"} className="mt-3">
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
                        onUpdateMemo={(id, memo) => handleUpdateBookmark(id, memo, undefined)}
                        onUpdateFavicon={(id, favicon) => handleUpdateBookmark(id, undefined, favicon)}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        collections={collections}
        defaultCollectionId={defaultCollectionId}
        onCreateCollection={handleCreateCollection}
        onUpdateCollection={handleUpdateCollection}
        onDeleteCollection={handleDeleteCollection}
        onUpdateDefaultCollection={handleUpdateDefaultCollection}
      />
    </div>
  );
}
