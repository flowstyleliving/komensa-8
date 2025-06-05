'use client';

import { Bell, Search, LogOut, User, Settings, MessageSquare, Users, Clock, CheckCircle, Mail, X, Zap, Plus, Check } from "lucide-react"
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
import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"

interface Notification {
  id: string;
  type: 'message' | 'invite' | 'completion' | 'turn';
  title: string;
  description: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl: string;
  unread: boolean;
}

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
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

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
      // Refresh notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [session?.user?.id]);

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAsRead) return;
    
    setIsMarkingAsRead(true);
    
    try {
      // Close dropdown first to prevent DOM conflicts
      setIsNotificationsOpen(false);
      
      // Small delay to allow dropdown to close
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'mark_all_read'
        })
      });

      if (response.ok) {
        // Update local state immediately for better UX
        setNotifications(prev => prev.map(notification => ({
          ...notification,
          unread: false
        })));
        setUnreadCount(0);
        
        // Refresh from server to ensure consistency
        setTimeout(fetchNotifications, 500);
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    } finally {
      setIsMarkingAsRead(false);
    }
  };

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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="h-4 w-4" />;
      case 'invite': return <Mail className="h-4 w-4" />;
      case 'completion': return <CheckCircle className="h-4 w-4" />;
      case 'turn': return <Clock className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === 'high') return 'text-red-600 bg-red-50';
    if (type === 'message') return 'text-[#D8A7B1] bg-[#D8A7B1]/10';
    if (type === 'invite') return 'text-[#7BAFB0] bg-[#7BAFB0]/10';
    if (type === 'completion') return 'text-green-600 bg-green-50';
    return 'text-[#3C4858] bg-gray-50';
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

            {/* Enhanced Notifications */}
            <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-[#3C4858]" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-[#D8A7B1] hover:bg-[#D8A7B1]"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto" align="end">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="bg-[#D8A7B1]/10 text-[#D8A7B1]">
                        {unreadCount} new
                      </Badge>
                    )}
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={markAllAsRead}
                        disabled={isMarkingAsRead}
                        className="h-6 px-2 text-xs text-[#7BAFB0] hover:bg-[#7BAFB0]/10 hover:text-[#7BAFB0]"
                      >
                        {isMarkingAsRead ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {!isMarkingAsRead && 'Clear all'}
                      </Button>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="h-8 w-8 text-[#3C4858]/30 mx-auto mb-2" />
                    <p className="text-sm text-[#3C4858]/70">No notifications yet</p>
                    <p className="text-xs text-[#3C4858]/50">You'll see updates here when they arrive</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <a
                        key={notification.id}
                        href={notification.actionUrl}
                        className="block"
                        onClick={() => setIsNotificationsOpen(false)}
                      >
                        <div className={`flex items-start gap-3 p-3 hover:bg-[#F9F7F4] transition-colors border-b border-[#3C4858]/5 last:border-b-0 ${notification.unread ? 'bg-[#F9F7F4]/50' : ''}`}>
                          <div className={`flex-shrink-0 p-2 rounded-full ${getNotificationColor(notification.type, notification.priority)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <p className={`text-sm font-medium text-[#3C4858] truncate ${notification.unread ? 'font-semibold' : ''}`}>{notification.title}</p>
                              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                <span className="text-xs text-[#3C4858]/60">
                                  {formatRelativeTime(notification.timestamp)}
                                </span>
                                {notification.unread && (
                                  <div className="w-2 h-2 bg-[#D8A7B1] rounded-full"></div>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-[#3C4858]/70 mt-1">{notification.description}</p>
                            {notification.priority === 'high' && (
                              <div className="flex items-center mt-2">
                                <Zap className="h-3 w-3 text-orange-500 mr-1" />
                                <span className="text-xs text-orange-600 font-medium">High Priority</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                
                {notifications.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-center text-[#7BAFB0] hover:bg-[#7BAFB0]/10 cursor-pointer justify-center">
                      View all notifications
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

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
