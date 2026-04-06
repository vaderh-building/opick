# OPick Session 3 Summary

## Current Status
- Live at https://opick.io (custom domain, Vercel)
- Backend at https://opick-production.up.railway.app (Railway)
- Base Mainnet deployment
- 1 market live: "Who is the GOAT? Messi vs Ronaldo" at 0xA0B4C421D5cd368C235563d50F81965926b05F20
- First trade completed ($2 volume, Ronaldo side)
- GitHub repo: private, https://github.com/vaderh-building/opick

## Contract Addresses (Base Mainnet, chainId 8453)
- OPickFactory: 0xf2bd8D38a96fcb05D625735DF1826b6f190a0362
- USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- Treasury: 0xBc50b0C4c72928c7AE4702D39452BE4aF82e533d
- First Market: 0xA0B4C421D5cd368C235563d50F81965926b05F20

## What was built in this session
- Deployed OPickFactory to Base Mainnet
- Switched all frontend/backend config from Sepolia to Mainnet
- Integrated Privy USDC on-ramp (fundWallet with Pay with card, Transfer from wallet)
- Mobile responsive across all pages
- Docs, Terms, Privacy, Risk Disclosure, Creators pages
- Custom domain opick.io (Namecheap + Vercel)
- Account dropdown menu in navbar
- TOS agreement (non-blocking, inline text)
- Renamed Picks to Opinions throughout
- Create flow redesigned: template-based auto-topic generation, duplicate market detection
- Market refresh endpoint for instant visibility after creation
- Sequential RPC calls to avoid rate limits on Railway
- Price display with 1 decimal place
- Position display on market detail page (YOUR POSITION + Sell All)
- agent-browser skill installed for automated testing

## Known bugs to fix
- Opinions page (/opinions) shows "No opinions yet" even after placing trades. Likely wallet address mismatch between Privy embedded wallet and MetaMask external wallet. Check browser console for debug logs.
- Price chart doesn't update with new data points after trades (still shows flat line at 50%)
- Volume shows as $2,000,000 instead of $2 (likely a decimals formatting issue, USDC has 6 decimals)

## Next priorities
1. Fix Opinions page position detection
2. Fix volume display (divide by 1e6 for USDC decimals)
3. Buy more USDC, create 9 more markets via script
4. Gas sponsorship (paymaster) so users don't need ETH
5. User profiles (display name, avatar)
6. Social media (X @opick_io, Telegram OPick Community)

## Environment
- Privy App ID: cmnjpca6600sj0cl5uj1wfool
- Privy Allowed Origins: localhost:5173, opick-alpha.vercel.app, opick.io
- Railway project: nurturing-mercy
- Node.js v22: export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
- Deployer wallet: 0xBc50b0C4c72928c7AE4702D39452BE4aF82e533d
- User Privy wallet: 0x23Af88F9C866157Cb64f9A8a2161a6771f1E11A1
