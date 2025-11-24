import * as bitcoin from 'bitcoinjs-lib';
import * as crypto from 'crypto';

/**
 * 演示交易 ID 的计算过程
 *
 * 交易 ID (TXID) 的计算公式：
 * TXID = reverse(SHA256(SHA256(交易的完整二进制数据)))
 */

console.log('🔐 比特币交易 ID (TXID) 计算演示');
console.log('='.repeat(80));

// 使用一个真实的 P2PKH 交易 Hex
// 这是一个 P2PKH to P2PKH 的测试交易
const txHex = '0200000001d782164dfe436d75b9d741198a96e2f67710d0c9a305b2594ca4057283cba76b010000006b483045022100c7e2b68e515763286d9f776045728021f08e74a07e607575730cfa20e81777a002200c8b96b03a6baf25cf40d1978ab29f9ee083009e9fd90206f9adff761326c42a01210371cf1060c2693a35fa250861530a25e3064df58a8ca09b48c473b8382d1d8455ffffffff0100100000000000001976a914de8d00e55147f27899833b27fe906499ebcadee188ac00000000';

console.log('\n📦 交易的完整结构 (Hex 格式):');
console.log(txHex);
console.log(`\n交易大小: ${txHex.length / 2} bytes (${txHex.length} hex 字符)`);

console.log('\n' + '='.repeat(80));
console.log('📝 交易结构解析 (以这个交易为例):');
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
console.log(`   Previous TXID: ${prevTxid}`);
console.log(`   (小端序，实际 TXID 需要反转)`);
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
console.log(`   包含: 签名 + 公钥`);
offset += scriptSigLenValue * 2;

// Sequence
const sequence = txHex.slice(offset, offset + 8);
console.log(`   Sequence: ${sequence}`);
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
console.log(`   P2PKH 格式: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG`);
offset += scriptPubKeyLenValue * 2;

// Locktime
const locktime = txHex.slice(offset, offset + 8);
console.log(`\n6️⃣  锁定时间 (Locktime): ${locktime}`);
console.log(`   数值: ${parseInt(Buffer.from(locktime, 'hex').reverse().toString('hex'), 16)}`);

console.log('\n' + '='.repeat(80));
console.log('🔐 交易 ID (TXID) 计算过程:');
console.log('='.repeat(80));

// 步骤 1: 将交易 Hex 转换为 Buffer
const txBuffer = Buffer.from(txHex, 'hex');
console.log('\n步骤 1: 交易的二进制数据');
console.log(`  大小: ${txBuffer.length} bytes`);
console.log(`  前 32 bytes: ${txBuffer.slice(0, 32).toString('hex')}`);

// 步骤 2: 第一次 SHA256
const hash1 = crypto.createHash('sha256').update(txBuffer).digest();
console.log('\n步骤 2: 第一次 SHA256 哈希');
console.log(`  SHA256(交易数据) = ${hash1.toString('hex')}`);

// 步骤 3: 第二次 SHA256
const hash2 = crypto.createHash('sha256').update(hash1).digest();
console.log('\n步骤 3: 第二次 SHA256 哈希 (Double SHA256)');
console.log(`  SHA256(SHA256(交易数据)) = ${hash2.toString('hex')}`);
console.log(`  这个值的字节序是: 大端序 (Big Endian)`);

// 步骤 4: 反转字节序
const txIdCalculated = Buffer.from(hash2).reverse();
console.log('\n步骤 4: 反转字节序 (大端序 → 小端序)');
console.log(`  原始 (大端序): ${hash2.toString('hex')}`);
console.log(`  反转后 (小端序): ${txIdCalculated.toString('hex')}`);

console.log('\n' + '='.repeat(80));
console.log('✅ 最终交易 ID (TXID):');
console.log('='.repeat(80));
console.log(txIdCalculated.toString('hex'));

console.log('\n💡 为什么要反转字节序？');
console.log('='.repeat(80));
console.log(`
  比特币使用 "小端序" (Little Endian) 来存储和显示交易 ID。
  但是 SHA256 的输出是 "大端序" (Big Endian)。
  所以需要将哈希结果反转，才能得到正确的交易 ID。

  这也是为什么在交易输入中引用前一个交易时，
  TXID 也需要以小端序（反转）的形式存储在交易数据中。
  区块头的Merkle Root (由所有 TXID 计算得出)
  `);

console.log('\n🔍 使用 bitcoinjs-lib 验证:');
console.log('='.repeat(80));

// 使用 bitcoinjs-lib 的方法验证
const txFromHex = bitcoin.Transaction.fromHex(txHex);
const txIdFromLib = txFromHex.getId();
console.log(`  bitcoinjs-lib 计算的 TXID: ${txIdFromLib}`);
console.log(`  手动计算的 TXID:          ${txIdCalculated.toString('hex')}`);
console.log(`  结果一致: ${txIdFromLib === txIdCalculated.toString('hex') ? '✅ 是' : '❌ 否'}`);

console.log('\n✨ 总结:');
console.log('='.repeat(80));
console.log(`
  交易 Hex = 交易完整结构的 16 进制表示

  交易 ID 计算公式:
    TXID = Reverse(SHA256(SHA256(交易 Hex 的二进制数据)))

  步骤:
    1. 交易 Hex → Binary (二进制)
    2. SHA256(Binary) → Hash1
    3. SHA256(Hash1) → Hash2 (Double SHA256)
    4. Reverse(Hash2) → TXID (反转字节序)

  这个 TXID 就是交易在区块链上的唯一标识符！
`);
