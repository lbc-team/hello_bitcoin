import * as bitcoin from 'bitcoinjs-lib';
import * as crypto from 'crypto';

/**
 * 解析 P2SH 多签交易
 * 演示 P2SH 多签交易的结构和 TXID 计算
 */

console.log('🔐 P2SH 多签交易解析');
console.log('='.repeat(80));

// P2SH 多签交易 Hex（2-of-2 多签）
const txHex = '0200000001f074c8f6720757481b744a56e59eabb0c2901137dcecb7735c11e4ac02bbaeda01000000d900473044022060750ef5e469eb4f70e3b0b3490ed2e27dd64e455386e7e214b0edd092e9620302202a17814cb6905393784ad113ebbce28dba539edc48d15458c8878cae213188b00147304402205384025f453991a72233c0acd93b2d4d80705a1741fb36e330516189c0751cdc022009410b538e86a6a1158cea7a33fd3e79377339ac9698e93c98971380ef0cdb17014752210371cf1060c2693a35fa250861530a25e3064df58a8ca09b48c473b8382d1d8455210390150eafa66c5438fa5824882d03fd658d035b3de3a7401b35b16486cf6431d452aeffffffff013c0e00000000000017a914d898b931e2cde994c2ca816b1d2707c3133bcd5a8700000000';

console.log('\n📦 交易的完整结构 (Hex 格式):');
console.log(txHex);
console.log(`\n交易大小: ${txHex.length / 2} bytes (${txHex.length} hex 字符)`);

console.log('\n' + '='.repeat(80));
console.log('📝 交易结构解析:');
console.log('='.repeat(80));

let offset = 0;

// 版本号
const version = txHex.slice(offset, offset + 8);
console.log(`\n1️⃣  版本 (Version): ${version}`);
console.log(`   小端序 hex: ${version}`);
console.log(`   数值: ${parseInt(Buffer.from(version, 'hex').reverse().toString('hex'), 16)}`);
offset += 8;

// 输入数量
const inputCount = txHex.slice(offset, offset + 2);
console.log(`\n2️⃣  输入数量 (Input Count): ${inputCount}`);
console.log(`   数值: ${parseInt(inputCount, 16)}`);
offset += 2;

console.log(`\n3️⃣  输入 (Input):`);
// TXID (前一个交易的输出)
const prevTxid = txHex.slice(offset, offset + 64);
const prevTxidReversed = Buffer.from(prevTxid, 'hex').reverse().toString('hex');
console.log(`   Previous TXID (小端序): ${prevTxid}`);
console.log(`   Previous TXID (实际):   ${prevTxidReversed}`);
offset += 64;

// Vout
const vout = txHex.slice(offset, offset + 8);
console.log(`   Previous Vout: ${vout}`);
console.log(`   数值: ${parseInt(Buffer.from(vout, 'hex').reverse().toString('hex'), 16)}`);
offset += 8;

// ScriptSig 长度
const scriptSigLen = txHex.slice(offset, offset + 2);
const scriptSigLenValue = parseInt(scriptSigLen, 16);
console.log(`   ScriptSig 长度: ${scriptSigLen} (${scriptSigLenValue} bytes)`);
offset += 2;

// ScriptSig
const scriptSig = txHex.slice(offset, offset + scriptSigLenValue * 2);
console.log(`   ScriptSig (解锁脚本): ${scriptSig}`);

// 解析 ScriptSig
console.log(`\n   📜 ScriptSig 详细解析 (P2SH 多签格式):`);
let sigOffset = 0;

// OP_0 (用于修复 CHECKMULTISIG 的 off-by-one bug)
const op0 = scriptSig.slice(sigOffset, sigOffset + 2);
console.log(`      OP_0: ${op0} (修复 CHECKMULTISIG bug)`);
sigOffset += 2;

// 第一个签名
const sig1Len = parseInt(scriptSig.slice(sigOffset, sigOffset + 2), 16);
sigOffset += 2;
const sig1 = scriptSig.slice(sigOffset, sigOffset + sig1Len * 2);
console.log(`      签名1 长度: ${sig1Len} bytes`);
console.log(`      签名1: ${sig1}`);
sigOffset += sig1Len * 2;

