import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
  onRegister: (username: string, password: string) => void;
}

export default function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      setIsLoading(true);
      console.log("Login attempt:", username);
      onLogin(username, password);
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password && password === passwordConfirm) {
      setIsLoading(true);
      console.log("Register attempt:", username);
      onRegister(username, password);
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setUsername("");
    setPassword("");
    setPasswordConfirm("");
  };

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
            <CardTitle className="text-2xl font-bold">ブックマークマネージャー</CardTitle>
            <CardDescription className="mt-2">
              {isRegisterMode ? "アカウントを作成" : "ログインして開いているタブを整理しましょう"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={isRegisterMode ? handleRegisterSubmit : handleLoginSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">ユーザー名</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid={isRegisterMode ? "input-register-username" : "input-login-username"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid={isRegisterMode ? "input-register-password" : "input-login-password"}
              />
            </div>
            {isRegisterMode && (
              <div className="space-y-2">
                <Label htmlFor="password-confirm">パスワード（確認）</Label>
                <Input
                  id="password-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  data-testid="input-register-password-confirm"
                />
                {password && passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs text-destructive">パスワードが一致しません</p>
                )}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                !username ||
                !password ||
                (isRegisterMode && password !== passwordConfirm)
              }
              data-testid={isRegisterMode ? "button-register" : "button-login"}
            >
              {isLoading
                ? isRegisterMode
                  ? "登録中..."
                  : "ログイン中..."
                : isRegisterMode
                ? "新規登録"
                : "ログイン"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="link"
            onClick={toggleMode}
            className="text-sm"
            data-testid="button-toggle-mode"
          >
            {isRegisterMode ? "アカウントをお持ちの方はこちら" : "アカウントをお持ちでない方はこちら"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
