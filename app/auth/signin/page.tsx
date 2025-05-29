"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Eye, EyeOff, User, Lock } from "lucide-react"
import KomensaLogoPath from "@/public/images/komensa-logo.png"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"

type AuthStep = "email-check" | "signin" | "signup"

export default function SignInPage() {
  const [step, setStep] = useState<AuthStep>("email-check")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [userExists, setUserExists] = useState(false)
  const searchParams = useSearchParams()

  // Check for OAuth errors in URL parameters
  useEffect(() => {
    const oauthError = searchParams.get('error')
    if (oauthError === 'google') {
      setError("Google authentication failed. Please check your Google account settings and try again.")
    }
  }, [searchParams])

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.exists) {
        // Email exists, show signin form
        setUserExists(true)
        setStep("signin")
      } else {
        // Email doesn't exist, show signup form
        setUserExists(false)
        setStep("signup")
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password. Please try again.")
      } else {
        window.location.href = "/dashboard"
      }
    } catch (err) {
      setError("Failed to sign in. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      setIsLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.")
      setIsLoading(false)
      return
    }

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
        // Auto sign in after successful signup
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError("Account created but failed to sign in. Please try signing in manually.")
        } else {
          window.location.href = "/dashboard"
        }
      } else {
        setError(data.message || "Failed to create account. Please try again.")
      }
    } catch (err) {
      setError("Failed to create account. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch (err) {
      setError("Failed to authenticate with Google. Please try again.")
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setStep("email-check")
    setPassword("")
    setConfirmPassword("")
    setName("")
    setUsername("")
    setError("")
    setUserExists(false)
  }

  return (
    <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image src={KomensaLogoPath} alt="Komensa Logo" className="h-12 w-auto mx-auto" />
          </Link>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-[#3C4858]">
              {step === "email-check" && "Welcome to Komensa!"}
              {step === "signin" && "Welcome back!"}
              {step === "signup" && "Create your account"}
            </CardTitle>
            <CardDescription className="text-[#3C4858]/80">
              {step === "email-check" && "Enter your email to get started"}
              {step === "signin" && "Sign in to your account"}
              {step === "signup" && "Join Komensa to start meaningful conversations"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert className="border-[#E39AA7] bg-[#E39AA7]/10">
                <AlertDescription className="text-[#3C4858]">{error}</AlertDescription>
              </Alert>
            )}

            {/* Email Check Step */}
            {step === "email-check" && (
              <>
                <form onSubmit={handleEmailCheck} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#3C4858]">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? "Checking..." : "Continue"}
                  </Button>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[#3C4858]/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-[#3C4858]/80">Or continue with</span>
                  </div>
                </div>

                <Button
                  onClick={handleGoogleAuth}
                  variant="outline"
                  className="w-full border-[#3C4858]/20 hover:bg-[#D9C589]/10"
                  disabled={isLoading}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </>
            )}

            {/* Sign In Step */}
            {step === "signin" && (
              <>
                <div className="text-center text-sm text-[#3C4858]/80 mb-4">
                  Welcome back! We found your account for <strong>{email}</strong>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-[#3C4858]">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                      <Input
                        id="signin-email"
                        type="email"
                        value={email}
                        disabled
                        className="pl-10 bg-gray-50 border-[#3C4858]/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-[#3C4858]">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                        required
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

                  <Button
                    type="submit"
                    className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>

                  <Button
                    type="button"
                    onClick={resetForm}
                    variant="ghost"
                    className="w-full text-[#3C4858]/80 hover:text-[#3C4858]"
                  >
                    Use different email
                  </Button>
                </form>
              </>
            )}

            {/* Sign Up Step */}
            {step === "signup" && (
              <>
                <div className="text-center text-sm text-[#3C4858]/80 mb-4">
                  We don't have an account for <strong>{email}</strong>. Let's create one!
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-[#3C4858]">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        disabled
                        className="pl-10 bg-gray-50 border-[#3C4858]/20"
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
                        placeholder="Enter your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                        required
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
                        placeholder="Choose a username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="pl-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                        required
                      />
                    </div>
                    <p className="text-xs text-[#3C4858]/60">
                      Username can only contain lowercase letters, numbers, and underscores
                    </p>
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
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-[#3C4858]/50 hover:text-[#3C4858]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-[#3C4858]/60">
                      Password must be at least 8 characters long
                    </p>
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
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 border-[#3C4858]/20 focus:border-[#D8A7B1]"
                        required
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
                    type="submit"
                    className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>

                  <Button
                    type="button"
                    onClick={resetForm}
                    variant="ghost"
                    className="w-full text-[#3C4858]/80 hover:text-[#3C4858]"
                  >
                    Use different email
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
