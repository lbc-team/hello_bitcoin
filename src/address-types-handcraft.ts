import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import * as crypto from 'crypto';

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Helper function to convert Buffer to hex string
function toHex(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('hex');
}

/**
 * Base58 字符集
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * 手动实现 Base58 编码
 */
function base58Encode(buffer: Buffer): string {
  let num = BigInt('0x' + buffer.toString('hex'));
  let encoded = '';

  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  // 处理前导零字节
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    encoded = '1' + encoded;
  }

  return encoded;
}

/**
 * 手动实现 Base58Check 编码
 */
function base58CheckEncode(version: number, payload: Buffer): string {
  console.log('   📝 Base58Check 编码过程:');

  // 步骤 1: 添加版本字节
  const versionByte = Buffer.from([version]);
  console.log(`      1️⃣  版本字节: ${toHex(versionByte)} (${version})`);

  const versionedPayload = Buffer.concat([versionByte, payload]);
  console.log(`      2️⃣  版本+载荷: ${toHex(versionedPayload)}`);

  // 步骤 2: 计算校验和 (Double SHA256 的前 4 字节)
  const hash1 = crypto.createHash('sha256').update(versionedPayload).digest();
  console.log(`      3️⃣  SHA256(#1): ${toHex(hash1)}`);

  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  console.log(`      4️⃣  SHA256(#2): ${toHex(hash2)}`);

  const checksum = hash2.slice(0, 4);
  console.log(`      5️⃣  校验和 (前4字节): ${toHex(checksum)}`);

  // 步骤 3: 拼接所有数据
  const fullPayload = Buffer.concat([versionedPayload, checksum]);
  console.log(`      6️⃣  完整数据: ${toHex(fullPayload)}`);
  console.log(`          = ${toHex(versionByte)} + ${toHex(payload)} + ${toHex(checksum)}`);

  // 步骤 4: Base58 编码
  const address = base58Encode(fullPayload);
  console.log(`      7️⃣  Base58 编码: ${address}`);

  return address;
}

/**
 * Bech32 字符集
 */
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/**
 * 手动实现 Bech32 polymod (用于校验和计算)
 */
function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;

  for (const value of values) {
    const top = chk >> 25;
    chk = (chk & 0x1ffffff) << 5 ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }

  return chk;
}

/**
 * HRP (Human Readable Part) 扩展
 */
function bech32HrpExpand(hrp: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) >> 5);
  }
  result.push(0);
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) & 31);
  }
  return result;
}

/**
 * 创建 Bech32 校验和
 */
function bech32CreateChecksum(hrp: string, data: number[]): number[] {
  const values = bech32HrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const polymod = bech32Polymod(values) ^ 1;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  return checksum;
}

/**
 * 转换 8-bit 到 5-bit
 */
function convertBits(data: Buffer, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxv = (1 << toBits) - 1;

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    acc = (acc << fromBits) | value;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error('Invalid bits conversion');
  }

  return result;
}

/**
 * 手动实现 Bech32 编码
 */
function bech32Encode(hrp: string, version: number, program: Buffer): string {
  console.log('   📝 Bech32 编码过程:');
  console.log(`      1️⃣  HRP (人类可读部分): "${hrp}"`);
  console.log(`      2️⃣  见证版本: ${version}`);
  console.log(`      3️⃣  见证程序 (原始): ${toHex(program)}`);

  // 转换 8-bit 到 5-bit
  const data = convertBits(program, 8, 5, true);
  console.log(`      4️⃣  转换为 5-bit 数组: [${data.join(', ')}]`);

  // 完整数据 = 版本 + 程序数据
  const fullData = [version].concat(data);
  console.log(`      5️⃣  完整数据 (版本+程序): [${fullData.join(', ')}]`);

  // 创建校验和
  const checksum = bech32CreateChecksum(hrp, fullData);
  console.log(`      6️⃣  校验和 (6个字符): [${checksum.join(', ')}]`);

  // 编码
  const combined = fullData.concat(checksum);
  let encoded = '';
  for (const value of combined) {
    encoded += BECH32_CHARSET[value];
  }

  const address = hrp + '1' + encoded;
  console.log(`      7️⃣  Bech32 编码: ${address}`);
  console.log(`          = "${hrp}" + "1" + "${encoded}"`);

  return address;
}

/**
 * 手动生成 P2PKH 地址（展示每一步细节）
 */
