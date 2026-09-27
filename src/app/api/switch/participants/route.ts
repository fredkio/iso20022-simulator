import { NextRequest, NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';
import { ParticipantStatus } from '@/types';

export async function GET() {
  const { switchEngine } = getSimulatorInstance();
  return NextResponse.json({ participants: switchEngine.getParticipants() });
}

export async function PATCH(req: NextRequest) {
  try {
    const { code, status } = await req.json();
    if (!code || !status) {
      return NextResponse.json({ error: 'Participant code and status are required' }, { status: 400 });
    }

    const { switchEngine } = getSimulatorInstance();
    switchEngine.setParticipantStatus(code, status as ParticipantStatus);

    return NextResponse.json({
      success: true,
      message: `Participant ${code} status updated to ${status}`,
      participants: switchEngine.getParticipants(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
