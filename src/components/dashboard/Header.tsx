
'use client';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Logo } from "../Logo";
import Link from "next/link";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Languages, LogOut, UserRound } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ScrollArea } from "../ui/scroll-area";
import { useAuth } from '@/hooks/useAuth';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी (Hindi)' },
    { code: 'as', name: 'অসমীয়া (Assamese)' },
    { code: 'bn', name: 'বাংলা (Bengali)' },
    { code: 'brx', name: 'बोड़ो (Bodo)' },
    { code: 'dgo', name: 'डोगरी (Dogri)' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
    { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ks', name: 'कश्मीरी (Kashmiri)' },
    { code: 'kok', name: 'कोंकणी (Konkani)' },
    { code: 'mai', name: 'मैथिली (Maithili)' },
    { code: 'ml', name: 'മലയാളം (Malayalam)' },
    { code: 'mni', name: 'মৈতৈলোন্ (Manipuri)' },
    { code: 'mr', name: 'मराठी (Marathi)' },
    { code: 'ne', name: 'नेपाली (Nepali)' },
    { code: 'or', name: 'ଓଡ଼ିଆ (Odia)' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: 'sa', name: 'संस्कृतम् (Sanskrit)' },
    { code: 'sat', name: 'संताली (Santali)' },
    { code: 'sd', name: 'सिन्धी (Sindhi)' },
    { code: 'ta', name: 'தமிழ் (Tamil)' },
    { code: 'te', name: 'తెలుగు (Telugu)' },
    { code: 'ur', name: 'اردو (Urdu)' },
];


export function Header() {
  const { setLanguage } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push('/auth');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
        <SidebarTrigger className="md:hidden" />
        <div className="hidden md:block">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <div className="flex-1">
            {/* Can add a global search bar here in the future */}
        </div>
        
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Languages className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <ScrollArea className="h-72">
                    {languages.map((lang) => (
                        <DropdownMenuItem key={lang.code} onClick={() => setLanguage(lang.code as any)}>
                            {lang.name}
                        </DropdownMenuItem>
                    ))}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <UserRound className="h-5 w-5" />
              <span className="hidden max-w-36 truncate sm:inline">{user?.displayName || 'Account'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="border-b px-2 py-2">
              <p className="truncate text-sm font-medium">{user?.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

    </header>
  );
}