function generateP2PKH_Handcraft(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n🔧 P2PKH (Legacy Address) - 手工构造');
  console.log('='.repeat(80));

  // 步骤 1: 获取公钥
  const pubkey = keyPair.publicKey;
  console.log('\n📌 步骤 1: 公钥');
  console.log(`   类型: ${pubkey.length === 33 ? '压缩' : '未压缩'} (${pubkey.length} bytes)`);
  console.log(`   Hex: ${toHex(pubkey)}`);

  // 步骤 2: SHA256 哈希
  const sha256Hash = crypto.createHash('sha256').update(pubkey).digest();
  console.log('\n📌 步骤 2: SHA256(公钥)');
  console.log(`   结果: ${toHex(sha256Hash)}`);

  // 步骤 3: RIPEMD160 哈希
  const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  console.log('\n📌 步骤 3: RIPEMD160(SHA256(公钥)) = HASH160');
  console.log(`   结果: ${toHex(ripemd160Hash)} (20 bytes)`);
  console.log('   这就是 pubKeyHash！');

  // 步骤 4: Base58Check 编码
  console.log('\n📌 步骤 4: Base58Check 编码');
  const version = network === bitcoin.networks.bitcoin ? 0x00 : 0x6f; // 主网: 0, 测试网: 111
  console.log(`   网络: ${network === bitcoin.networks.bitcoin ? '主网' : '测试网'}`);
  console.log(`   版本号: ${version} (0x${version.toString(16)})`);

  const address = base58CheckEncode(version, ripemd160Hash);

  // 步骤 5: 构造 scriptPubKey
  console.log('\n📌 步骤 5: 构造 scriptPubKey (锁定脚本)');
  const scriptPubKey = Buffer.concat([
    Buffer.from([0x76]), // OP_DUP
    Buffer.from([0xa9]), // OP_HASH160
    Buffer.from([0x14]), // 推送 20 字节
    ripemd160Hash,
    Buffer.from([0x88]), // OP_EQUALVERIFY
    Buffer.from([0xac])  // OP_CHECKSIG
  ]);
  console.log(`   Hex: ${toHex(scriptPubKey)}`);
  console.log('   解析:');
  console.log('      76       = OP_DUP');
  console.log('      a9       = OP_HASH160');
  console.log('      14       = 推送 20 字节');
  console.log(`      ${toHex(ripemd160Hash)} = pubKeyHash`);
  console.log('      88       = OP_EQUALVERIFY');
  console.log('      ac       = OP_CHECKSIG');

  console.log('\n✅ 最终地址:', address);
  console.log(`   特点: 以 "${address[0]}" 开头`);

  // 验证
  const { address: libAddress } = bitcoin.payments.p2pkh({ pubkey, network });
  console.log(`\n🔍 验证: bitcoinjs-lib 生成 = ${libAddress}`);
  console.log(`   匹配: ${address === libAddress ? '✅ 一致' : '❌ 不一致'}`);

  return { address, scriptPubKey };
}

/**
 * 手动生成 P2WPKH 地址（展示每一步细节）
 */
function generateP2WPKH_Handcraft(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n🔧 P2WPKH (Native SegWit / Bech32 Address) - 手工构造');
  console.log('='.repeat(80));

  // 步骤 1: 获取公钥
  const pubkey = keyPair.publicKey;
  console.log('\n📌 步骤 1: 公钥');
  console.log(`   Hex: ${toHex(pubkey)}`);

  // 步骤 2: HASH160
  const sha256Hash = crypto.createHash('sha256').update(pubkey).digest();
  const pubkeyHash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  console.log('\n📌 步骤 2: HASH160(公钥)');
  console.log(`   SHA256: ${toHex(sha256Hash)}`);
  console.log(`   RIPEMD160: ${toHex(pubkeyHash)} (20 bytes)`);

  // 步骤 3: 构造见证程序
  console.log('\n📌 步骤 3: 构造见证程序 (Witness Program)');
  console.log('   见证版本: 0 (SegWit v0)');
  console.log(`   见证数据: ${toHex(pubkeyHash)}`);

  // 步骤 4: Bech32 编码
  console.log('\n📌 步骤 4: Bech32 编码');
  const hrp = network === bitcoin.networks.bitcoin ? 'bc' : 'tb';
  const address = bech32Encode(hrp, 0, pubkeyHash);

  // 步骤 5: 构造 scriptPubKey
  console.log('\n📌 步骤 5: 构造 scriptPubKey (见证脚本)');
  const scriptPubKey = Buffer.concat([
    Buffer.from([0x00]), // OP_0 (见证版本)
    Buffer.from([0x14]), // 推送 20 字节
    pubkeyHash
  ]);
  console.log(`   Hex: ${toHex(scriptPubKey)}`);
  console.log('   解析:');
  console.log('      00       = OP_0 (见证版本 0)');
  console.log('      14       = 推送 20 字节');
  console.log(`      ${toHex(pubkeyHash)} = pubKeyHash`);

  console.log('\n✅ 最终地址:', address);
  console.log(`   特点: 以 "${hrp}1q" 开头 (${network === bitcoin.networks.bitcoin ? '主网' : '测试网'})`);

  // 验证
  const { address: libAddress } = bitcoin.payments.p2wpkh({ pubkey, network });
  console.log(`\n🔍 验证: bitcoinjs-lib 生成 = ${libAddress}`);
  console.log(`   匹配: ${address === libAddress ? '✅ 一致' : '❌ 不一致'}`);

  return { address, scriptPubKey };
}

