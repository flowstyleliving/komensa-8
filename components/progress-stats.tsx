import { ArrowUp } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ProgressStatsProps {
  title: string
  value: string
  change: string
  color: string
}

export function ProgressStats({ title, value, change, color }: ProgressStatsProps) {
  return (
    <Card className="p-4">
      <div className="text-sm text-[#3C4858]/70">{title}</div>
      <div className="mt-1 flex items-baseline">
        <div className="text-2xl font-semibold" style={{ color }}>
          {value}
        </div>
        {change && (
          <div className="ml-2 flex items-center text-xs font-medium text-green-600">
            <ArrowUp className="h-3 w-3 mr-0.5" />
            {change}
          </div>
        )}
      </div>
    </Card>
  )
}
