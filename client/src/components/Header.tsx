import { LogOut, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  user?: {
    name: string;
    avatar?: string;
  };
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">ブックマークマネージャー</h1>
          </div>
          
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="text-xs">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium hidden sm:inline">{user.name}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">ログアウト</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
