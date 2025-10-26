import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit2, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import BookmarkInput from "@/components/BookmarkInput";
import BookmarkCard from "@/components/BookmarkCard";
import EmptyState from "@/components/EmptyState";
import LoginPage from "@/components/LoginPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Bookmark, Collection } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>("all");
  const [isNewCollectionDialogOpen, setIsNewCollectionDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

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
      } catch (error: any) {
        const errorText = await error.message || "ログインに失敗しました";
        throw new Error(errorText.includes("401") ? "ユーザー名またはパスワードが正しくありません" : errorText);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      try {
        const res = await apiRequest("POST", "/api/auth/register", { username, password });
        return res.json();
      } catch (error: any) {
        const errorText = await error.message || "登録に失敗しました";
        throw new Error(errorText.includes("400") && errorText.includes("使用されています") ? "ユーザー名は既に使用されています" : errorText);
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
      setNewCollectionName("");
      setIsNewCollectionDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.error || "コレクションの作成に失敗しました",
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
      setSelectedCollectionId("all");
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
        collectionId: selectedCollectionId === "all" ? null : selectedCollectionId,
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
    mutationFn: async ({ id, memo, favicon }: { id: string; memo?: string; favicon?: string }) => {
      const res = await apiRequest("PATCH", `/api/bookmarks/${id}`, { memo, favicon });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "エラー",
        description: error.error || "ブックマークの更新に失敗しました",
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

  const handleRegister = async (username: string, password: string) => {
    return new Promise<void>((resolve, reject) => {
      registerMutation.mutate(
        { username, password },
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

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      createCollectionMutation.mutate(newCollectionName.trim());
    }
  };

  const handleDeleteCollection = (id: string) => {
    deleteCollectionMutation.mutate(id);
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
          <Tabs value={selectedCollectionId || "all"} onValueChange={(value) => setSelectedCollectionId(value)} className="w-full">
            <div className="flex items-center gap-2 mb-3">
              <TabsList className="flex-1">
                <TabsTrigger value="all" data-testid="tab-all">すべて</TabsTrigger>
                {collections.map((collection) => (
                  <TabsTrigger key={collection.id} value={collection.id} data-testid={`tab-collection-${collection.id}`}>
                    <span>{collection.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 ml-1 hover-elevate"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCollection(collection.id);
                      }}
                      data-testid={`button-delete-collection-${collection.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <Dialog open={isNewCollectionDialogOpen} onOpenChange={setIsNewCollectionDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-new-collection">
                    <Plus className="h-4 w-4 mr-1" />
                    新規リスト
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新しいリスト</DialogTitle>
                    <DialogDescription>
                      新しいブックマークリストを作成します
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="collection-name">リスト名</Label>
                      <Input
                        id="collection-name"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        placeholder="例: 仕事用、趣味、学習"
                        data-testid="input-collection-name"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCreateCollection}
                      disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
                      data-testid="button-create-collection"
                    >
                      作成
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <TabsContent value={selectedCollectionId || "all"} className="mt-0">
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
    </div>
  );
}
