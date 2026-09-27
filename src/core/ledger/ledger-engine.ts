import { LedgerAccount, JournalEntry, JournalLine } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface PostDoubleEntryInput {
  institutionId: string;
  transactionId: string;
  reference: string;
  description: string;
  debitAccountId: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  amount: number;
}

export class LedgerEngine {
  private ledgerAccounts: Map<string, LedgerAccount>;
  private journalEntries: JournalEntry[] = [];

  constructor(initialLedgerAccounts: LedgerAccount[]) {
    this.ledgerAccounts = new Map();
    initialLedgerAccounts.forEach((acc) => {
      this.ledgerAccounts.set(acc.id, { ...acc });
    });
  }

  public getAccountsByInstitution(institutionId: string): LedgerAccount[] {
    return Array.from(this.ledgerAccounts.values()).filter(
      (acc) => acc.institutionId === institutionId
    );
  }

  public getAccount(accountId: string): LedgerAccount | undefined {
    return this.ledgerAccounts.get(accountId);
  }

  public getJournalEntries(transactionId?: string, institutionId?: string): JournalEntry[] {
    return this.journalEntries.filter((entry) => {
      if (transactionId && entry.transactionId !== transactionId) return false;
      if (institutionId && entry.institutionId !== institutionId) return false;
      return true;
    });
  }

  public postJournalEntry(input: PostDoubleEntryInput): JournalEntry {
    const debitAcc = this.ledgerAccounts.get(input.debitAccountId);
    const creditAcc = this.ledgerAccounts.get(input.creditAccountId);

    if (!debitAcc || !creditAcc) {
      throw new Error(`Ledger posting failed: One or both ledger accounts not found: ${input.debitAccountId}, ${input.creditAccountId}`);
    }

    // Update balances according to account types
    // For Liability: Debit decreases balance, Credit increases balance
    // For Asset: Debit increases balance, Credit decreases balance
    if (debitAcc.type === 'LIABILITY') {
      debitAcc.balance -= input.amount;
    } else {
      debitAcc.balance += input.amount;
    }

    if (creditAcc.type === 'LIABILITY') {
      creditAcc.balance += input.amount;
    } else {
      creditAcc.balance -= input.amount;
    }

    const lines: JournalLine[] = [
      {
        id: uuidv4(),
        ledgerAccountId: debitAcc.id,
        ledgerAccountName: `${debitAcc.code} - ${debitAcc.name}`,
        direction: 'DEBIT',
        amount: input.amount,
      },
      {
        id: uuidv4(),
        ledgerAccountId: creditAcc.id,
        ledgerAccountName: `${creditAcc.code} - ${creditAcc.name}`,
        direction: 'CREDIT',
        amount: input.amount,
      },
    ];

    const entry: JournalEntry = {
      id: uuidv4(),
      institutionId: input.institutionId,
      transactionId: input.transactionId,
      reference: input.reference,
      description: input.description,
      postedAt: new Date().toISOString(),
      lines,
    };

    this.journalEntries.unshift(entry);
    return entry;
  }
}
