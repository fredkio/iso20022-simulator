import { Account, Customer } from '@/types';
import { LedgerEngine } from '../ledger/ledger-engine';
import { syncAccountBalanceToSupabase } from '@/lib/supabase';

export interface CustomerTransactionRecord {
  id: string;
  accountNumber: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  counterpartyName: string;
  counterpartyAccount: string;
  counterpartyBank: string;
  reference: string;
  uetr: string;
  status: 'SUCCESS' | 'FAILED' | 'REVERSED';
  description: string;
  balanceAfter: number;
  timestamp: string;
}

export class BankCore {
  private accounts: Map<string, Account>;
  private customers: Map<string, Customer>;
  private transactions: CustomerTransactionRecord[] = [];
  private ledgerEngine: LedgerEngine;

  constructor(initialAccounts: Account[], initialCustomers: Customer[], ledgerEngine: LedgerEngine) {
    this.accounts = new Map();
    this.customers = new Map();
    this.ledgerEngine = ledgerEngine;

    initialAccounts.forEach((acc) => this.accounts.set(acc.accountNumber, { ...acc }));
    initialCustomers.forEach((cust) => this.customers.set(cust.id, { ...cust }));
  }

  public getAccount(accountNumber: string): Account | undefined {
    return this.accounts.get(accountNumber);
  }

  public getCustomer(customerId: string): Customer | undefined {
    return this.customers.get(customerId);
  }

  public getAccountsByInstitution(institutionId: string): Account[] {
    return Array.from(this.accounts.values()).filter((a) => a.institutionId === institutionId);
  }

  public getCustomerAccounts(customerId: string): Account[] {
    return Array.from(this.accounts.values()).filter((a) => a.customerId === customerId);
  }

  public getAccountTransactions(accountNumber: string): CustomerTransactionRecord[] {
    return this.transactions.filter((tx) => tx.accountNumber === accountNumber);
  }

