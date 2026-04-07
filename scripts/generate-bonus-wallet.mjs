import { Wallet } from 'ethers';

const wallet = Wallet.createRandom();

console.log('=== New Bonus Wallet ===');
console.log('Address:     ', wallet.address);
console.log('Private Key: ', wallet.privateKey);
console.log('========================');
console.log('');
console.log('Next steps:');
console.log('1. Fund this address with USDC on Base');
console.log('2. Add BONUS_WALLET_KEY to Railway env vars');
console.log('3. Do NOT commit the private key to git');
