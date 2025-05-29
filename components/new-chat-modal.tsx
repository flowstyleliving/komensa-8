'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MessageSquare, 
  Users, 
  Heart, 
  Home, 
  DollarSign, 
  Calendar, 
  Search,
  UserPlus,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface ChatSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (chatData: ChatData) => void;
}

interface ChatData {
  title: string;
  description: string;
  category: string;
  participants: User[];
}

interface User {
  id: string;
  display_name: string;
  email: string;
  avatar?: string;
}

const chatCategories = [
  { value: 'communication', label: 'Communication & Understanding', icon: MessageSquare, color: '#D8A7B1', description: 'Improve how you connect and express yourselves' },
  { value: 'relationship', label: 'Relationship Growth', icon: Heart, color: '#E39AA7', description: 'Strengthen your bond and intimacy' },
  { value: 'household', label: 'Home & Daily Life', icon: Home, color: '#7BAFB0', description: 'Navigate household responsibilities together' },
  { value: 'financial', label: 'Financial Planning', icon: DollarSign, color: '#D9C589', description: 'Align on money matters and future goals' },
  { value: 'planning', label: 'Future Dreams', icon: Calendar, color: '#B8A7D8', description: 'Plan your shared journey ahead' },
  { value: 'other', label: 'Something Else', icon: Users, color: '#A8B8C8', description: 'Whatever\'s on your mind' },
];

