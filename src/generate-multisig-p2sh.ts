import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Helper function to convert Buffer to hex string
function toHex(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('hex');
}

/**
 * 生成 P2SH 多签地址（2-of-2）
 * 使用 PRIVATE_KEY1 和 PRIVATE_KEY2
 */
async function main() {
  console.log('🔐 P2SH 多签地址生成（2-of-2）');
  console.log('='.repeat(60));

  // 1. 加载私钥
  const privateKey1WIF = process.env.PRIVATE_KEY1;
  const privateKey2WIF = process.env.PRIVATE_KEY2;

  if (!privateKey1WIF || !privateKey2WIF) {
    throw new Error('未找到 PRIVATE_KEY1 或 PRIVATE_KEY2 环境变量');
  }

  // 2. 创建密钥对
  const network = bitcoin.networks.testnet;
  const keyPair1 = ECPair.fromWIF(privateKey1WIF, network);
  const keyPair2 = ECPair.fromWIF(privateKey2WIF, network);

  console.log('\n🔑 密钥信息:');
  console.log('='.repeat(60));
  console.log('密钥对 1:');
  console.log('  私钥 (WIF):', privateKey1WIF);
  console.log('  公钥 (Hex):', toHex(keyPair1.publicKey));

  console.log('\n密钥对 2:');
  console.log('  私钥 (WIF):', privateKey2WIF);
  console.log('  公钥 (Hex):', toHex(keyPair2.publicKey));

  // 3. 创建 2-of-2 多签赎回脚本
  const pubkeys = [keyPair1.publicKey, keyPair2.publicKey].sort(Buffer.compare);

  console.log('\n📝 多签配置:');
  console.log('='.repeat(60));
  console.log('签名要求: 2-of-2 (需要两个签名)');
  console.log('公钥数量: 2');
  console.log('排序后的公钥:');
  pubkeys.forEach((pubkey, index) => {
    console.log(`  [${index + 1}] ${toHex(pubkey)}`);
  });

  // 4. 创建 P2SH 多签地址
  const p2ms = bitcoin.payments.p2ms({
    m: 2,
    pubkeys: pubkeys,
    network
  });

  console.log('\n📜 赎回脚本 (Redeem Script):');
  console.log('  ', p2ms.output ? toHex(p2ms.output) : 'N/A');
  console.log('  解析: OP_2 <pubkey1> <pubkey2> OP_2 OP_CHECKMULTISIG');

  const p2sh = bitcoin.payments.p2sh({
    redeem: p2ms,
    network
  });

  const scriptHash = bitcoin.crypto.hash160(p2ms.output!);
  console.log('\n🔐 脚本哈希 (HASH160(redeemScript)):');
  console.log('  ', toHex(scriptHash));

  console.log('\n📍 锁定脚本 (ScriptPubKey):');
  console.log('  ', p2sh.output ? toHex(p2sh.output) : 'N/A');
  console.log('  解析: OP_HASH160 <scriptHash> OP_EQUAL');

  console.log('\n🏠 P2SH 多签地址:');
  console.log('  ', p2sh.address);
  console.log('  特点: 以 "2" 开头（测试网）或 "3" 开头（主网）');
  console.log('  用途: 需要 2 个签名才能花费此地址的资金');

  // 5. 同时生成 PRIVATE_KEY1 的 P2SH-P2WPKH 地址（用于接收）
  console.log('\n\n📍 接收方地址（PRIVATE_KEY1 的 P2SH-P2WPKH）:');
  console.log('='.repeat(60));

  const p2wpkh = bitcoin.payments.p2wpkh({
    pubkey: keyPair1.publicKey,
    network
  });

  const p2sh_p2wpkh = bitcoin.payments.p2sh({
    redeem: p2wpkh,
    network
  });

  console.log('地址:', p2sh_p2wpkh.address);

  // 6. 保存信息到 .env（建议手动添加）
  console.log('\n\n💾 建议添加到 .env 文件:');
  console.log('='.repeat(60));
  console.log(`MULTISIG_P2SH_ADDRESS=${p2sh.address}`);
  console.log(`MULTISIG_REDEEM_SCRIPT=${p2ms.output ? toHex(p2ms.output) : ''}`);
  console.log(`P2SH_P2WPKH_ADDR_1=${p2sh_p2wpkh.address}`);

  console.log('\n\n📋 使用步骤:');
  console.log('='.repeat(60));
  console.log('1. 将上述信息添加到 .env 文件');
  console.log('2. 向多签地址 ' + p2sh.address + ' 发送测试币');
  console.log('3. 等待确认后，使用 send-from-multisig-p2sh.ts 发送交易');
  console.log('4. 访问 https://mempool.space/testnet4/address/' + p2sh.address + ' 查看地址余额');

  console.log('\n✅ 多签地址生成完成！');
}

// 运行主函数
main().catch(error => {
  console.error('\n❌ 错误:', error instanceof Error ? error.message : error);
  process.exit(1);
});