// 第二个签名
const sig2Len = parseInt(scriptSig.slice(sigOffset, sigOffset + 2), 16);
sigOffset += 2;
const sig2 = scriptSig.slice(sigOffset, sigOffset + sig2Len * 2);
console.log(`      签名2 长度: ${sig2Len} bytes`);
console.log(`      签名2: ${sig2}`);
sigOffset += sig2Len * 2;

// 赎回脚本 (Redeem Script)
const redeemScriptLen = parseInt(scriptSig.slice(sigOffset, sigOffset + 2), 16);
sigOffset += 2;
const redeemScript = scriptSig.slice(sigOffset, sigOffset + redeemScriptLen * 2);
console.log(`      赎回脚本长度: ${redeemScriptLen} bytes`);
console.log(`      赎回脚本: ${redeemScript}`);

// 解析赎回脚本
console.log(`\n   🔓 赎回脚本 (Redeem Script) 解析:`);
let redeemOffset = 0;

const m = redeemScript.slice(redeemOffset, redeemOffset + 2);
const mValue = parseInt(m, 16) - 0x50; // OP_2 = 0x52, so OP_N = 0x50 + N
console.log(`      OP_${mValue}: ${m} (需要 ${mValue} 个签名)`);
redeemOffset += 2;

const pubkey1Len = parseInt(redeemScript.slice(redeemOffset, redeemOffset + 2), 16);
redeemOffset += 2;
const pubkey1 = redeemScript.slice(redeemOffset, redeemOffset + pubkey1Len * 2);
console.log(`      公钥1 (${pubkey1Len} bytes): ${pubkey1}`);
redeemOffset += pubkey1Len * 2;

const pubkey2Len = parseInt(redeemScript.slice(redeemOffset, redeemOffset + 2), 16);
redeemOffset += 2;
const pubkey2 = redeemScript.slice(redeemOffset, redeemOffset + pubkey2Len * 2);
console.log(`      公钥2 (${pubkey2Len} bytes): ${pubkey2}`);
redeemOffset += pubkey2Len * 2;

const n = redeemScript.slice(redeemOffset, redeemOffset + 2);
const nValue = parseInt(n, 16) - 0x50;
console.log(`      OP_${nValue}: ${n} (总共 ${nValue} 个公钥)`);
redeemOffset += 2;

const checkMultisig = redeemScript.slice(redeemOffset, redeemOffset + 2);
console.log(`      OP_CHECKMULTISIG: ${checkMultisig}`);

console.log(`\n      总结: ${mValue}-of-${nValue} 多签 (需要 ${mValue} 个签名，总共 ${nValue} 个公钥)`);

// 计算赎回脚本的哈希
const redeemScriptBuffer = Buffer.from(redeemScript, 'hex');
const redeemScriptHash = bitcoin.crypto.hash160(redeemScriptBuffer);
console.log(`\n      赎回脚本哈希 (HASH160): ${Buffer.from(redeemScriptHash).toString('hex')}`);

offset += scriptSigLenValue * 2;

// Sequence
const sequence = txHex.slice(offset, offset + 8);
console.log(`\n   Sequence: ${sequence}`);
console.log(`   (0xffffffff 表示启用 RBF - Replace-By-Fee)`);
offset += 8;

// 输出数量
const outputCount = txHex.slice(offset, offset + 2);
console.log(`\n4️⃣  输出数量 (Output Count): ${outputCount}`);
console.log(`   数值: ${parseInt(outputCount, 16)}`);
offset += 2;

console.log(`\n5️⃣  输出 (Output):`);
// Value
const value = txHex.slice(offset, offset + 16);
const satoshis = parseInt(Buffer.from(value, 'hex').reverse().toString('hex'), 16);
console.log(`   Value: ${value}`);
console.log(`   金额: ${satoshis} satoshis (${satoshis / 100000000} BTC)`);
offset += 16;

// ScriptPubKey 长度
const scriptPubKeyLen = txHex.slice(offset, offset + 2);
const scriptPubKeyLenValue = parseInt(scriptPubKeyLen, 16);
console.log(`   ScriptPubKey 长度: ${scriptPubKeyLen} (${scriptPubKeyLenValue} bytes)`);
offset += 2;

// ScriptPubKey
const scriptPubKey = txHex.slice(offset, offset + scriptPubKeyLenValue * 2);
console.log(`   ScriptPubKey (锁定脚本): ${scriptPubKey}`);

