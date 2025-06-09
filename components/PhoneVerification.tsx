'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Phone, Shield } from 'lucide-react';

interface PhoneVerificationProps {
  userId?: string;
  onVerificationComplete?: (phoneNumber: string) => void;
  onCancel?: () => void;
}

export default function PhoneVerification({ 
  userId, 
  onVerificationComplete, 
  onCancel 
}: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [methodId, setMethodId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return digits;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const sendOTP = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/phone/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.replace(/\D/g, ''), // Send only digits
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMethodId(data.methodId);
        setStep('otp');
        setSuccess('OTP sent to your phone number');
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/phone/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: otpCode,
          methodId: methodId,
          userId: userId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Phone number verified successfully!');
        onVerificationComplete?.(data.phoneNumber);
      } else {
        setError(data.error || 'Invalid or expired code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(value);
  };

  const resendOTP = async () => {
    setOtpCode('');
    setError('');
    await sendOTP();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7BAFB0]/20">
          {step === 'phone' ? (
            <Phone className="h-6 w-6 text-[#7BAFB0]" />
          ) : (
            <Shield className="h-6 w-6 text-[#7BAFB0]" />
          )}
        </div>
        <CardTitle>
          {step === 'phone' ? 'Verify Phone Number' : 'Enter Verification Code'}
        </CardTitle>
        <CardDescription>
          {step === 'phone' 
            ? 'We\'ll send you a verification code via SMS'
            : `Enter the 6-digit code sent to ${phoneNumber}`
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={14}
              />
            </div>
            <Button 
              onClick={sendOTP} 
              disabled={loading || !phoneNumber}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Verification Code'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="123456"
                value={otpCode}
                onChange={handleOtpChange}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            <Button 
              onClick={verifyOTP} 
              disabled={loading || otpCode.length !== 6}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>
            <div className="text-center space-y-2">
              <Button 
                variant="ghost" 
                onClick={resendOTP}
                disabled={loading}
                className="text-sm"
              >
                Resend Code
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setStep('phone')}
                disabled={loading}
                className="text-sm"
              >
                Change Phone Number
              </Button>
            </div>
          </div>
        )}

        {onCancel && (
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="w-full"
          >
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  );
} 