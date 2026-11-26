import { PoolClient } from 'pg';
import { AppError } from '../middleware/errorHandler';

export type TokenTxType =
  | 'WELCOME_BONUS'
  | 'BOOKING_ESCROW'
  | 'TRIP_PAYOUT'
  | 'BOOKING_REFUND'
  | 'ADMIN_ADJUSTMENT';

/**
 * Atomically debits or credits a user's token balance inside an active PostgreSQL transaction
 * using SELECT ... FOR UPDATE row-level locking, then writes an immutable ledger entry.
 */
export async function applyTokenDelta(
  client: PoolClient,
  params: {
    userId: string;
    counterpartyId?: string | null;
    tripId?: string | null;
    bookingId?: string | null;
    txType: TokenTxType;
    delta: number; // Negative for debit, positive for credit
    description: string;
  }
): Promise<{ balanceAfter: number }> {
  const userRow = await client.query<{ token_balance: number }>(
    'SELECT token_balance FROM users WHERE id = $1 FOR UPDATE',
    [params.userId]
  );

  if (userRow.rowCount === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Account not found for token transaction.');
  }

  const currentBalance = userRow.rows[0].token_balance;
  const balanceAfter = currentBalance + params.delta;

  if (balanceAfter < 0) {
    throw new AppError(
      400,
      'INSUFFICIENT_TOKENS',
      `Insufficient Cardinal Tokens. Available: ${currentBalance}, required: ${Math.abs(params.delta)}.`
    );
  }

  await client.query('UPDATE users SET token_balance = $1 WHERE id = $2', [
    balanceAfter,
    params.userId,
  ]);

  await client.query(
    `INSERT INTO token_transactions (
       user_id, counterparty_id, trip_id, booking_id, tx_type, amount, balance_after, description
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.userId,
      params.counterpartyId ?? null,
      params.tripId ?? null,
      params.bookingId ?? null,
      params.txType,
      params.delta,
      balanceAfter,
      params.description,
    ]
  );

  return { balanceAfter };
}
