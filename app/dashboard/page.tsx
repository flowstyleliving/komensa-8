"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  Calendar,
  MessageSquare,
  PieChart,
  Settings,
  User,
  Plus,
  ChevronRight,
  Clock,
  Bot,
  CheckCircle,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardHeader } from "@/components/dashboard-header"
import { ChatCard } from "@/components/chat-card"
import { ProgressStats } from "@/components/progress-stats"
import ChatSetupModal from "@/components/chat-setup-modal"

interface ChatData {
  title: string;
  description: string;
  category: string;
  participants: { id: string }[];
}

interface User {
  id: string;
  display_name: string;
  email: string;
  avatar?: string;
}

interface Chat {
  id: string;
  title: string;
  description: string;
  lastActive: string;
  participants: {
    id: string;
    display_name: string;
    role: string;
  }[];
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [isChatModalOpen, setIsChatModalOpen] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const { data: session } = useSession();
  
  // Get user's first name for welcome message
  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  // Fetch user's chats
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch('/api/chats');
        if (response.ok) {
          const data = await response.json();
          setChats(data.chats || []);
        } else {
          console.error('Failed to fetch chats');
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
      } finally {
        setIsLoadingChats(false);
      }
    };

    if (session?.user?.id) {
      fetchChats();
    }
  }, [session?.user?.id]);

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Yesterday';
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return `${Math.floor(diffInDays / 7)} weeks ago`;
  };

  const handleCreateChat = async (chatData: ChatData) => {
    try {
      const response = await fetch('/api/chats/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Chat created successfully:', result);
        // Route to the new chat
        window.location.href = result.redirectUrl;
      } else {
        console.error('Failed to create chat:', result.error);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  }

  const openChatModal = () => {
    setIsChatModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#F9F7F4]">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-64 space-y-4">
            <Card className="p-4">
              <div className="flex flex-col space-y-1">
                <h2 className="font-semibold text-[#3C4858]">Welcome back</h2>
                <p className="text-sm text-[#3C4858]/70">Continue your journey</p>
              </div>

              <div className="mt-6 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#3C4858] hover:bg-[#D8A7B1]/10 hover:text-[#3C4858]"
                  onClick={() => setActiveTab("overview")}
                >
                  <PieChart className="mr-2 h-4 w-4" />
                  Overview
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#3C4858] hover:bg-[#7BAFB0]/10 hover:text-[#3C4858]"
                  onClick={() => setActiveTab("chats")}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chats
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#3C4858] hover:bg-[#D9C589]/10 hover:text-[#3C4858]"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Calendar
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#3C4858] hover:bg-[#D8A7B1]/10 hover:text-[#3C4858]"
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#3C4858] hover:bg-[#7BAFB0]/10 hover:text-[#3C4858]"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </div>

              <div className="mt-6">
                <Button 
                  className="w-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] hover:opacity-90 text-white"
                  onClick={openChatModal}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Chat
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium text-[#3C4858] mb-3">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#3C4858]/70">Active Chats</span>
                  <span className="text-sm font-medium text-[#D8A7B1]">
                    {chats.filter(chat => chat.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#3C4858]/70">Total Chats</span>
                  <span className="text-sm font-medium text-[#7BAFB0]">
                    {chats.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#3C4858]/70">Your Turn</span>
                  <span className="text-sm font-medium text-[#D9C589]">✓</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Main content */}
          <div className="flex-1">
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="chats">Chats</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Welcome Box */}
                <Card className="p-6 bg-gradient-to-r from-[#D8A7B1]/10 to-[#7BAFB0]/10 border-none">
                  <h2 className="text-xl font-semibold text-[#3C4858]">Welcome back, {firstName} 👋</h2>
                  <p className="text-[#3C4858]/70 mt-1">Continue where you left off.</p>
                  <Button className="mt-4 bg-[#D8A7B1] hover:bg-[#D8A7B1]/90 text-white">Resume Latest Chat</Button>
                </Card>

                {/* Active Chats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ProgressStats 
                    title="Active Chats" 
                    value={chats.filter(chat => chat.status === 'active').length.toString()} 
                    change={chats.length > 0 ? "+1" : ""} 
                    color="#D8A7B1" 
                  />
                  <ProgressStats 
                    title="Total Chats" 
                    value={chats.length.toString()} 
                    change={chats.length > 0 ? `+${chats.length}` : ""} 
                    color="#7BAFB0" 
                  />
                  <ProgressStats 
                    title="Your Turn" 
                    value="✓" 
                    change="" 
                    color="#D9C589" 
                  />
                </div>

                {/* Recent Activity */}
                <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-[#3C4858]">Recent Activity</h3>
                    <Button variant="ghost" size="sm" className="text-[#7BAFB0]">
                      View all <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <div className="p-2 rounded-full mr-3 mt-0.5 bg-[#D8A7B1]/20">
                        <MessageSquare className="h-4 w-4 text-[#D8A7B1]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#3C4858]">🟣 New message from K.</div>
                        <div className="text-xs text-[#3C4858]/70">today, 1:45 PM</div>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="p-2 rounded-full mr-3 mt-0.5 bg-[#D9C589]/20">
                        <Bot className="h-4 w-4 text-[#D9C589]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#3C4858]">
                          🟢 AI mediator responded in "Household"
                        </div>
                        <div className="text-xs text-[#3C4858]/70">today, 12:30 PM</div>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="p-2 rounded-full mr-3 mt-0.5 bg-[#7BAFB0]/20">
                        <CheckCircle className="h-4 w-4 text-[#7BAFB0]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#3C4858]">🔵 You completed: Check-in Reflection</div>
                        <div className="text-xs text-[#3C4858]/70">yesterday, 5:20 PM</div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Upcoming Sessions */}
                <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-[#3C4858]">Upcoming Sessions</h3>
                    <Button variant="ghost" size="sm" className="text-[#7BAFB0]">
                      View calendar <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center p-3 rounded-lg bg-[#D8A7B1]/10 border-l-4 border-[#D8A7B1]">
                      <Clock className="h-5 w-5 text-[#D8A7B1] mr-3" />
                      <div>
                        <h4 className="font-medium text-[#3C4858]">Financial Planning</h4>
                        <p className="text-sm text-[#3C4858]/70">Today, 3:00 PM</p>
                      </div>
                    </div>
                    <div className="flex items-center p-3 rounded-lg bg-[#7BAFB0]/10 border-l-4 border-[#7BAFB0]">
                      <Clock className="h-5 w-5 text-[#7BAFB0] mr-3" />
                      <div>
                        <h4 className="font-medium text-[#3C4858]">Communication Check-in</h4>
                        <p className="text-sm text-[#3C4858]/70">Tomorrow, 10:00 AM</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="chats" className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-semibold text-[#3C4858]">Your Chats</h2>
                  <Button 
                    className="bg-[#D8A7B1] hover:bg-[#D8A7B1]/90 text-white"
                    onClick={openChatModal}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Chat
                  </Button>
                </div>

                {isLoadingChats ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D8A7B1]"></div>
                    <span className="ml-3 text-[#3C4858]/70">Loading your chats...</span>
                  </div>
                ) : chats.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="mx-auto h-12 w-12 text-[#3C4858]/30 mb-4" />
                    <h3 className="text-lg font-medium text-[#3C4858] mb-2">No chats yet</h3>
                    <p className="text-[#3C4858]/70 mb-4">Create your first chat to get started with AI-mediated conversations.</p>
                    <Button 
                      className="bg-[#D8A7B1] hover:bg-[#D8A7B1]/90 text-white"
                      onClick={openChatModal}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Chat
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {chats.map(chat => {
                      // Get the current user and other participants
                      const currentUser = chat.participants.find(p => p.id === session?.user?.id);
                      const otherParticipants = chat.participants.filter(p => p.id !== session?.user?.id);
                      const otherParticipant = otherParticipants[0]; // For now, assume 2-person chats
                      
                      return (
                        <ChatCard
                          key={chat.id}
                          title={chat.title}
                          description={chat.description}
                          lastActive={formatRelativeTime(chat.lastActive)}
                          partnerA="You"
                          partnerB={otherParticipant?.display_name || 'Unknown'}
                          colorA="#D8A7B1"
                          colorB="#7BAFB0"
                          isYourTurn={true} // TODO: Implement turn checking logic
                          chatId={chat.id}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Chat Setup Modal */}
      <ChatSetupModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
      />
    </div>
  )
}
