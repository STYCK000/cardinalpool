import { Router } from 'express';
import { query } from '../config/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/wallet
 * Returns current Cardinal Token balance, escrowed tokens on upcoming rides,
 * lifetime earned/spent summary, and complete transaction history.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const [userRes, escrowRes, summaryRes, historyRes] = await Promise.all([
      query('SELECT token_balance FROM users WHERE id = $1', [userId]),
      query(
        `SELECT COALESCE(SUM(tokens_escrowed), 0)::int AS escrowed_tokens
         FROM bookings
         WHERE rider_id = $1 AND status IN ('CONFIRMED', 'BOARDED')`,
        [userId]
      ),
      query(
        `SELECT
           COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::int AS total_earned,
           COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::int AS total_spent
         FROM token_transactions
         WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT tx.id, tx.tx_type, tx.amount, tx.balance_after, tx.description, tx.created_at,
                tx.trip_id, tx.booking_id,
                cp.full_name AS counterparty_name
         FROM token_transactions tx
         LEFT JOIN users cp ON cp.id = tx.counterparty_id
         WHERE tx.user_id = $1
         ORDER BY tx.created_at DESC
         LIMIT 100`,
        [userId]
      ),
    ]);

    res.json({
      tokenBalance: userRes.rows[0]?.token_balance ?? 0,
      escrowedTokens: escrowRes.rows[0]?.escrowed_tokens ?? 0,
      totalEarned: summaryRes.rows[0]?.total_earned ?? 0,
      totalSpent: summaryRes.rows[0]?.total_spent ?? 0,
      transactions: historyRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
