'use client';

import { Search, LogOut, User, Settings, MessageSquare, Users, Plus } from "lucide-react"
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
import { useState, useRef } from "react"

interface SearchResult {
  id: string;
  type: 'chat' | 'message' | 'participant';
  title: string;
  description: string;
  subtitle: string;
  actionUrl: string;
  relevance: number;
}

interface DashboardHeaderProps {
  onNewChat?: () => void;
}

export function DashboardHeader(props: DashboardHeaderProps = {}) {
  const { onNewChat } = props;
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Handle search with debouncing
  const handleSearch = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const getSearchIcon = (type: string) => {
    switch (type) {
      case 'chat': return <MessageSquare className="h-4 w-4 text-[#D8A7B1]" />;
      case 'message': return <MessageSquare className="h-4 w-4 text-[#7BAFB0]" />;
      case 'participant': return <Users className="h-4 w-4 text-[#D9C589]" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  return (
    <header className="border-b border-[#3C4858]/10 bg-white/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Image src="/images/komensa-logo.png" alt="Komensa" width={120} height={40} className="h-8 w-auto" />
            
            {/* Enhanced Search */}
            <div className="hidden md:flex ml-8 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#3C4858]/50" />
              <Input
                placeholder="Search chats, messages, people..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                onBlur={() => {
                  // Delay hiding to allow clicks on results
                  setTimeout(() => setShowSearchResults(false), 200);
                }}
                className="pl-10 w-80 bg-[#F9F7F4] border-[#3C4858]/10 focus-visible:ring-[#D8A7B1] transition-all duration-200"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#D8A7B1]"></div>
                </div>
              )}
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-[#3C4858]/10 rounded-lg shadow-lg mt-1 max-h-96 overflow-y-auto z-50">
                  <div className="p-2">
                    <div className="text-xs text-[#3C4858]/60 font-medium mb-2 px-2">
                      Search Results ({searchResults.length})
                    </div>
                    {searchResults.map((result) => (
                      <a
                        key={result.id}
                        href={result.actionUrl}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F9F7F4] transition-colors"
                        onMouseDown={() => setShowSearchResults(false)}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getSearchIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#3C4858] truncate" 
                               dangerouslySetInnerHTML={{ __html: result.title }} />
                          <div className="text-xs text-[#3C4858]/70 truncate">{result.description}</div>
                          <div className="text-xs text-[#3C4858]/50">{result.subtitle}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Actions */}
            <Button variant="ghost" size="sm" className="hidden lg:flex text-[#3C4858] hover:bg-[#D8A7B1]/10" onClick={onNewChat}>
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:block text-right">
                <div className="text-sm font-medium text-[#3C4858]">{displayName}</div>
                <div className="text-xs text-[#3C4858]/70">
                  {email ? email : 'Premium Plan'}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] flex items-center justify-center text-white font-medium hover:opacity-90 transition-all duration-200 hover:scale-105">
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
