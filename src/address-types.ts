import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairInterface } from 'ecpair';

// Initialize ECC library for bitcoinjs-lib (required for Taproot)
bitcoin.initEccLib(ecc);

// Initialize ECPair with tiny-secp256k1
const ECPair = ECPairFactory(ecc);

// Helper function to convert Buffer to hex string
function toHex(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('hex');
}

/**
 * 生成 P2PKH (Legacy) 地址
 * Pay to Public Key Hash - 最早的比特币地址格式
 * 地址以 '1' 开头（主网）或 'm/n' 开头（测试网）
 */
function generateP2PKH(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n📍 P2PKH (Legacy Address)');
  console.log('='.repeat(60));

  const pubkey = keyPair.publicKey;
  console.log('1. 公钥 (Public Key):');
  console.log('   ', toHex(pubkey));

  const pubkeyHash = bitcoin.crypto.hash160(pubkey);
  console.log('\n2. 公钥哈希 (HASH160 = RIPEMD160(SHA256(pubkey))):');
  console.log('   ', toHex(pubkeyHash));

  const { address, output } = bitcoin.payments.p2pkh({
    pubkey,
    network
  });

  console.log('\n3. 锁定脚本 (ScriptPubKey):');
  console.log('   ', output ? toHex(output) : 'N/A');
  console.log('   解析: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG');

  console.log('\n4. 地址 (Address):');
  console.log('   ', address);
  console.log('   特点: 以 "m/n" 开头（测试网）或 "1" 开头（主网）');

  return { address, output };
}

/**
 * 生成 P2SH-P2WPKH (嵌套 SegWit) 地址
 * Pay to Script Hash wrapping Pay to Witness Public Key Hash
 * 这是一种兼容性 SegWit 格式
 * 地址以 '3' 开头（主网）或 '2' 开头（测试网）
 */
function generateP2SH_P2WPKH(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n📍 P2SH-P2WPKH (Nested SegWit Address)');
  console.log('='.repeat(60));

  const pubkey = keyPair.publicKey;
  console.log('1. 公钥 (Public Key):');
  console.log('   ', toHex(pubkey));

  // 首先创建 P2WPKH
  const p2wpkh = bitcoin.payments.p2wpkh({
    pubkey,
    network
  });

  console.log('\n2. P2WPKH 赎回脚本 (Witness Program):');
  console.log('   ', p2wpkh.output ? toHex(p2wpkh.output) : 'N/A');
  console.log('   解析: OP_0 <pubKeyHash>');

  // 然后包装在 P2SH 中
  const { address, output, redeem } = bitcoin.payments.p2sh({
    redeem: p2wpkh,
    network
  });

  const scriptHash = bitcoin.crypto.hash160(redeem!.output!);
  console.log('\n3. 脚本哈希 (HASH160(redeemScript)):');
  console.log('   ', toHex(scriptHash));

  console.log('\n4. 锁定脚本 (ScriptPubKey):');
  console.log('   ', output ? toHex(output) : 'N/A');
  console.log('   解析: OP_HASH160 <scriptHash> OP_EQUAL');

  console.log('\n5. 地址 (Address):');
  console.log('   ', address);
  console.log('   特点: 以 "2" 开头（测试网）或 "3" 开头（主网）');
  console.log('   用途: 兼容旧钱包的 SegWit 地址');

  return { address, output };
}

/**
 * 生成 P2WPKH (Native SegWit) 地址
 * Pay to Witness Public Key Hash - 原生隔离见证
 * 地址以 'bc1q' 开头（主网）或 'tb1q' 开头（测试网）
 */
function generateP2WPKH(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n📍 P2WPKH (Native SegWit / Bech32 Address)');
  console.log('='.repeat(60));

  const pubkey = keyPair.publicKey;
  console.log('1. 公钥 (Public Key):');
  console.log('   ', toHex(pubkey));

  const pubkeyHash = bitcoin.crypto.hash160(pubkey);
  console.log('\n2. 公钥哈希 (HASH160):');
  console.log('   ', toHex(pubkeyHash));

  const { address, output } = bitcoin.payments.p2wpkh({
    pubkey,
    network
  });

  console.log('\n3. 见证程序 (Witness Program):');
  console.log('   版本: 0');
  console.log('   数据: ', toHex(pubkeyHash));

  console.log('\n4. 锁定脚本 (ScriptPubKey):');
  console.log('   ', output ? toHex(output) : 'N/A');
  console.log('   解析: OP_0 <pubKeyHash>');

  console.log('\n5. 地址 (Bech32 Address):');
  console.log('   ', address);
  console.log('   特点: 以 "tb1q" 开头（测试网）或 "bc1q" 开头（主网）');
  console.log('   优势: 更低的交易费用，更好的错误检测');

  return { address, output };
}

/**
 * 生成 P2WSH (Native SegWit Script) 地址
 * Pay to Witness Script Hash - 原生隔离见证脚本哈希
 * 用于多重签名或其他复杂脚本
 * 地址以 'bc1q' 开头（主网）或 'tb1q' 开头（测试网），但比 P2WPKH 更长
 */
