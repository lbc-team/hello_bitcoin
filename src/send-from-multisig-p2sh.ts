import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import axios from 'axios';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Mempool.space API endpoints
const MEMPOOL_API = 'https://mempool.space/testnet4/api';

interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

/**
 * 获取地址的 UTXOs
 */
async function getUTXOs(address: string): Promise<UTXO[]> {
  try {
    const response = await axios.get<UTXO[]>(`${MEMPOOL_API}/address/${address}/utxo`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`获取 UTXO 失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 获取完整交易的 hex 数据
 */
async function getTransactionHex(txid: string): Promise<Buffer> {
  try {
    const response = await axios.get<string>(`${MEMPOOL_API}/tx/${txid}/hex`);
    return Buffer.from(response.data, 'hex');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`获取交易 hex 失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 广播交易到网络
 */
async function broadcastTransaction(txHex: string): Promise<string> {
  try {
    const response = await axios.post<string>(`${MEMPOOL_API}/tx`, txHex, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`广播交易失败: ${error.response?.data || error.message}`);
    }
    throw error;
  }
}

/**
 * 主函数：从 P2SH 多签地址发送交易
 */
async function main() {
  console.log('🚀 从 P2SH 多签地址发送交易（2-of-2）');
  console.log('='.repeat(60));

  // 1. 加载私钥和地址
  const privateKey1WIF = process.env.PRIVATE_KEY1;
  const privateKey2WIF = process.env.PRIVATE_KEY2;
  const multisigAddress = process.env.MULTISIG_P2SH_ADDRESS?.trim();
  const redeemScriptHex = process.env.MULTISIG_REDEEM_SCRIPT?.trim();
  const recipientAddress = process.env.P2SH_P2WPKH_ADDR_1?.trim();

  if (!privateKey1WIF || !privateKey2WIF) {
    throw new Error('未找到 PRIVATE_KEY1 或 PRIVATE_KEY2 环境变量');
  }

  if (!multisigAddress) {
    throw new Error('未找到 MULTISIG_P2SH_ADDRESS 环境变量。请先运行 generate-multisig-p2sh.ts');
  }

  if (!redeemScriptHex) {
    throw new Error('未找到 MULTISIG_REDEEM_SCRIPT 环境变量。请先运行 generate-multisig-p2sh.ts');
  }

  if (!recipientAddress) {
    throw new Error('未找到 P2SH_P2WPKH_ADDR_1 环境变量。请先运行 generate-multisig-p2sh.ts');
  }

  // 2. 创建密钥对
  const network = bitcoin.networks.testnet;
  const keyPair1 = ECPair.fromWIF(privateKey1WIF, network);
  const keyPair2 = ECPair.fromWIF(privateKey2WIF, network);

  console.log('\n📍 发送方信息（多签地址）:');
  console.log('  地址:', multisigAddress);
  console.log('  赎回脚本:', redeemScriptHex);

  console.log('\n📍 接收方信息（PRIVATE_KEY1 的 P2SH-P2WPKH）:');
  console.log('  地址:', recipientAddress);

  // 3. 重建赎回脚本
  const redeemScript = Buffer.from(redeemScriptHex, 'hex');

  // 验证多签地址是否匹配
  const pubkeys = [keyPair1.publicKey, keyPair2.publicKey].sort(Buffer.compare);
  const p2ms = bitcoin.payments.p2ms({
    m: 2,
    pubkeys: pubkeys,
    network
  });

  const p2sh = bitcoin.payments.p2sh({
    redeem: p2ms,
    network
  });

  if (p2sh.address !== multisigAddress) {
    throw new Error('多签地址不匹配！请检查 .env 配置');
  }

  // 4. 查询 UTXOs
  console.log('\n🔍 查询 UTXOs...');
  const utxos = await getUTXOs(multisigAddress);

  if (utxos.length === 0) {
    throw new Error(`地址 ${multisigAddress} 没有可用的 UTXO。请先向该地址发送测试币。`);
  }

  console.log(`  找到 ${utxos.length} 个 UTXO:`);
  utxos.forEach((utxo, index) => {
    console.log(`  [${index}] ${utxo.txid}:${utxo.vout} - ${utxo.value} sats (${utxo.status.confirmed ? '已确认' : '未确认'})`);
  });

  // 5. 选择第一个 UTXO 作为输入
  const utxo = utxos[0];
  const totalInput = utxo.value;

  console.log('\n💰 使用 UTXO:');
  console.log('  TXID:', utxo.txid);
  console.log('  Vout:', utxo.vout);
  console.log('  金额:', totalInput, 'sats');

  // 6. 计算交易费和输出金额
  // P2SH 多签交易大小计算：
  //   固定开销: 10 bytes
  //   每个 P2SH 输入: ~295 bytes (包含 2-of-2 多签)
  //   每个输出: 34 bytes
  const feeRate = 4; // sat/vB
  const estimatedSize = 10 + 295 + 34; // 339 bytes
  const fee = feeRate * estimatedSize;
  const sendAmount = totalInput - fee;

  if (sendAmount <= 0) {
    throw new Error(`UTXO 金额不足以支付交易费。需要至少 ${fee} sats，但只有 ${totalInput} sats`);
  }

  console.log('\n💸 交易金额:');
  console.log('  输入总额:', totalInput, 'sats');
  console.log('  预估大小:', estimatedSize, 'bytes');
  console.log('  交易费:', fee, 'sats', `(${feeRate} sat/vB)`);
  console.log('  发送金额:', sendAmount, 'sats');

  // 7. 构造交易
  console.log('\n🔨 构造交易...');
  const psbt = new bitcoin.Psbt({ network });

  // 添加输入
  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    nonWitnessUtxo: await getTransactionHex(utxo.txid),
    redeemScript: redeemScript,
  });

  // 添加输出
  psbt.addOutput({
    address: recipientAddress,
    value: BigInt(sendAmount),
  });

  // 8. 用两个私钥签名交易
  console.log('\n✍️  签名交易（需要两个签名）...');

  // 第一个签名
  console.log('  使用 PRIVATE_KEY1 签名...');
  psbt.signInput(0, keyPair1);

  // 第二个签名
  console.log('  使用 PRIVATE_KEY2 签名...');
  psbt.signInput(0, keyPair2);

  // 验证签名
  console.log('  验证签名...');
  const validated = psbt.validateSignaturesOfInput(0, (pubkey, msghash, signature) => {
    return ECPair.fromPublicKey(pubkey).verify(msghash, signature);
  });

  if (!validated) {
    throw new Error('签名验证失败');
  }

  // 完成交易
  psbt.finalizeAllInputs();

  // 9. 提取交易
  const tx = psbt.extractTransaction();
  const txHex = tx.toHex();
  const txId = tx.getId();

  console.log('\n📦 交易详情:');
  console.log('  交易 ID:', txId);
  console.log('  交易大小:', tx.byteLength(), 'bytes');
  console.log('  实际费率:', (fee / tx.byteLength()).toFixed(2), 'sat/vB');
  console.log('  交易 Hex:', txHex.substring(0, 100) + '...');

  // 10. 广播交易
  console.log('\n📡 广播交易到网络...');
  try {
    const broadcastedTxId = await broadcastTransaction(txHex);
    console.log('✅ 交易已成功广播!');
    console.log('  交易 ID:', broadcastedTxId);
    console.log('  查看交易:', `https://mempool.space/testnet4/tx/${broadcastedTxId}`);
  } catch (error) {
    console.error('❌ 广播失败:', error instanceof Error ? error.message : error);
    console.log('\n完整交易 Hex（可手动广播）:');
    console.log(txHex);
    throw error;
  }
}

// 运行主函数
main().catch(error => {
  console.error('\n❌ 错误:', error instanceof Error ? error.message : error);
  process.exit(1);
});
