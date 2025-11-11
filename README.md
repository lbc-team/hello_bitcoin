# hello_bitcoin

使用 TypeScript 和 bitcoinjs-lib 学习比特币开发

## 快速开始

```bash
# 安装依赖
npm install

# 运行基础示例
npm run dev

# 运行地址类型演示（详细推导过程）
npm run demo:address
```

## 项目结构

- `src/index.ts` - 基础示例：生成比特币测试网地址
- `src/address-types.ts` - 完整演示：展示四种主要比特币地址类型的推导过程

## 支持的地址类型

1. **P2PKH (Legacy)** - 以 `1` (主网) 或 `m/n` (测试网) 开头
2. **P2SH-P2WPKH (嵌套 SegWit)** - 以 `3` (主网) 或 `2` (测试网) 开头
3. **P2WPKH (Native SegWit)** - 以 `bc1q` (主网) 或 `tb1q` (测试网) 开头
4. **P2TR (Taproot)** - 以 `bc1p` (主网) 或 `tb1p` (测试网) 开头

## Bitcoin Core 设置

运行 Bitcoin Core testnet4 节点：

```bash
./setup-bitcoin-testnet4.sh
```

## 参考链接

https://mempool.space/testnet4/tx/69b4fe8bf6683e48cea8ffefa853736e519793a5f938fd7ea284267a01162769#flow=&vout=1
