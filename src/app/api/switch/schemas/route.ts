import { NextResponse } from 'next/server';
import { ISO_MESSAGE_REGISTRY } from '@/core/iso20022/registry';

export async function GET() {
  return NextResponse.json({
    success: true,
    total: ISO_MESSAGE_REGISTRY.length,
    schemas: ISO_MESSAGE_REGISTRY,
  });
}
