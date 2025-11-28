import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bookmark, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, ApiError } from "@/lib/queryClient";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [code, setCode] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("メールアドレスが確認されました");
  const [resolvedUsername, setResolvedUsername] = useState("");

  useEffect(() => {
    const urlCode = params.get("code") || "";
    const urlIdentifier = params.get("username") || params.get("email") || "";

    if (urlCode) setCode(urlCode);
    if (urlIdentifier) setIdentifier(urlIdentifier);
  }, [params]);

  const submitConfirmation = useCallback(
    async (payload: { code: string; username?: string; email?: string }) => {
      setIsSubmitting(true);
      setErrorMessage("");
      setIsSuccess(false);
      try {
        const res = await apiRequest("POST", "/api/auth/verify-email", payload);
        const data = await res.json();
        setIsSuccess(true);
        setResolvedUsername(data.username || payload.username || payload.email || "");
        setSuccessMessage(data.message || "メールアドレスが確認されました");
      } catch (error: unknown) {
        const message = error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "メール確認に失敗しました";
        setErrorMessage(message || "メール確認に失敗しました");
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  useEffect(() => {
    const urlCode = params.get("code");
    const urlIdentifier = params.get("username") || params.get("email");

    if (urlCode && urlIdentifier) {
      const payload: { code: string; username?: string; email?: string } = { code: urlCode };
      if (urlIdentifier.includes("@")) {
        payload.email = urlIdentifier;
      } else {
        payload.username = urlIdentifier;
      }
      submitConfirmation(payload);
    }
  }, [params, submitConfirmation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMessage("確認コードを入力してください");
      return;
    }
    if (!identifier.trim()) {
      setErrorMessage("ユーザー名またはメールアドレスを入力してください");
      return;
    }

    const payload: { code: string; username?: string; email?: string } = { code: code.trim() };
    if (identifier.includes("@")) {
      payload.email = identifier.trim();
    } else {
      payload.username = identifier.trim();
    }

    await submitConfirmation(payload);
  };

  const checkLoginStatus = async () => {
    setIsCheckingStatus(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/auth/verify-email`, { credentials: "include" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "ログインしていません");
      }

      setIsSuccess(data.emailVerified === true);
      setResolvedUsername(data.username || "");
      setSuccessMessage(data.message || "メールアドレスが確認されました");
      if (data.emailVerified !== true) {
        setErrorMessage("確認コードを入力してください");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "メール確認に失敗しました");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const goToLogin = () => {
    setLocation("/login");
  };

  const isProcessing = isSubmitting || isCheckingStatus;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-none border">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className={`rounded-sm p-3 ${isSuccess ? "bg-primary/10" : "bg-destructive/10"}`}>
              {isProcessing ? (
                <Bookmark className="h-8 w-8 text-primary animate-pulse" />
              ) : isSuccess ? (
                <CheckCircle className="h-8 w-8 text-primary" />
              ) : (
                <XCircle className="h-8 w-8 text-destructive" />
              )}
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">メール確認</CardTitle>
            <CardDescription className="mt-2">
              受信した確認コードを入力し、メールアドレスを有効化してください
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
              <p className="text-sm text-destructive text-center" data-testid="text-error-message">
                {errorMessage}
              </p>
            </div>
          )}
          {isSuccess && !errorMessage && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-sm">
              <p className="text-sm text-primary text-center" data-testid="text-success-message">
                {resolvedUsername ? `${resolvedUsername}さん、${successMessage}` : successMessage}
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">確認コード</Label>
              <Input
                id="code"
                type="text"
                placeholder="メールに記載の6桁コード"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                data-testid="input-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identifier">ユーザー名またはメールアドレス</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="username または email@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                data-testid="input-identifier"
              />
            </div>
            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={isProcessing} data-testid="button-submit-code">
                {isSubmitting ? "送信中..." : "確認する"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={checkLoginStatus}
                disabled={isProcessing}
              >
                {isCheckingStatus ? "確認中..." : "ログイン済みで確認"}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={goToLogin} className="w-full" variant="ghost" data-testid="button-go-home">
            ログイン画面に進む
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
