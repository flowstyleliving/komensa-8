"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Phone, Mail, ArrowLeft } from "lucide-react"
import KomensaLogoPath from "@/public/images/komensa-logo.png"
import Link from "next/link"
import Image from "next/image"

type AuthStep = "phone-check" | "sign-up-options" | "email-signup" | "phone-signup"

export default function SignInPage() {
  const [step, setStep] = useState<AuthStep>("phone-check")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "")
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/)
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`
    }
    return value
  }

  const handlePhoneCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, "")
      const response = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      })

      const data = await response.json()

      if (data.exists) {
        // Phone exists, proceed with sign in
        await handlePhoneSignIn(cleanPhone)
      } else {
        // Phone doesn't exist, show sign up options
        setStep("sign-up-options")
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhoneSignIn = async (phone: string) => {
    try {
      const response = await fetch("/api/auth/signin-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (response.ok) {
        window.location.href = "/dashboard"
      } else {
        setError("Failed to sign in. Please try again.")
      }
    } catch (err) {
      setError("Failed to sign in. Please try again.")
    }
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    try {
      window.location.href = "/api/auth/signin/google"
    } catch (err) {
      setError("Failed to authenticate with Google. Please try again.")
      setIsLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, "")
      const response = await fetch("/api/auth/signup-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          phone: cleanPhone,
        }),
      })

      if (response.ok) {
        window.location.href = "/dashboard"
      } else {
        const data = await response.json()
        setError(data.message || "Failed to create account. Please try again.")
      }
    } catch (err) {
      setError("Failed to create account. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhoneSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, "")
      const response = await fetch("/api/auth/signup-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          name,
        }),
      })

      if (response.ok) {
        window.location.href = "/dashboard"
      } else {
        const data = await response.json()
        setError(data.message || "Failed to create account. Please try again.")
      }
    } catch (err) {
      setError("Failed to create account. Please try again.")
    } finally {
      setIsLoading(false)
    }
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
              {step === "phone-check" && "Welcome to Komensa!"}
              {step === "sign-up-options" && "How would you like to sign up?"}
              {step === "email-signup" && "Create your account with Email"}
              {step === "phone-signup" && "A little more about you"}
            </CardTitle>
            <CardDescription className="text-[#3C4858]/80">
              {step === "phone-check" && "Let's get you signed in or create your account."}
              {step === "sign-up-options" && "Choose how you'd like to create your account"}
              {step === "email-signup" && "Enter your details to create your account"}
              {step === "phone-signup" && "Tell us a bit about yourself"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert className="border-[#E39AA7] bg-[#E39AA7]/10">
                <AlertDescription className="text-[#3C4858]">{error}</AlertDescription>
              </Alert>
            )}

            {/* Phone Check Step */}
            {step === "phone-check" && (
              <>
                <form onSubmit={handlePhoneCheck} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[#3C4858]">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
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
                    {isLoading ? "Checking..." : "Continue with Phone"}
                  </Button>
                </form>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[#3C4858]/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#F9F7F4] px-2 text-[#3C4858]/80">Or continue with</span>
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

            {/* Sign Up Options Step */}
            {step === "sign-up-options" && (
              <div className="space-y-4">
                <div className="text-center text-sm text-[#3C4858]/80 mb-4">
                  Phone number {phoneNumber} is not registered.
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

                <Button
                  onClick={() => setStep("email-signup")}
                  variant="outline"
                  className="w-full border-[#3C4858]/20 hover:bg-[#D8A7B1]/10"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Sign up with Email
                </Button>

                <Button
                  onClick={() => setStep("phone-signup")}
                  className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Continue with Phone Number
                </Button>

                <Button
                  onClick={() => setStep("phone-check")}
                  variant="ghost"
                  className="w-full text-[#3C4858]/80 hover:text-[#3C4858]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
            )}

            {/* Email Sign Up Step */}
            {step === "email-signup" && (
              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[#3C4858]">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-[#3C4858]/20 focus:border-[#D8A7B1]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#3C4858]">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
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
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
                <Button
                  onClick={() => setStep("sign-up-options")}
                  variant="ghost"
                  className="w-full text-[#3C4858]/80 hover:text-[#3C4858]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </form>
            )}

            {/* Phone Sign Up Step */}
            {step === "phone-signup" && (
              <form onSubmit={handlePhoneSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-[#3C4858]">
                    Full Name
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-[#3C4858]/20 focus:border-[#D8A7B1]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#3C4858]">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-[#3C4858]/50" />
                    <Input value={phoneNumber} disabled className="pl-10 bg-gray-50 border-[#3C4858]/20" />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
                <Button
                  onClick={() => setStep("sign-up-options")}
                  variant="ghost"
                  className="w-full text-[#3C4858]/80 hover:text-[#3C4858]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </form>
            )}

            <Separator className="bg-[#3C4858]/10" />

            <div className="text-center text-sm text-[#3C4858]/80">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-[#D8A7B1] hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-[#D8A7B1] hover:underline">
                Privacy Policy
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