export function ChatSetupModal({ isOpen, onClose, onCreateChat }: ChatSetupModalProps) {
  const [formData, setFormData] = useState<ChatData>({
    title: '',
    description: '',
    category: '',
    participants: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Optimized search function with better error handling
  const searchUsers = async (query: string) => {
    // Clear previous results and errors
    setSearchError(null);
    
    // Don't search if query is too short
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.users)) {
        // Filter out already selected participants and limit results
        const filteredResults = data.users
          .filter((user: User) => !formData.participants.some(p => p.id === user.id))
          .slice(0, 10); // Limit to 10 results for performance
        
        setSearchResults(filteredResults);
      } else {
        setSearchResults([]);
        if (!data.success) {
          setSearchError(data.error || 'Search failed');
        }
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setSearchError('Search timed out. Please try again.');
        } else {
          setSearchError('Unable to search users. Please check your connection.');
        }
      } else {
        setSearchError('An unexpected error occurred.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Optimized debounced search with cleanup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
        setSearchError(null);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery, formData.participants]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  const addParticipant = (user: User) => {
    setFormData(prev => ({
      ...prev,
      participants: [...prev.participants, user]
    }));
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const removeParticipant = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== userId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onCreateChat(formData);
      
      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        category: '',
        participants: [],
      });
      setSearchQuery('');
      setSearchResults([]);
      onClose();
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCategory = chatCategories.find(cat => cat.value === formData.category);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#D8A7B1] to-[#7BAFB0]">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl text-[#3C4858] font-bold">
            Start a Meaningful Chat
          </DialogTitle>
          <DialogDescription className="text-[#3C4858]/70 text-base leading-relaxed">
            Create a safe space for open dialogue. Our AI mediator will guide you through thoughtful discussions that bring you closer together.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chat Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[#3C4858] font-medium">
              What would you like to talk about?
            </Label>
            <Input
              id="title"
              placeholder="e.g., Planning our summer vacation together"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="border-[#3C4858]/20 focus:border-[#D8A7B1] text-base"
              required
            />
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <Label htmlFor="category" className="text-[#3C4858] font-medium">
              Choose a chat theme
            </Label>
            <Select
              value={formData.category}
              onValueChange={(value: string) => setFormData({ ...formData, category: value })}
              required
            >
              <SelectTrigger className="border-[#3C4858]/20 focus:border-[#D8A7B1] h-12">
                <SelectValue placeholder="What area would you like to explore?" />
              </SelectTrigger>
              <SelectContent>
                {chatCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-start gap-3 py-1">
                        <Icon className="h-5 w-5 mt-0.5" style={{ color: category.color }} />
                        <div>
                          <div className="font-medium">{category.label}</div>
                          <div className="text-xs text-muted-foreground">{category.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[#3C4858] font-medium">
              Share more details (optional)
            </Label>
            <Textarea
              id="description"
              placeholder="What specific aspects would you like to explore? Any particular goals or concerns?"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              className="border-[#3C4858]/20 focus:border-[#D8A7B1] min-h-[100px] resize-none"
            />
          </div>

          {/* Invite Participants */}
          <div className="space-y-3">
            <Label className="text-[#3C4858] font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite participants
            </Label>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#3C4858]/50" />
              <Input
                placeholder="Type at least 2 characters to search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                autoComplete="off"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-[#D8A7B1] border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>

            {/* Search Status Messages */}
            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <div className="text-xs text-[#3C4858]/60 px-3 py-2 bg-[#F9F7F4] rounded-lg border border-[#3C4858]/10">
                Type at least 2 characters to start searching...
              </div>
            )}

            {searchError && (
              <div className="text-xs text-red-600 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                {searchError}
              </div>
            )}

            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && !searchError && (
              <div className="text-xs text-[#3C4858]/60 px-3 py-2 bg-[#F9F7F4] rounded-lg border border-[#3C4858]/10">
                No users found matching "{searchQuery}". Try a different search term.
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border border-[#3C4858]/20 rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm">
                <div className="text-xs text-[#3C4858]/60 px-3 py-2 bg-[#F9F7F4] border-b border-[#3C4858]/10">
                  Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map((user, index) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 hover:bg-[#F9F7F4] cursor-pointer border-b border-[#3C4858]/10 last:border-b-0 transition-colors duration-150"
                    onClick={() => addParticipant(user)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        addParticipant(user);
                      }
                    }}
                    aria-label={`Add ${user.display_name} to chat`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D8A7B1] to-[#7BAFB0] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                        {user.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[#3C4858] truncate">{user.display_name}</div>
                        <div className="text-xs text-[#3C4858]/60 truncate">{user.email}</div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-[#D8A7B1] hover:bg-[#D8A7B1]/10 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        addParticipant(user);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Participants */}
            {formData.participants.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[#3C4858]">Invited participants:</div>
                <div className="flex flex-wrap gap-2">
                  {formData.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 bg-gradient-to-r from-[#D8A7B1]/10 to-[#7BAFB0]/10 border border-[#D8A7B1]/20 rounded-full px-3 py-1"
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#D8A7B1] to-[#7BAFB0] flex items-center justify-center text-white font-medium text-xs">
                        {participant.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[#3C4858]">{participant.display_name}</span>
                      <button
                        type="button"
                        onClick={() => removeParticipant(participant.id)}
                        className="text-[#3C4858]/50 hover:text-[#3C4858] ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-[#3C4858]/60">
              You can start the chat now and invite others later, or add participants before beginning.
            </p>
          </div>

          {/* Category Preview */}
          {selectedCategory && (
            <div className="p-4 rounded-lg border border-[#3C4858]/10 bg-gradient-to-r from-[#F9F7F4] to-white">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${selectedCategory.color}20` }}>
                  <selectedCategory.icon 
                    className="h-5 w-5" 
                    style={{ color: selectedCategory.color }} 
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[#3C4858] mb-1">
                    {selectedCategory.label} Chat
                  </div>
                  <p className="text-sm text-[#3C4858]/70 mb-2">
                    {selectedCategory.description}
                  </p>
                  <div className="text-xs text-[#3C4858]/60 bg-white/50 rounded px-2 py-1 inline-block">
                    ✨ AI mediator specialized for {selectedCategory.label.toLowerCase()} discussions
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#3C4858]/20 text-[#3C4858] hover:bg-[#3C4858]/5"
            >
              Maybe Later
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.title || !formData.category}
              className="bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] hover:opacity-90 text-white px-6"
            >
              {isLoading ? (
                'Creating...'
              ) : (
                <>
                  Create Chat
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 