"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Eye, EyeOff, User, Lock, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function TestSignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info")

  const handleEmailCheck = async () => {
    if (!email) {
      setMessage("Please enter an email address")
      setMessageType("error")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.exists) {
        setMessage(`✅ Email ${email} exists in database - would show signin form`)
        setMessageType("success")
      } else {
        setMessage(`❌ Email ${email} not found - would show signup form`)
        setMessageType("info")
      }
    } catch (err) {
      setMessage("Error checking email")
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !name || !username) {
      setMessage("Please fill in all fields")
      setMessageType("error")
      return
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match")
      setMessageType("error")
      return
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long")
      setMessageType("error")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          username,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ Account created successfully! User ID: ${data.user.id}`)
        setMessageType("success")
        // Clear form
        setEmail("")
        setPassword("")
        setConfirmPassword("")
        setName("")
        setUsername("")
      } else {
        setMessage(data.error || "Failed to create account")
        setMessageType("error")
      }
    } catch (err) {
      setMessage("Error creating account")
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F7F4] p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#3C4858] mb-4">Email Signin Flow Test</h1>
          <p className="text-[#3C4858]/70">Test the new email-based authentication system</p>
          <Link href="/auth/signin" className="text-[#D8A7B1] hover:underline">
            → Go to actual signin page
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Email Check Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#3C4858] flex items-center">
                <Mail className="mr-2 h-5 w-5" />
                Email Check Test
              </CardTitle>
              <CardDescription>
                Test if an email exists in the database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="check-email" className="text-[#3C4858]">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                  <Input
                    id="check-email"
                    type="email"
                    placeholder="Enter email to check"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                  />
                </div>
              </div>
              <Button
                onClick={handleEmailCheck}
                className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
                disabled={isLoading}
              >
                {isLoading ? "Checking..." : "Check Email"}
              </Button>
            </CardContent>
          </Card>

          {/* Signup Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#3C4858] flex items-center">
                <User className="mr-2 h-5 w-5" />
                Signup Test
              </CardTitle>
              <CardDescription>
                Test creating a new user account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-[#3C4858]">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-[#3C4858]">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-username" className="text-[#3C4858]">
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="Choose username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-[#3C4858]">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#3C4858]/50 hover:text-[#3C4858]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="text-[#3C4858]">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                  <Input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-[#3C4858]/50 hover:text-[#3C4858]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleSignUp}
                className="w-full bg-[#7BAFB0] hover:bg-[#6A9FA0] text-white"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Message Display */}
        {message && (
          <div className="mt-6">
            <Alert className={`border-2 ${
              messageType === "success" 
                ? "border-green-500 bg-green-50" 
                : messageType === "error"
                ? "border-red-500 bg-red-50"
                : "border-blue-500 bg-blue-50"
            }`}>
              <AlertDescription className="text-[#3C4858] font-medium">
                {message}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Feature List */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-[#3C4858] flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
              Email Signin Flow Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-[#3C4858]/70">
              <div>
                <h4 className="font-medium text-[#3C4858] mb-2">✅ Implemented Features:</h4>
                <ul className="space-y-1">
                  <li>• Email existence check API</li>
                  <li>• User registration API</li>
                  <li>• Password hashing with bcrypt</li>
                  <li>• Username validation (lowercase, numbers, underscores)</li>
                  <li>• Email format validation</li>
                  <li>• Password strength requirements (8+ chars)</li>
                  <li>• Duplicate email/username prevention</li>
                  <li>• Database integration with Prisma/Neon</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-[#3C4858] mb-2">🔄 Dynamic Flow:</h4>
                <ul className="space-y-1">
                  <li>• Single email input initially</li>
                  <li>• Check if email exists in database</li>
                  <li>• If exists: Show password field for signin</li>
                  <li>• If not exists: Show signup form with:</li>
                  <li>&nbsp;&nbsp;- Full name field</li>
                  <li>&nbsp;&nbsp;- Username field</li>
                  <li>&nbsp;&nbsp;- Password field</li>
                  <li>&nbsp;&nbsp;- Confirm password field</li>
                  <li>• Auto-signin after successful registration</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 