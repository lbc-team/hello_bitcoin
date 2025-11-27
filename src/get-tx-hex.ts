import axios from 'axios';

// Mempool.space API endpoints
const MEMPOOL_API = 'https://mempool.space/testnet4/api';

/**
 * 通过 TXID 获取完整的交易 hex
 */
async function getTransactionHex(txid: string): Promise<string> {
  try {
    const response = await axios.get<string>(`${MEMPOOL_API}/tx/${txid}/hex`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`获取交易 hex 失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 获取交易的详细信息（JSON 格式）
 */
async function getTransactionInfo(txid: string): Promise<any> {
  try {
    const response = await axios.get(`${MEMPOOL_API}/tx/${txid}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`获取交易信息失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  // 从命令行参数获取 txid
  const txid = process.argv[2];

  if (!txid) {
    console.log('用法: npm run get:tx:hex <txid>');
    console.log('示例: npm run get:tx:hex 5a4b8e9f2c3d1a7b6c8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c');
    process.exit(1);
  }

  console.log('🔍 获取交易信息');
  console.log('='.repeat(60));
  console.log('TXID:', txid);

  try {
    // 获取交易 hex
    console.log('\n📦 获取交易 Hex...');
    const txHex = await getTransactionHex(txid);
    console.log('\n交易 Hex:');
    console.log(txHex);
    console.log('\n交易大小:', txHex.length / 2, 'bytes');

    // 获取交易详细信息
    console.log('\n📊 获取交易详情...');
    const txInfo = await getTransactionInfo(txid);

    console.log('\n交易详情:');
    console.log('  状态:', txInfo.status.confirmed ? '已确认' : '未确认');
    if (txInfo.status.confirmed) {
      console.log('  区块高度:', txInfo.status.block_height);
      console.log('  区块哈希:', txInfo.status.block_hash);
      console.log('  区块时间:', new Date(txInfo.status.block_time * 1000).toISOString());
    }
    console.log('  输入数量:', txInfo.vin.length);
    console.log('  输出数量:', txInfo.vout.length);
    console.log('  交易大小:', txInfo.size, 'bytes');
    console.log('  虚拟大小:', txInfo.weight / 4, 'vB');
    console.log('  交易费:', txInfo.fee, 'sats');
    console.log('  费率:', (txInfo.fee / (txInfo.weight / 4)).toFixed(2), 'sat/vB');

    console.log('\n  输入:');
    txInfo.vin.forEach((input: any, index: number) => {
      if (input.is_coinbase) {
        console.log(`    [${index}] Coinbase`);
      } else {
        console.log(`    [${index}] ${input.txid}:${input.vout} (${input.prevout.value} sats)`);
      }
    });

    console.log('\n  输出:');
    txInfo.vout.forEach((output: any, index: number) => {
      console.log(`    [${index}] ${output.scriptpubkey_address || 'OP_RETURN'} (${output.value} sats)`);
    });

    console.log('\n🔗 查看交易:');
    console.log(`  https://mempool.space/testnet4/tx/${txid}`);

    console.log('\n✅ 完成！');
  } catch (error) {
    console.error('\n❌ 错误:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// 运行主函数
main();
