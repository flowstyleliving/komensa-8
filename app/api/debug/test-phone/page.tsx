'use client';

import PhoneVerification from '@/components/PhoneVerification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestPhonePage() {
  return (
    <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-lg mb-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-[#3C4858]">
              Test Stytch Phone Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhoneVerification
              onVerificationComplete={(phoneNumber) => {
                alert(`Phone verified successfully: ${phoneNumber}`);
              }}
              onCancel={() => {
                window.location.href = '/';
              }}
            />
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-[#3C4858]/80">
          <p>This is a test page for Stytch phone verification.</p>
          <p className="mt-2">
            <strong>Note:</strong> You'll need to configure your Stytch credentials in the .env file for this to work.
          </p>
        </div>
      </div>
    </div>
  );
} 