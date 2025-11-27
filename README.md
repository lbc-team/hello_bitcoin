# hello_bitcoin

使用 TypeScript 和 bitcoinjs-lib 学习比特币开发

## 快速开始

```bash
# 安装依赖
npm install

# 运行基础示例
npm run dev
```

## 可用脚本

### 地址生成

```bash
# 生成所有类型的比特币地址（使用 bitcoinjs-lib）
npm run generate:address

# 手工推导比特币地址（详细步骤）
npm run generate:address:handcraft

# 生成 2-of-2 P2SH 多签地址
npm run generate:multisig
```

### 交易发送

```bash
# 从 P2PKH 地址发送交易
npm run send:p2pkh

# 从 P2SH 多签地址发送交易（需要 2 个签名）
npm run send:multisig
```

### 交易解析

```bash
# 解析 P2PKH 交易并计算 TXID
npm run breakout:p2pkh

# 解析 P2SH 多签交易并计算 TXID
npm run breakout:p2sh

# 通过 TXID 获取完整交易 Hex 和详细信息
npm run get:tx:hex <txid>
```

## 项目结构

- `src/index.ts` - 基础示例：生成比特币测试网地址
- `src/address-types.ts` - 使用 bitcoinjs-lib 生成四种主要地址类型
- `src/address-types-handcraft.ts` - 手工推导地址生成的完整过程
- `src/generate-multisig-p2sh.ts` - 生成 2-of-2 P2SH 多签地址
- `src/send-p2pkh.ts` - 构造并广播 P2PKH 交易
- `src/send-from-multisig-p2sh.ts` - 构造并广播 P2SH 多签交易
- `src/breakout-p2pkh-tx-cal-txid.ts` - 详细解析 P2PKH 交易结构和 TXID 计算
- `src/breakout-p2sh-tx.ts` - 详细解析 P2SH 多签交易结构
- `src/get-tx-hex.ts` - 通过 TXID 查询交易详情

## 支持的地址类型

1. **P2PKH (Legacy)** - 以 `1` (主网) 或 `m/n` (测试网) 开头
2. **P2SH-P2WPKH (嵌套 SegWit)** - 以 `3` (主网) 或 `2` (测试网) 开头
3. **P2WPKH (Native SegWit)** - 以 `bc1q` (主网) 或 `tb1q` (测试网) 开头
4. **P2TR (Taproot)** - 以 `bc1p` (主网) 或 `tb1p` (测试网) 开头
5. **P2SH (Multisig)** - 2-of-2 多签地址

## 使用流程

### 1. 生成多签地址并发送交易

```bash
# 步骤 1: 生成多签地址
npm run generate:multisig

# 步骤 2: 将输出的配置添加到 .env 文件
# MULTISIG_P2SH_ADDRESS=2xxxxxx...
# MULTISIG_REDEEM_SCRIPT=52210371...
# P2SH_P2WPKH_ADDR_1=2xxxxxx...

# 步骤 3: 向多签地址发送测试币
# 访问 https://mempool.space/testnet4/faucet

# 步骤 4: 等待确认后，从多签地址发送交易
npm run send:multisig
```

### 2. 解析已有交易

```bash
# 获取交易 Hex
npm run get:tx:hex <txid>

# 解析交易结构（根据交易类型选择）
npm run breakout:p2pkh  # P2PKH 交易
npm run breakout:p2sh   # P2SH 多签交易
```

## 环境变量配置

在项目根目录创建 `.env` 文件：

```bash
# 私钥（WIF 格式）
PRIVATE_KEY1=cVGcSNrERCqSSFumCSbEmkiuZKMNn1vSMFg5Fh8VzJZgr5DgqMB8
PRIVATE_KEY2=cPLcfX1pmLVRnrgbPoaRa8ibzimwcbWx47YrrF1Q8zNvPVQKpVbU

# P2PKH 地址
P2PKH_ADDR_1=mgnNt1xWWM4eB6jmfhhZnNiL86Cr9sC98A
P2PKH_ADDR_2=n1ohDjbd8YE9LxwtYystPhVnQJ4mskUZDX

# P2SH 多签配置（运行 generate:multisig 后添加）
MULTISIG_P2SH_ADDRESS=
MULTISIG_REDEEM_SCRIPT=
P2SH_P2WPKH_ADDR_1=
```

## Bitcoin Core 设置

运行 Bitcoin Core testnet4 节点：

```bash
./setup-bitcoin-testnet4.sh
```

## 参考链接

- [Mempool Testnet4 Explorer](https://mempool.space/testnet4)
- [Testnet4 Faucet](https://mempool.space/testnet4/faucet)
- [bitcoinjs-lib 文档](https://github.com/bitcoinjs/bitcoinjs-lib)
