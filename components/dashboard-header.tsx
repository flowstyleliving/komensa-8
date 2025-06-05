'use client';

import { Bell, Search, LogOut, User, Settings } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { useSession, signOut } from "next-auth/react"

export function DashboardHeader() {
  const { data: session } = useSession();
  
  // Get user display name and initials
  const displayName = session?.user?.name || 'User';
  const email = session?.user?.email || '';
  
  // Generate initials from display name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const initials = getInitials(displayName);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <header className="border-b border-[#3C4858]/10 bg-white">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Image src="/images/komensa-logo.png" alt="Komensa" width={120} height={40} className="h-8 w-auto" />
            <div className="hidden md:flex ml-8 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#3C4858]/50" />
              <Input
                placeholder="Search..."
                className="pl-10 w-64 bg-[#F9F7F4] border-[#3C4858]/10 focus-visible:ring-[#D8A7B1]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-[#3C4858]" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-[#D8A7B1] rounded-full"></span>
            </Button>

            <div className="flex items-center space-x-3">
              <div className="hidden md:block text-right">
                <div className="text-sm font-medium text-[#3C4858]">{displayName}</div>
                <div className="text-xs text-[#3C4858]/70">
                  {email ? email : 'Premium Plan'}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] flex items-center justify-center text-white font-medium hover:opacity-90">
                    {initials}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div>
                      <div className="font-medium text-[#3C4858]">{displayName}</div>
                      <div className="text-xs text-[#3C4858]/70">{email}</div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[#3C4858] hover:bg-[#F9F7F4]">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-[#3C4858] hover:bg-[#F9F7F4]">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-[#3C4858] hover:bg-[#F9F7F4] cursor-pointer"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