function generateP2WSH(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n📍 P2WSH (Native SegWit Script Hash Address)');
  console.log('='.repeat(60));

  const pubkey = keyPair.publicKey;
  console.log('1. 公钥 (Public Key):');
  console.log('   ', toHex(pubkey));

  // 创建一个简单的 1-of-1 多签脚本作为演示
  // 实际应用中，P2WSH 常用于 m-of-n 多重签名
  const p2ms = bitcoin.payments.p2ms({
    m: 1,
    pubkeys: [pubkey],
    network
  });

  console.log('\n2. 见证脚本 (Witness Script):');
  console.log('   ', p2ms.output ? toHex(p2ms.output) : 'N/A');
  console.log('   解析: OP_1 <pubkey> OP_1 OP_CHECKMULTISIG');
  console.log('   说明: 这是一个 1-of-1 多签脚本（演示用）');

  const { address, output } = bitcoin.payments.p2wsh({
    redeem: p2ms,
    network
  });

  // 从生成的 output 中提取 scriptHash（去除 OP_0 和长度字节）
  const scriptHash = output ? output.slice(2) : Buffer.alloc(32);
  console.log('\n3. 脚本哈希 (SHA256(witnessScript)):');
  console.log('   ', toHex(scriptHash));
  console.log('   说明: P2WSH 使用 SHA256（32字节），而 P2WPKH 使用 HASH160（20字节）');

  console.log('\n4. 锁定脚本 (ScriptPubKey):');
  console.log('   ', output ? toHex(output) : 'N/A');
  console.log('   解析: OP_0 <scriptHash>');

  console.log('\n5. 地址 (Bech32 Address):');
  console.log('   ', address);
  console.log('   特点: 以 "tb1q" 开头（测试网）或 "bc1q" 开头（主网）');
  console.log('   区别: 比 P2WPKH 地址更长（62 vs 42 字符）');
  console.log('   用途: 多重签名、时间锁、复杂条件脚本');

  return { address, output };
}

/**
 * 生成 P2TR (Taproot) 地址
 * Pay to Taproot - 最新的比特币地址格式（SegWit v1）
 * 地址以 'bc1p' 开头（主网）或 'tb1p' 开头（测试网）
 */
function generateP2TR(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n📍 P2TR (Taproot / Bech32m Address)');
  console.log('='.repeat(60));

  const pubkey = keyPair.publicKey;
  console.log('1. 原始公钥 (Public Key):');
  console.log('   ', toHex(pubkey));

  // Taproot 使用 x-only 公钥（只有 x 坐标）
  const internalPubkey = pubkey.slice(1, 33);
  console.log('\n2. 内部公钥 (X-only Public Key):');
  console.log('   ', toHex(internalPubkey));
  console.log('   说明: 移除了前缀字节，只保留 32 字节的 x 坐标');

  const { address, output } = bitcoin.payments.p2tr({
    internalPubkey,
    network
  });

  console.log('\n3. 见证程序 (Witness Program):');
  console.log('   版本: 1');
  if (output) {
    console.log('   输出公钥: ', toHex(output.slice(2)));
  }

  console.log('\n4. 锁定脚本 (ScriptPubKey):');
  console.log('   ', output ? toHex(output) : 'N/A');
  console.log('   解析: OP_1 <tweaked_pubkey>');

  console.log('\n5. 地址 (Bech32m Address):');
  console.log('   ', address);
  console.log('   特点: 以 "tb1p" 开头（测试网）或 "bc1p" 开头（主网）');
  console.log('   优势: 更高的隐私性，支持复杂脚本，更低费用');

  return { address, output };
}

/**
 * 主函数：演示所有地址类型
 */
async function main() {
  console.log('🔐 Bitcoin 地址类型完整演示');
  console.log('='.repeat(60));

  // 使用测试网
  const network = bitcoin.networks.testnet;

  // 生成一个随机密钥对
  const keyPair = ECPair.makeRandom({ network });

  console.log('\n🔑 密钥信息:');
  console.log('='.repeat(60));
  console.log('私钥 (WIF):', keyPair.toWIF());
  if (keyPair.privateKey) {
    console.log('私钥 (Hex):', toHex(keyPair.privateKey));
  }
  console.log('公钥 (Hex):', toHex(keyPair.publicKey));
  console.log('公钥类型:', keyPair.compressed ? '压缩 (33 bytes)' : '未压缩 (65 bytes)');

  // 生成各种类型的地址
  const p2pkh = generateP2PKH(keyPair, network);
  const p2sh = generateP2SH_P2WPKH(keyPair, network);
  const p2wpkh = generateP2WPKH(keyPair, network);
  const p2wsh = generateP2WSH(keyPair, network);
  const p2tr = generateP2TR(keyPair, network);

  // 总结
  console.log('\n\n📊 地址总结');
  console.log('='.repeat(60));
  console.log('P2PKH (Legacy):     ', p2pkh.address);
  console.log('P2SH-P2WPKH (包装): ', p2sh.address);
  console.log('P2WPKH (SegWit):    ', p2wpkh.address);
  console.log('P2WSH (SegWit脚本): ', p2wsh.address);
  console.log('P2TR (Taproot):     ', p2tr.address);

  console.log('\n💡 使用建议:');
  console.log('  • P2PKH:      兼容性最好，但交易费用最高（不推荐新应用）');
  console.log('  • P2SH-P2WPKH: 用于需要兼容旧钱包的 SegWit 交易');
  console.log('  • P2WPKH:     推荐使用，费用较低，广泛支持');
  console.log('  • P2WSH:      用于多重签名、时间锁等复杂脚本场景');
  console.log('  • P2TR:       最新标准，隐私性和效率最高（需要钱包支持）');

  console.log('\n✅ 演示完成！');
}

// 运行演示
main().catch(console.error);
