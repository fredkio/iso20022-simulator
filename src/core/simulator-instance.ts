import { INITIAL_PARTICIPANTS, INITIAL_ACCOUNTS, INITIAL_CUSTOMERS, INITIAL_LEDGER_ACCOUNTS } from './seed-data';
import { LedgerEngine } from './ledger/ledger-engine';
import { BankCore } from './core-banking/bank-core';
import { SwitchEngine } from './switch/switch-engine';

declare global {
  // eslint-disable-next-line no-var
  var __isoSimulatorState: {
    ledgerEngine: LedgerEngine;
    bankCore: BankCore;
    switchEngine: SwitchEngine;
  } | undefined;
}

export function getSimulatorInstance() {
  if (!globalThis.__isoSimulatorState) {
    const ledgerEngine = new LedgerEngine(INITIAL_LEDGER_ACCOUNTS);
    const bankCore = new BankCore(INITIAL_ACCOUNTS, INITIAL_CUSTOMERS, ledgerEngine);
    const switchEngine = new SwitchEngine(INITIAL_PARTICIPANTS, bankCore);

    globalThis.__isoSimulatorState = {
      ledgerEngine,
      bankCore,
      switchEngine,
    };
  }

  return globalThis.__isoSimulatorState;
}

export function resetSimulatorInstance() {
  const ledgerEngine = new LedgerEngine(INITIAL_LEDGER_ACCOUNTS);
  const bankCore = new BankCore(INITIAL_ACCOUNTS, INITIAL_CUSTOMERS, ledgerEngine);
  const switchEngine = new SwitchEngine(INITIAL_PARTICIPANTS, bankCore);

  globalThis.__isoSimulatorState = {
    ledgerEngine,
    bankCore,
    switchEngine,
  };

  return globalThis.__isoSimulatorState;
}