// 解析 ScriptPubKey (P2SH 格式)
console.log(`\n   📜 ScriptPubKey 解析 (P2SH 格式):`);
const opHash160 = scriptPubKey.slice(0, 2);
console.log(`      OP_HASH160: ${opHash160}`);

const hashLen = scriptPubKey.slice(2, 4);
console.log(`      哈希长度: ${hashLen} (${parseInt(hashLen, 16)} bytes)`);

const scriptHash = scriptPubKey.slice(4, 44);
console.log(`      脚本哈希: ${scriptHash}`);
console.log(`      (这个哈希应该等于上面的赎回脚本哈希)`);

const opEqual = scriptPubKey.slice(44, 46);
console.log(`      OP_EQUAL: ${opEqual}`);

console.log(`\n      P2SH 锁定脚本格式: OP_HASH160 <scriptHash> OP_EQUAL`);
 

offset += scriptPubKeyLenValue * 2;

// Locktime
const locktime = txHex.slice(offset, offset + 8);
console.log(`\n6️⃣  锁定时间 (Locktime): ${locktime}`);
console.log(`   数值: ${parseInt(Buffer.from(locktime, 'hex').reverse().toString('hex'), 16)}`);
console.log(`   (0 表示立即生效，无锁定)`);

console.log('\n' + '='.repeat(80));
console.log('🔐 交易 ID (TXID) 计算过程:');
console.log('='.repeat(80));

// 步骤 1: 将交易 Hex 转换为 Buffer
const txBuffer = Buffer.from(txHex, 'hex');
console.log('\n步骤 1: 交易的二进制数据');
console.log(`  大小: ${txBuffer.length} bytes`);

// 步骤 2: 第一次 SHA256
const hash1 = crypto.createHash('sha256').update(txBuffer).digest();
console.log('\n步骤 2: 第一次 SHA256 哈希');
console.log(`  SHA256(交易数据) = ${hash1.toString('hex')}`);

// 步骤 3: 第二次 SHA256
const hash2 = crypto.createHash('sha256').update(hash1).digest();
console.log('\n步骤 3: 第二次 SHA256 哈希 (Double SHA256)');
console.log(`  SHA256(SHA256(交易数据)) = ${hash2.toString('hex')}`);

// 步骤 4: 反转字节序
const txIdCalculated = Buffer.from(hash2).reverse();
console.log('\n步骤 4: 反转字节序 (大端序 → 小端序)');
console.log(`  反转后 (小端序): ${txIdCalculated.toString('hex')}`);

console.log('\n' + '='.repeat(80));
console.log('✅ 最终交易 ID (TXID):');
console.log('='.repeat(80));
console.log(txIdCalculated.toString('hex'));

console.log('\n🔍 使用 bitcoinjs-lib 验证:');
console.log('='.repeat(80));

// 使用 bitcoinjs-lib 的方法验证
const txFromHex = bitcoin.Transaction.fromHex(txHex);
const txIdFromLib = txFromHex.getId();
console.log(`  bitcoinjs-lib 计算的 TXID: ${txIdFromLib}`);
console.log(`  手动计算的 TXID:          ${txIdCalculated.toString('hex')}`);
console.log(`  结果一致: ${txIdFromLib === txIdCalculated.toString('hex') ? '✅ 是' : '❌ 否'}`);

console.log('\n✨ P2SH 多签交易总结:');
console.log('='.repeat(80));
console.log(`
  交易类型: P2SH 多签交易 (${mValue}-of-${nValue})

  ScriptSig (解锁脚本) 结构:
    OP_0 <签名1> <签名2> ... <赎回脚本>

  赎回脚本 (Redeem Script) 结构:
    OP_M <公钥1> <公钥2> ... <公钥N> OP_N OP_CHECKMULTISIG

  ScriptPubKey (锁定脚本) 结构:
    OP_HASH160 <赎回脚本的哈希> OP_EQUAL

  验证过程:
    1. 检查提供的赎回脚本的哈希是否等于锁定脚本中的哈希
    2. 执行赎回脚本，验证是否有足够的有效签名
    3. OP_CHECKMULTISIG 验证签名是否对应正确的公钥

  为什么需要 OP_0:
    由于 CHECKMULTISIG 的一个历史 bug，它会多弹出一个栈元素，
    所以需要在开头添加一个 OP_0 来补偿这个 bug。
`);

console.log('\n🔗 查看交易:');
console.log(`  https://mempool.space/testnet4/tx/${txIdCalculated.toString('hex')}`);
