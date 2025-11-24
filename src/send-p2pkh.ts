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
 * 主函数：构造并发送 P2PKH to P2PKH 交易
 */
async function main() {
  console.log('🚀 P2PKH to P2PKH 交易构造与发送');
  console.log('='.repeat(60));

  // 1. 加载私钥
  const privateKeyWIF = process.env.PRIVATE_KEY1;
  const recipientAddress = process.env.P2PKH_ADDR_2?.trim();

  if (!privateKeyWIF) {
    throw new Error('未找到 PRIVATE_KEY1 环境变量');
  }

  if (!recipientAddress) {
    throw new Error('未找到 P2PKH_ADDR_2 环境变量');
  }

  // 2. 创建密钥对
  const network = bitcoin.networks.testnet;
  const keyPair = ECPair.fromWIF(privateKeyWIF, network);

  // 3. 生成发送方的 P2PKH 地址
  const { address: senderAddress } = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
    network
  });

  console.log('\n📍 发送方信息:');
  console.log('  地址:', senderAddress);
  console.log('  公钥:', Buffer.from(keyPair.publicKey).toString('hex'));

  console.log('\n📍 接收方信息:');
  console.log('  地址:', recipientAddress);

  // 4. 查询 UTXOs
  console.log('\n🔍 查询 UTXOs...');
  const utxos = await getUTXOs(senderAddress!);

  if (utxos.length === 0) {
    throw new Error(`地址 ${senderAddress} 没有可用的 UTXO`);
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
  // 交易大小计算：
  //   固定开销: 10 bytes (version 4 + input_count 1 + output_count 1 + locktime 4)
  //   每个输入: ~148 bytes (txid 32 + vout 4 + scriptSig ~107 + sequence 4)
  //   每个输出: 34 bytes (value 8 + scriptPubKey_len 1 + scriptPubKey 25)
  //
  //   单输入单输出: 10 + 148 + 34 = 192 bytes
  //   单输入双输出(含找零): 10 + 148 + 34 + 34 = 226 bytes
  const feeRate = 4; // sat/vB
  const numInputs = 1;
  const numOutputs = 1; // 不包含找零，全部发送
  const estimatedSize = 10 + (numInputs * 148) + (numOutputs * 34); // 192 bytes
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
  });

  // 添加输出
  psbt.addOutput({
    address: recipientAddress,
    value: BigInt(sendAmount),
  });

  // 8. 签名交易
  console.log('\n✍️  签名交易...');
  psbt.signInput(0, keyPair);
  const validated = psbt.validateSignaturesOfInput(0, (pubkey, msghash, signature) => {
    return ECPair.fromPublicKey(pubkey).verify(msghash, signature);
  });
  if (!validated) {
    throw new Error('签名验证失败');
  }
  psbt.finalizeAllInputs();

  // 9. 提取交易
  const tx = psbt.extractTransaction();
  const txHex = tx.toHex();
  const txId = tx.getId();

  console.log('\n📦 交易详情:');
  console.log('  交易大小:', tx.byteLength(), 'bytes');
  console.log('  实际费率:', (fee / tx.byteLength()).toFixed(2), 'sat/vB');
  console.log('  交易 Hex:', txHex);

  // 10. 广播交易
  console.log('\n📡 广播交易到网络...');
  try {
    const broadcastedTxId = await broadcastTransaction(txHex);
    console.log('✅ 交易已成功广播!');
    console.log('  交易 ID:', broadcastedTxId);
    console.log('  查看交易:', `https://mempool.space/testnet4/tx/${broadcastedTxId}`);
  } catch (error) {
    console.error('❌ 广播失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * 获取完整交易的 hex 数据（用于 nonWitnessUtxo）
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

// 运行主函数
main().catch(error => {
  console.error('\n❌ 错误:', error instanceof Error ? error.message : error);
  process.exit(1);
});
