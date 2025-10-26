import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bookmark, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setIsVerifying(false);
        setErrorMessage("無効な確認リンクです");
        return;
      }

      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          credentials: "include",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "メール確認に失敗しました");
        }

        setIsSuccess(true);
        setUsername(data.username || "");
      } catch (error: any) {
        setErrorMessage(error.message || "メール確認に失敗しました");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, []);

  const goToHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-none border">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className={`rounded-sm p-3 ${isSuccess ? "bg-primary/10" : "bg-destructive/10"}`}>
              {isVerifying ? (
                <Bookmark className="h-8 w-8 text-primary animate-pulse" />
              ) : isSuccess ? (
                <CheckCircle className="h-8 w-8 text-primary" />
              ) : (
                <XCircle className="h-8 w-8 text-destructive" />
              )}
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {isVerifying ? "確認中..." : isSuccess ? "確認完了" : "確認失敗"}
            </CardTitle>
            <CardDescription className="mt-2">
              {isVerifying
                ? "メールアドレスを確認しています"
                : isSuccess
                ? `${username}さん、メールアドレスが確認されました`
                : "メールアドレスの確認に失敗しました"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!isVerifying && !isSuccess && errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
              <p className="text-sm text-destructive text-center" data-testid="text-error-message">
                {errorMessage}
              </p>
            </div>
          )}
          {!isVerifying && isSuccess && (
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-sm">
              <p className="text-sm text-primary text-center" data-testid="text-success-message">
                ログインしてブックマークを管理しましょう
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {!isVerifying && (
            <Button onClick={goToHome} className="w-full" data-testid="button-go-home">
              ホームに戻る
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