/**
 * 手动生成 P2SH-P2WPKH 地址（展示每一步细节）
 */
function generateP2SH_P2WPKH_Handcraft(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n🔧 P2SH-P2WPKH (Nested SegWit Address) - 手工构造');
  console.log('='.repeat(80));

  // 步骤 1: 生成 P2WPKH 脚本
  const pubkey = keyPair.publicKey;
  console.log('\n📌 步骤 1: 公钥');
  console.log(`   Hex: ${toHex(pubkey)}`);

  const sha256Hash = crypto.createHash('sha256').update(pubkey).digest();
  const pubkeyHash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  console.log('\n📌 步骤 2: HASH160(公钥)');
  console.log(`   结果: ${toHex(pubkeyHash)}`);

  // 步骤 3: 构造 P2WPKH 赎回脚本
  const p2wpkhScript = Buffer.concat([
    Buffer.from([0x00, 0x14]), // OP_0 + 推送 20 字节
    pubkeyHash
  ]);
  console.log('\n📌 步骤 3: 构造 P2WPKH 赎回脚本');
  console.log(`   Hex: ${toHex(p2wpkhScript)}`);
  console.log('   解析:');
  console.log('      00    = OP_0');
  console.log('      14    = 推送 20 字节');
  console.log(`      ${toHex(pubkeyHash)} = pubKeyHash`);

  // 步骤 4: 计算脚本哈希
  console.log('\n📌 步骤 4: 计算 HASH160(赎回脚本)');
  const scriptSha256 = crypto.createHash('sha256').update(p2wpkhScript).digest();
  const scriptHash = crypto.createHash('ripemd160').update(scriptSha256).digest();
  console.log(`   SHA256: ${toHex(scriptSha256)}`);
  console.log(`   RIPEMD160: ${toHex(scriptHash)} (20 bytes)`);
  console.log('   这就是 scriptHash！');

  // 步骤 5: Base58Check 编码
  console.log('\n📌 步骤 5: Base58Check 编码');
  const version = network === bitcoin.networks.bitcoin ? 0x05 : 0xc4; // 主网: 5, 测试网: 196
  console.log(`   版本号: ${version} (0x${version.toString(16)})`);

  const address = base58CheckEncode(version, scriptHash);

  // 步骤 6: 构造 scriptPubKey
  console.log('\n📌 步骤 6: 构造 scriptPubKey (P2SH 脚本)');
  const scriptPubKey = Buffer.concat([
    Buffer.from([0xa9]), // OP_HASH160
    Buffer.from([0x14]), // 推送 20 字节
    scriptHash,
    Buffer.from([0x87])  // OP_EQUAL
  ]);
  console.log(`   Hex: ${toHex(scriptPubKey)}`);
  console.log('   解析:');
  console.log('      a9       = OP_HASH160');
  console.log('      14       = 推送 20 字节');
  console.log(`      ${toHex(scriptHash)} = scriptHash`);
  console.log('      87       = OP_EQUAL');

  console.log('\n✅ 最终地址:', address);
  console.log(`   特点: 以 "${address[0]}" 开头`);

  // 验证
  const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });
  const { address: libAddress } = bitcoin.payments.p2sh({ redeem: p2wpkh, network });
  console.log(`\n🔍 验证: bitcoinjs-lib 生成 = ${libAddress}`);
  console.log(`   匹配: ${address === libAddress ? '✅ 一致' : '❌ 不一致'}`);

  return { address, scriptPubKey, redeemScript: p2wpkhScript };
}

/**
 * 手动生成 P2TR 地址（展示每一步细节）
 */
