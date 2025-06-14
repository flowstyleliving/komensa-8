import { MessageSquare } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface ChatCardProps {
  title: string
  description: string
  lastActive: string
  partnerA: string
  partnerB: string
  colorA: string
  colorB: string
  isYourTurn: boolean
  chatId: string
  status?: string
  isCompleted?: boolean
}

export function ChatCard({
  title,
  description,
  lastActive,
  partnerA,
  partnerB,
  colorA,
  colorB,
  isYourTurn,
  chatId,
  status = 'active',
  isCompleted = false,
}: ChatCardProps) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className={`font-medium ${isCompleted ? 'text-[#3C4858]/70' : 'text-[#3C4858]'}`}>{title}</h3>
        <div className={`px-2 py-1 text-xs rounded-full font-medium ${
          isCompleted 
            ? 'bg-[#7BAFB0]/20 text-[#7BAFB0]' 
            : 'bg-[#D9C589]/20 text-[#D9C589]'
        }`}>
          {isCompleted ? 'Completed' : 'Active'}
        </div>
      </div>

      <p className={`text-sm mb-3 ${isCompleted ? 'text-[#3C4858]/50' : 'text-[#3C4858]/70'}`}>{description}</p>

      <div className="mb-3 flex items-center">
        <div className="text-xs text-[#3C4858]/70">Your turn:</div>
        <div className="ml-2 text-sm font-medium" style={{ color: isYourTurn ? "#D9C589" : "#3C4858" }}>
          {isYourTurn ? "✓" : "—"}
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-[#3C4858]/70">Last active: {lastActive}</div>
        <div className="flex -space-x-2">
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
            style={{ backgroundColor: colorA }}
          >
            {partnerA.charAt(0)}
          </div>
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
            style={{ backgroundColor: colorB }}
          >
            {partnerB.charAt(0)}
          </div>
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
            style={{ backgroundColor: "#D9C589" }}
          >
            AI
          </div>
        </div>
      </div>

      <Button 
        className={`w-full border transition-all ${
          isCompleted 
            ? 'bg-[#7BAFB0]/10 border-[#7BAFB0]/30 text-[#7BAFB0] hover:bg-[#7BAFB0]/20' 
            : 'bg-white border-[#3C4858]/10 text-[#3C4858] hover:bg-[#F9F7F4]'
        }`} 
        asChild
      >
        <Link href={`/chat/${chatId}`}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {isCompleted ? 'View Summary' : 'Open Chat'}
        </Link>
      </Button>
    </Card>
  )
}
