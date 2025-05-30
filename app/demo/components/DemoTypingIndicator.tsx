export function DemoTypingIndicator() {
  return (
    <div className="flex justify-center my-6">
      <div className="bg-[#7BAFB0]/10 text-[#3C4858] text-sm max-w-[90%] text-center p-6 rounded-xl border border-[#7BAFB0]/20 shadow-sm">
        <div className="flex items-center justify-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-[#7BAFB0]/80 font-medium">AI Mediator is thinking...</span>
        </div>
      </div>
    </div>
  );
}