function generateP2TR_Handcraft(keyPair: ECPairInterface, network: bitcoin.Network) {
  console.log('\n🔧 P2TR (Taproot / Bech32m Address) - 手工构造');
  console.log('='.repeat(80));

  // 步骤 1: 获取公钥
  const pubkey = keyPair.publicKey;
  console.log('\n📌 步骤 1: 原始公钥');
  console.log(`   Hex: ${toHex(pubkey)} (33 bytes)`);
  console.log(`   格式: ${pubkey[0] === 0x02 ? '偶数 y 坐标' : '奇数 y 坐标'}`);

  // 步骤 2: 提取 x-only 公钥
  const internalPubkey = pubkey.slice(1, 33);
  console.log('\n📌 步骤 2: X-only 公钥 (移除前缀)');
  console.log(`   Hex: ${toHex(internalPubkey)} (32 bytes)`);
  console.log('   说明: Taproot 只使用 x 坐标，y 坐标默认为偶数');

  // 使用 bitcoinjs-lib 生成 Taproot 地址（因为手动实现 Taproot 调整很复杂）
  const { address, output } = bitcoin.payments.p2tr({
    internalPubkey,
    network
  });

  // 步骤 3: Taproot 调整
  console.log('\n📌 步骤 3: Taproot 调整 (Tweak)');
  console.log('   说明: 输出公钥 = 内部公钥 + Hash(内部公钥 || "") × G');
  console.log('   这是一个复杂的椭圆曲线运算');

  if (output) {
    const outputPubkey = output.slice(2); // 移除 OP_1 和长度字节
    console.log(`   调整后的公钥: ${toHex(outputPubkey)} (32 bytes)`);
  }

  // 步骤 4: 构造 scriptPubKey
  console.log('\n📌 步骤 4: 构造 scriptPubKey');
  console.log(`   Hex: ${output ? toHex(output) : 'N/A'}`);
  if (output) {
    console.log('   解析:');
    console.log('      51       = OP_1 (见证版本 1)');
    console.log('      20       = 推送 32 字节');
    console.log(`      ${toHex(output.slice(2))} = 调整后的公钥`);
  }

  console.log('\n✅ 最终地址:', address);
  const hrp = network === bitcoin.networks.bitcoin ? 'bc' : 'tb';
  console.log(`   特点: 以 "${hrp}1p" 开头 (Bech32m 编码)`);

  return { address, output };
}

/**
 * 主函数
 */
async function main() {
  console.log('🎨 比特币地址生成 - 手工构造详解');
  console.log('='.repeat(80));
  console.log('本脚本展示地址生成的每一步细节，包括：');
  console.log('  • 哈希计算过程');
  console.log('  • Base58Check 编码详解');
  console.log('  • Bech32 编码详解');
  console.log('  • scriptPubKey 构造');
  console.log('='.repeat(80));

  // 使用测试网
  const network = bitcoin.networks.testnet;

  // 生成密钥对
  const keyPair = ECPair.makeRandom({ network });

  console.log('\n🔑 密钥信息:');
  console.log('='.repeat(80));
  console.log('私钥 (WIF):', keyPair.toWIF());
  if (keyPair.privateKey) {
    console.log('私钥 (Hex):', toHex(keyPair.privateKey));
  }
  console.log('公钥 (Hex):', toHex(keyPair.publicKey));
  console.log('公钥类型:', keyPair.compressed ? '压缩 (33 bytes)' : '未压缩 (65 bytes)');

  // 生成各种类型的地址（手工构造）
  const p2pkh = generateP2PKH_Handcraft(keyPair, network);
  const p2wpkh = generateP2WPKH_Handcraft(keyPair, network);
  const p2sh = generateP2SH_P2WPKH_Handcraft(keyPair, network);
  const p2tr = generateP2TR_Handcraft(keyPair, network);

  // 总结
  console.log('\n\n📊 地址总结');
  console.log('='.repeat(80));
  console.log('P2PKH (Legacy):      ', p2pkh.address);
  console.log('P2WPKH (SegWit):     ', p2wpkh.address);
  console.log('P2SH-P2WPKH (包装):  ', p2sh.address);
  console.log('P2TR (Taproot):      ', p2tr.address);

  console.log('\n💡 编码方式:');
  console.log('  • P2PKH:      Base58Check (版本 0x6f)');
  console.log('  • P2SH:       Base58Check (版本 0xc4)');
  console.log('  • P2WPKH:     Bech32 (HRP="tb", 版本=0)');
  console.log('  • P2TR:       Bech32m (HRP="tb", 版本=1)');

  console.log('\n✅ 演示完成！');
}

// 运行主函数
main().catch(console.error);
