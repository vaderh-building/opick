# OPick V6 Testing Guide

## Smart Contract Tests (Automated)

Run all V6 contract tests:
```
npx hardhat test test/OPickV6.test.mjs
```

19 test cases covering:
- Factory: market creation, parameter validation
- Betting: both sides, volume cap enforcement, amplifier tracking
- Resolution: auto-resolve at cap, proportional claims, loser reverts, double-claim prevention, tie refund
- Refund: 30-day expiry, creator close, full refund with no fees
- Fee structure: 3% split (1% platform, 1% creator, 1% amplifier), amplifier claim, no amplifier claim on refund
- No sell function: compile-time verification

## Manual E2E Test Script

### Prerequisites
- V6 factory deployed to Base Mainnet (or testnet)
- MetaMask or Privy wallet with USDC on Base
- Frontend running with V6_FACTORY_ADDRESS configured

### Test Scenario: Full Lifecycle

1. **Create V6 market** with $100 volume cap
   - Topic: "Test V6 Market"
   - Side A: "Yes", Side B: "No"
   - Volume cap: $100
   - Verify market appears in V6 market list

2. **User A buys $20 on Side A** (no referrer)
   - Verify progress bar shows 20% ($20 / $100)
   - Verify User A's position shows $20 deposit on Side A

3. **User B buys $30 on Side B via referral link**
   - Use URL: opick.io/m/:id?ref=AMPLIFIER_ADDRESS
   - Verify progress bar shows 50% ($50 / $100)
   - Verify amplifier earnings accrue for referrer

4. **User C buys $50 on Side A** (no referrer)
   - This brings total to $100 = cap reached
   - Market should auto-resolve
   - Side A wins ($70 vs $30)

5. **Verify resolution**
   - Market state shows CLOSED_RESOLVED
   - Winner side (A) highlighted
   - Progress bar shows 100%

6. **Users A and C claim winnings**
   - User A (20/70 of winning side): receives ~$27.71 (after 3% fees)
   - User C (50/70 of winning side): receives ~$69.29 (after 3% fees)
   - User B (loser): cannot claim, gets nothing

7. **Amplifier claims fees**
   - 1% of User B's $30 bet = $0.30
   - Amplifier clicks claim, receives $0.30

8. **Verify fee distribution**
   - Creator received ~$1.00 (1% of $100 pool)
   - Platform (treasury) received ~$1.70 (1% base + unreferred amplifier fees)
   - Amplifier received ~$0.30 (1% of referred bets)
   - Total fees: ~$3.00 (3% of $100)

### Test Scenario: Refund (30-day expiry)

1. Create V6 market with $1000 cap
2. User A bets $50
3. Wait 30 days (or use testnet time manipulation)
4. Anyone calls checkAndResolve()
5. User A claims full $50 refund
6. No fees collected

### Test Scenario: Creator Close

1. Create V6 market with $500 cap
2. User A bets $100, User B bets $50
3. Creator clicks "Close market and refund all"
4. User A claims $100, User B claims $50
5. No fees collected
