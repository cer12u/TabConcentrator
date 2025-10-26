import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bookmark, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      setErrorMessage("無効なリセットリンクです");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && confirmPassword && newPassword === confirmPassword) {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const csrfToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrf-token='))
          ?.split('=')[1];

        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || "",
          },
          body: JSON.stringify({ token, newPassword }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "パスワードのリセットに失敗しました");
        }
        setIsSuccess(true);
      } catch (error: any) {
        setErrorMessage(error.message || "パスワードのリセットに失敗しました");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const goToHome = () => {
    setLocation("/");
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-none border">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-sm bg-primary/10 p-3">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">リセット完了</CardTitle>
              <CardDescription className="mt-2">
                パスワードがリセットされました
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-sm">
              <p className="text-sm text-primary text-center" data-testid="text-success-message">
                新しいパスワードでログインできます
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={goToHome} className="w-full" data-testid="button-go-home">
              ログインする
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-none border">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-sm bg-primary/10 p-3">
              <Bookmark className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">パスワードをリセット</CardTitle>
            <CardDescription className="mt-2">
              新しいパスワードを設定してください
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
              <p className="text-sm text-destructive" data-testid="text-error-message">{errorMessage}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新しいパスワード</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                disabled={!token}
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">パスワード（確認）</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={!token}
                data-testid="input-confirm-password"
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">パスワードが一致しません</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                !token ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword
              }
              data-testid="button-reset-password"
            >
              {isLoading ? "リセット中..." : "パスワードをリセット"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="ghost"
            onClick={goToHome}
            className="text-sm"
            data-testid="button-back-to-home"
          >
            ログイン画面に戻る
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
