import { NextResponse } from 'next/server';
import { resetSimulatorInstance } from '@/core/simulator-instance';

export async function POST() {
  resetSimulatorInstance();
  return NextResponse.json({ success: true, message: 'Simulation environment reset to initial state' });
}
