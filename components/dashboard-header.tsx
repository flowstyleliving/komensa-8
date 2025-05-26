import { Bell, Search } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DashboardHeader() {
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
                <div className="text-sm font-medium text-[#3C4858]">Jamie Smith</div>
                <div className="text-xs text-[#3C4858]/70">Premium Plan</div>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] flex items-center justify-center text-white font-medium">
                JS
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
