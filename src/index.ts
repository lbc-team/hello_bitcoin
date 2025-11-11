import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import axios from 'axios';

// Initialize ECPair with tiny-secp256k1
const ECPair = ECPairFactory(ecc);

// Example: Create a Bitcoin testnet4 address
function createTestnetAddress() {
  const network = bitcoin.networks.testnet;
  const keyPair = ECPair.makeRandom({ network });
  // P2WPKH: Pay to Witness Public Key Hash (SegWit v0)
  const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network });

  console.log('Private Key (WIF):', keyPair.toWIF());
  console.log('Address:', address);

  return { keyPair, address };
}

async function main() {
  console.log('🚀 Hello Bitcoin!');
  console.log('');

  // Create a new testnet address
  const { address } = createTestnetAddress();

  console.log('');
  console.log('✅ TypeScript Bitcoin project is ready!');
}

main().catch(console.error);
