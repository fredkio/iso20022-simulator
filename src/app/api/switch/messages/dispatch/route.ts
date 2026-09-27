import { NextRequest, NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let rawXml = '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      rawXml = body.xml || body.rawXml || '';
    } else {
      rawXml = await req.text();
    }

    if (!rawXml || !rawXml.trim()) {
      return NextResponse.json(
        { success: false, error: 'Empty XML payload provided' },
        { status: 400 }
      );
    }

    const { switchEngine } = getSimulatorInstance();
    const result = await switchEngine.processGenericIsoMessage(rawXml.trim());

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error processing ISO message' },
      { status: 500 }
    );
  }
}
