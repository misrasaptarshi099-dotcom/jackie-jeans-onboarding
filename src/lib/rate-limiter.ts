import { NextRequest } from 'next/server';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const tracker = new Map<string, RateLimitInfo>();

/**
 * Basic in-memory rate limiter for Next.js API Routes.
 * 
 * @param req NextRequest object
 * @param limit Max allowed requests within the window
 * @param windowMs Time window in milliseconds (default: 1 minute)
 */
export function rateLimiter(req: NextRequest, limit: number = 30, windowMs: number = 60 * 1000) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1';
  const now = Date.now();
  
  let record = tracker.get(ip);
  
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    tracker.set(ip, record);
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: record.resetTime,
    };
  }
  
  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: record.resetTime,
    };
  }
  
  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: record.resetTime,
  };
}