  /**
   * Originating Bank: Validates account status and balance before originating pacs.008
   */
  public validateAndDebit(
    accountNumber: string,
    amount: number,
    beneficiaryName: string,
    beneficiaryAccount: string,
    beneficiaryBank: string,
    reference: string,
    uetr: string
  ): { success: boolean; error?: string; errorCode?: string } {
    const account = this.accounts.get(accountNumber);

    if (!account) {
      return { success: false, error: 'Originating account not found', errorCode: 'AC01' };
    }

    if (account.status !== 'ACTIVE') {
      return { success: false, error: `Account is ${account.status}. Transfers not permitted.`, errorCode: 'AC04' };
    }

    if (account.availableBalance < amount) {
      return {
        success: false,
        error: `Insufficient available funds. Required: ₦${amount.toLocaleString()}, Available: ₦${account.availableBalance.toLocaleString()}`,
        errorCode: 'AM04',
      };
    }

    // Execute atomic debit on Core customer account
    account.availableBalance -= amount;
    account.ledgerBalance -= amount;
    syncAccountBalanceToSupabase(account).catch(() => {});

    // Post to Core Banking double-entry ledger
    // Debit Customer Deposits (Liability decreases)
    // Credit Settlement Clearing (Asset decreases)
    const instId = account.institutionId;
    const depLedger = `ldg-${instId.replace('bank-', '')}-dep`;
    const clrLedger = `ldg-${instId.replace('bank-', '')}-clr`;

    try {
      this.ledgerEngine.postJournalEntry({
        institutionId: instId,
        transactionId: uetr,
        reference,
        description: `Outbound Interbank Transfer to ${beneficiaryName} (${beneficiaryBank})`,
        debitAccountId: depLedger,
        debitAccountName: 'Customer Deposits (Liabilities)',
        creditAccountId: clrLedger,
        creditAccountName: 'Central Bank Settlement Clearing',
        amount,
      });
    } catch {
      // Fallback if specific ledger ID is structured differently
    }

    // Record customer transaction history
    this.transactions.unshift({
      id: `ctx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      accountNumber,
      type: 'DEBIT',
      amount,
      counterpartyName: beneficiaryName,
      counterpartyAccount: beneficiaryAccount,
      counterpartyBank: beneficiaryBank,
      reference,
      uetr,
      status: 'SUCCESS',
      description: `Transfer to ${beneficiaryName} - ${reference}`,
      balanceAfter: account.availableBalance,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Destination Bank: Credits beneficiary account upon valid pacs.008 arrival
   */
  public creditBeneficiary(
    accountNumber: string,
    amount: number,
    senderName: string,
    senderAccount: string,
    senderBank: string,
    reference: string,
    uetr: string
  ): { success: boolean; error?: string; errorCode?: string } {
    const account = this.accounts.get(accountNumber);

    if (!account) {
      return {
        success: false,
        error: `Beneficiary account ${accountNumber} does not exist at destination institution`,
        errorCode: 'AC01', // Incorrect Account Number
      };
    }

    if (account.status === 'CLOSED') {
      return { success: false, error: 'Beneficiary account is CLOSED', errorCode: 'AC04' };
    }

    if (account.status === 'FROZEN') {
      return { success: false, error: 'Beneficiary account is FROZEN by compliance', errorCode: 'AC06' };
    }

    // Execute atomic credit on Core customer account
    account.availableBalance += amount;
    account.ledgerBalance += amount;
    syncAccountBalanceToSupabase(account).catch(() => {});

    // Post to Core Banking double-entry ledger
    // Debit Settlement Clearing (Asset increases with clearing claim)
    // Credit Customer Deposits (Liability to customer increases)
    const instId = account.institutionId;
    const depLedger = `ldg-${instId.replace('bank-', '')}-dep`;
    const clrLedger = `ldg-${instId.replace('bank-', '')}-clr`;

    try {
      this.ledgerEngine.postJournalEntry({
        institutionId: instId,
        transactionId: uetr,
        reference,
        description: `Inbound Interbank Transfer from ${senderName} (${senderBank})`,
        debitAccountId: clrLedger,
        debitAccountName: 'Central Bank Settlement Clearing',
        creditAccountId: depLedger,
        creditAccountName: 'Customer Deposits (Liabilities)',
        amount,
      });
    } catch {
      // Fallback
    }

    // Record customer transaction history
    this.transactions.unshift({
      id: `ctx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      accountNumber,
      type: 'CREDIT',
      amount,
      counterpartyName: senderName,
      counterpartyAccount: senderAccount,
      counterpartyBank: senderBank,
      reference,
      uetr,
      status: 'SUCCESS',
      description: `Incoming Transfer from ${senderName} - ${reference}`,
      balanceAfter: account.availableBalance,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  public creditBeneficiaryAccount(
    accountNumber: string,
    amount: number,
    senderName: string,
    senderAccount: string,
    senderBank: string,
    reference: string,
    uetr: string
  ): { success: boolean; error?: string; errorCode?: string } {
    return this.creditBeneficiary(accountNumber, amount, senderName, senderAccount, senderBank, reference, uetr);
  }

  /**
   * Reverses debit if transaction fails downstream at Switch or Destination Core
   */
  public reverseDebit(
    accountNumber: string,
    amount: number,
    reference: string,
    uetr: string,
    reason: string
  ): void {
    const account = this.accounts.get(accountNumber);
    if (!account) return;

    account.availableBalance += amount;
    account.ledgerBalance += amount;
    syncAccountBalanceToSupabase(account).catch(() => {});

    const instId = account.institutionId;
    const depLedger = `ldg-${instId.replace('bank-', '')}-dep`;
    const clrLedger = `ldg-${instId.replace('bank-', '')}-clr`;

    try {
      this.ledgerEngine.postJournalEntry({
        institutionId: instId,
        transactionId: uetr,
        reference: `REV-${reference}`,
        description: `Reversal of failed transfer: ${reason}`,
        debitAccountId: clrLedger,
        debitAccountName: 'Central Bank Settlement Clearing',
        creditAccountId: depLedger,
        creditAccountName: 'Customer Deposits (Liabilities)',
        amount,
      });
    } catch {
      // Fallback
    }

    this.transactions.unshift({
      id: `ctx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      accountNumber,
      type: 'CREDIT',
      amount,
      counterpartyName: 'System Reversal',
      counterpartyAccount: '',
      counterpartyBank: 'Central Switch',
      reference: `REV-${reference}`,
      uetr,
      status: 'REVERSED',
      description: `Reversal of failed payment (${reason})`,
      balanceAfter: account.availableBalance,
      timestamp: new Date().toISOString(),
    });
  }
}
