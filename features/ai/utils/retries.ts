/**
 * Mobile-aware retry logic for OpenAI API calls
 * Handles network interruptions, timeouts, and mobile-specific errors
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  isMobile?: boolean;
}

export async function runWithMobileRetries<T>(
  operation: () => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = options.isMobile ? 5 : 3,
    initialDelay = options.isMobile ? 2000 : 1000,
    maxDelay = options.isMobile ? 8000 : 5000,
    isMobile = false
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Determine if this error is retryable
      const isRetryable = isRetryableError(error, isMobile);
      if (!isRetryable) {
        console.log(`[Mobile Retry] Non-retryable error, failing immediately:`, error.message);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      
      console.log(
        `[Mobile Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed (mobile: ${isMobile}), ` +
        `retrying in ${delay}ms. Error: ${error.message}`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isRetryableError(error: any, isMobile: boolean): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code;
  const statusCode = error?.response?.status || error?.status;

  // Always retry these error types
  const networkErrors = [
    'ENOTFOUND',
    'ECONNRESET', 
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH'
  ];

  const timeoutErrors = [
    'timeout',
    'timed out',
    'connection timeout',
    'request timeout'
  ];

  const connectionErrors = [
    'network error',
    'connection failed',
    'connection lost',
    'socket hang up',
    'parse error',
    'aborted'
  ];

  // Check error codes
  if (networkErrors.includes(errorCode)) {
    return true;
  }

  // Check error messages
  if (timeoutErrors.some(keyword => errorMessage.includes(keyword))) {
    return true;
  }

  if (connectionErrors.some(keyword => errorMessage.includes(keyword))) {
    return true;
  }

  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 502, 503, 504, 520, 521, 522, 523, 524];
  if (retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  // Mobile-specific retryable conditions
  if (isMobile) {
    const mobileSpecificErrors = [
      'failed to fetch',
      'network request failed',
      'load failed',
      'the internet connection appears to be offline',
      'a network error occurred'
    ];

    if (mobileSpecificErrors.some(keyword => errorMessage.includes(keyword))) {
      return true;
    }

    // On mobile, be more aggressive about retrying unknown errors
    // since mobile networks are less reliable
    if (!statusCode && !errorCode && errorMessage) {
      console.log(`[Mobile Retry] Unknown error on mobile, attempting retry: ${errorMessage}`);
      return true;
    }
  }

  // OpenAI-specific retryable errors
  if (errorMessage.includes('rate limit') || statusCode === 429) {
    return true;
  }

  if (errorMessage.includes('server error') || statusCode >= 500) {
    return true;
  }

  return false;
}

/**
 * Enhanced retry specifically for OpenAI operations
 */
export async function retryOpenAIOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  isMobile: boolean = false
): Promise<T> {
  return runWithMobileRetries(operation, {
    maxRetries: isMobile ? 4 : 3,
    initialDelay: isMobile ? 1500 : 1000,
    maxDelay: isMobile ? 6000 : 4000,
    isMobile
  });
}

/**
 * Network quality check for mobile devices
 */
export function checkNetworkQuality(): { isGood: boolean; effectiveType?: string; downlink?: number } {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return { isGood: true }; // Assume good if we can't detect
  }

  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType;
  const downlink = connection?.downlink;

  // Consider network "good" if:
  // - Effective type is 3g or better
  // - Downlink is > 1.5 Mbps
  const goodTypes = ['3g', '4g'];
  const isGoodType = !effectiveType || goodTypes.includes(effectiveType);
  const isGoodSpeed = !downlink || downlink > 1.5;

  return {
    isGood: isGoodType && isGoodSpeed,
    effectiveType,
    downlink
  };
}