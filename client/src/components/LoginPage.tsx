import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { PASSWORD_MIN_LENGTH, USERNAME_MIN_LENGTH } from "@shared/constants";

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, email: string, password: string) => Promise<void>;
}

export default function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim();

  const isRegisterFormInvalid = isRegisterMode && (
    trimmedUsername.length < USERNAME_MIN_LENGTH ||
    !trimmedEmail ||
    password.length < PASSWORD_MIN_LENGTH ||
    password !== passwordConfirm
  );

  const isLoginFormInvalid = !isRegisterMode && (!trimmedUsername || !password);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedUsername || !password) {
      setErrorMessage("ユーザー名とパスワードを入力してください");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await onLogin(trimmedUsername, password);
      setUsername(trimmedUsername);
    } catch (error: any) {
      setErrorMessage(error.message || "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (trimmedUsername.length < USERNAME_MIN_LENGTH) {
      setErrorMessage(`ユーザー名は${USERNAME_MIN_LENGTH}文字以上で入力してください`);
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage("メールアドレスを入力してください");
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(`パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`);
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("パスワードが一致しません");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await onRegister(trimmedUsername, trimmedEmail, password);
      setUsername(trimmedUsername);
      setEmail(trimmedEmail);
    } catch (error: any) {
      setErrorMessage(error.message || "登録に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedEmail) {
      setErrorMessage("メールアドレスを入力してください");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await apiRequest("POST", "/api/auth/request-password-reset", { email: trimmedEmail });
      const data = await res.json();
      setSuccessMessage(data.message || "リセットメールを送信しました（アカウントが存在する場合）");
      setEmail(trimmedEmail);
    } catch (error: any) {
      setErrorMessage(error.message || "リセットメールの送信に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setIsForgotPasswordMode(false);
    setUsername("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const showForgotPassword = () => {
    setIsForgotPasswordMode(true);
    setIsRegisterMode(false);
    setUsername("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const showLoginForm = () => {
    setIsForgotPasswordMode(false);
    setIsRegisterMode(false);
    setUsername("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setErrorMessage("");
    setSuccessMessage("");
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
              {isForgotPasswordMode 
                ? "パスワードをリセット" 
                : isRegisterMode 
                ? "アカウントを作成" 
                : "ログインして開いているタブを整理しましょう"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
              <p className="text-sm text-destructive" data-testid="text-error-message">{errorMessage}</p>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-sm">
              <p className="text-sm text-primary" data-testid="text-success-message">{successMessage}</p>
            </div>
          )}
          
          {isForgotPasswordMode ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-forgot-password-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !trimmedEmail}
                data-testid="button-forgot-password-submit"
              >
                {isLoading ? "送信中..." : "リセットメールを送信"}
              </Button>
            </form>
          ) : (
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
                  minLength={isRegisterMode ? USERNAME_MIN_LENGTH : undefined}
                  data-testid={isRegisterMode ? "input-register-username" : "input-login-username"}
                />
                {isRegisterMode &&
                  trimmedUsername.length > 0 &&
                  trimmedUsername.length < USERNAME_MIN_LENGTH && (
                    <p className="text-xs text-destructive">
                      {`ユーザー名は${USERNAME_MIN_LENGTH}文字以上で入力してください`}
                    </p>
                  )}
              </div>
              {isRegisterMode && (
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-register-email"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isRegisterMode ? PASSWORD_MIN_LENGTH : undefined}
                  data-testid={isRegisterMode ? "input-register-password" : "input-login-password"}
                />
                {isRegisterMode &&
                  password.length > 0 &&
                  password.length < PASSWORD_MIN_LENGTH && (
                    <p className="text-xs text-destructive">
                      {`パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`}
                    </p>
                  )}
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
                    minLength={PASSWORD_MIN_LENGTH}
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
                disabled={isLoading || isRegisterFormInvalid || isLoginFormInvalid}
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
              {!isRegisterMode && (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={showForgotPassword}
                    className="text-sm"
                    data-testid="button-show-forgot-password"
                  >
                    パスワードを忘れた場合
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {isForgotPasswordMode ? (
            <Button
              variant="ghost"
              onClick={showLoginForm}
              className="text-sm"
              data-testid="button-back-to-login"
            >
              ログイン画面に戻る
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={toggleMode}
              className="text-sm"
              data-testid="button-toggle-mode"
            >
              {isRegisterMode ? "アカウントをお持ちの方はこちら" : "アカウントをお持ちでない方はこちら"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
