import { NextRequest, NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let payload: any = {};

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const text = await req.text();
      if (text.trim().startsWith('<')) {
        payload = { rawXml: text.trim() };
      }
    }

    const { switchEngine } = getSimulatorInstance();
    const result = await switchEngine.executeDirectDebitWorkflow(payload);

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error executing direct debit workflow' },
      { status: 500 }
    );
  }
}
