"use client"

import { useState } from "react"
import { ArrowRight, MessageSquare, Users, Bot, Star, Play, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Image from "next/image"

export default function SplashPage() {
  const [email, setEmail] = useState("")

  return (
    <div className="min-h-screen bg-[#F9F7F4]">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-[#3C4858]/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Image src="/images/komensa-logo.png" alt="Komensa" width={120} height={40} className="h-8 w-auto" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-[#3C4858] hover:text-[#D8A7B1] transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-[#3C4858] hover:text-[#7BAFB0] transition-colors">
                How It Works
              </a>
              <a href="#testimonials" className="text-[#3C4858] hover:text-[#D9C589] transition-colors">
                Stories
              </a>
              <Button variant="outline" className="border-[#3C4858]/20 text-[#3C4858] rounded-xl">
                Sign In
              </Button>
              <Button className="bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white rounded-xl">Get Started</Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-[#3C4858] mb-6">
              Better conversations,
              <br />
              <span className="bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] bg-clip-text text-transparent">
                stronger relationships
              </span>
            </h1>
            <p className="text-xl text-[#3C4858]/70 mb-8 max-w-2xl mx-auto">
              Komensa uses AI to guide meaningful conversations between partners, helping you communicate more
              effectively and resolve conflicts with empathy and understanding.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white px-8 py-4 text-lg rounded-xl"
              >
                Start Your First Chat
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-[#3C4858]/20 text-[#3C4858] px-8 py-4 text-lg rounded-xl"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Hero Image/Preview */}
            <div className="relative max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-2xl border border-[#3C4858]/10 overflow-hidden">
                <div className="bg-gradient-to-r from-[#D8A7B1]/10 to-[#7BAFB0]/10 p-4 border-b border-[#3C4858]/10">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <div className="ml-4 text-sm text-[#3C4858]/70">Financial Planning Discussion</div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#D8A7B1] flex items-center justify-center text-white text-sm font-medium">
                      J
                    </div>
                    <div className="bg-[#D8A7B1]/15 p-3 rounded-xl border-l-4 border-[#D8A7B1] flex-1">
                      <div className="text-sm text-[#3C4858]">
                        I think we should set aside 20% of our income for savings each month.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#7BAFB0] flex items-center justify-center text-white text-sm font-medium">
                      A
                    </div>
                    <div className="bg-[#7BAFB0]/15 p-3 rounded-xl border-l-4 border-[#7BAFB0] flex-1">
                      <div className="text-sm text-[#3C4858]">
                        That seems high. Maybe 10% would be more realistic with our current expenses?
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#D9C589] flex items-center justify-center text-white text-sm font-medium">
                      AI
                    </div>
                    <div className="bg-[#D9C589]/15 p-3 rounded-xl border-l-4 border-[#D9C589] flex-1">
                      <div className="text-sm text-[#3C4858]">
                        I understand both perspectives. Let's explore a middle ground that works for both of you...
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#3C4858] mb-4">How Komensa helps you connect</h2>
            <p className="text-xl text-[#3C4858]/70 max-w-2xl mx-auto">
              Our AI mediator guides your conversations with proven communication techniques
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center border-[#3C4858]/10 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-full bg-[#D8A7B1]/20 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="h-8 w-8 text-[#D8A7B1]" />
              </div>
              <h3 className="text-xl font-semibold text-[#3C4858] mb-4">Guided Conversations</h3>
              <p className="text-[#3C4858]/70">
                AI facilitates turn-based discussions, ensuring both partners are heard and understood
              </p>
            </Card>

            <Card className="p-8 text-center border-[#3C4858]/10 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-full bg-[#7BAFB0]/20 flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-[#7BAFB0]" />
              </div>
              <h3 className="text-xl font-semibold text-[#3C4858] mb-4">Conflict Resolution</h3>
              <p className="text-[#3C4858]/70">
                Learn proven techniques for resolving disagreements and finding common ground
              </p>
            </Card>

            <Card className="p-8 text-center border-[#3C4858]/10 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 rounded-full bg-[#D9C589]/20 flex items-center justify-center mx-auto mb-6">
                <Bot className="h-8 w-8 text-[#D9C589]" />
              </div>
              <h3 className="text-xl font-semibold text-[#3C4858] mb-4">AI Insights</h3>
              <p className="text-[#3C4858]/70">
                Get personalized suggestions and communication strategies tailored to your relationship
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#3C4858] mb-4">Simple steps to better communication</h2>
            <p className="text-xl text-[#3C4858]/70">Start having more meaningful conversations in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#D8A7B1] text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold text-[#3C4858] mb-2">Choose a Topic</h3>
              <p className="text-[#3C4858]/70">
                Select your own discussion theme from shared chores to parenting.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#7BAFB0] text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold text-[#3C4858] mb-2">Start Chatting</h3>
              <p className="text-[#3C4858]/70">Take turns sharing your thoughts while AI guides the conversation</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#D9C589] text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold text-[#3C4858] mb-2">Find Solutions</h3>
              <p className="text-[#3C4858]/70">Work together to reach understanding and create actionable agreements</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#3C4858] mb-4">Real couples, real results</h2>
            <p className="text-xl text-[#3C4858]/70">See how Komensa has helped strengthen relationships</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-6 border-[#3C4858]/10">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-[#D9C589] fill-current" />
                ))}
              </div>
              <p className="text-[#3C4858]/70 mb-4">
                "Komensa helped us have conversations we'd been avoiding for months. The AI guidance made it feel safe
                to share our real feelings."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] flex items-center justify-center text-white font-medium mr-3">
                  S&M
                </div>
                <div>
                  <div className="font-medium text-[#3C4858]">Sarah & Mike</div>
                  <div className="text-sm text-[#3C4858]/70">Together 3 years</div>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-[#3C4858]/10">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-[#D9C589] fill-current" />
                ))}
              </div>
              <p className="text-[#3C4858]/70 mb-4">
                "We used to argue in circles. Now we actually solve problems together. The structured approach really
                works."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] flex items-center justify-center text-white font-medium mr-3">
                  J&A
                </div>
                <div>
                  <div className="font-medium text-[#3C4858]">Jordan & Alex</div>
                  <div className="text-sm text-[#3C4858]/70">Married 5 years</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-[#D8A7B1]/10 to-[#7BAFB0]/10">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold text-[#3C4858] mb-4">Ready to transform your conversations?</h2>
          <p className="text-xl text-[#3C4858]/70 mb-8 max-w-2xl mx-auto">
            Join thousands of couples who are building stronger relationships with Komensa
          </p>

          <div className="max-w-md mx-auto flex gap-2 mb-8">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-white border-[#3C4858]/20"
            />
            <Button className="bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white px-6">Get Started</Button>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-[#3C4858]/70">
            <div className="flex items-center">
              <Check className="h-4 w-4 text-[#D9C589] mr-2" />
              Free to start
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 text-[#D9C589] mr-2" />
              No credit card required
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 text-[#D9C589] mr-2" />
              Private & secure
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#3C4858] text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Image
                src="/images/komensa-logo.png"
                alt="Komensa"
                width={120}
                height={40}
                className="h-8 w-auto mb-4 brightness-0 invert"
              />
              <p className="text-white/70">
                AI-powered communication platform for stronger relationships and better conversations.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-white/70">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    How it works
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-white/70">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-white/70">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20 mt-8 pt-8 text-center text-white/70">
            <p>&copy; 2025 Komensa. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
