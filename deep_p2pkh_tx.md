当我们在比特币网络上发起一笔转账时，背后究竟发生了什么？
这篇文章我参考[ 深度解析：在发送1个DAI时发生了什么](https://learnblockchain.cn/article/5805) 的叙述逻辑，尝试以经典的  P2PKH（Pay-to-PubKey-Hash）交易为例，剖析比特币的完整生命周期，我们从选择 UTXO开始到构造交易、生成签名，到最终广播到网络并被矿工如何验证的全过程。

 让我们从比特币账本的核心概念——UTXO 模型开始。


## UTXO 模型 

UTXO（Unspent Transaction Output）即**未花费的交易输出**，是比特币账本模型的核心概念。

UTXO 非常类似我们使用现金交易：
- 你钱包里有一张 **50 元**的钞票和一张 **20 元**的钞票
- 买一件 **30 元**的商品时，你付出 50 元，找回 20 元
- 原来的 50 元钞票被"花费"了，你得到一张新的 20 元钞票
只不过现在钞票换成了 UXTO:
```
交易前：
Alice 的 UTXO:
- UTXO₁: 0.5 BTC ✓ 未花费
- UTXO₂: 0.3 BTC ✓ 未花费
交易：Alice 给 Bob 转 0.6 BTC
交易后：
Alice 的 UTXO:
- UTXO₁: 0.5 BTC ✗ 已花费（销毁）
- UTXO₂: 0.3 BTC ✗ 已花费（销毁）
- UTXO₃: 0.19 BTC ✓ 新产生（找零，0.5+0.3-0.6-0.01手续费）
Bob 的 UTXO:
- UTXO₄: 0.6 BTC ✓ 新产生
```
下面是 UTXO 模型工作示意图：
![](https://img.learnblockchain.cn/pics/20251125120925.png)
 在 UTXO 集合（未花费）中选择一个用来花费（作为新交易的输入），并创建新的 UTXO ， 原UTXO 从 **UTXO 集合**中移除，每次交易的时候，不断的重复这个过程，比特币矿工会维护UTXO 集合。


### UTXO 的结构

在交易中，我们会创建 UTXO， 每个 UTXO 包含两个关键信息：
```json
UTXO = {
	value: 金额（以 satoshi 为单位）
	scriptPubKey: 锁定脚本（定义如何解锁）
}
```
消费时，我们就需要引用 UTXO  ，并使用解锁脚本解开 UTXO 进行消费。

接下来看看如果来构造交易。

## 构造交易


我们以 Alice 支付给 Bob 为例， 从 Alice 的 P2PKH（支付到公钥 Hash） UTXO 支付到  Bob 的 公钥 Hash 。

构造比特币的交易，通常有这几步：
1. 选择 UTXO 作为输入
2. 构建输出的 UTXO：解析接收者地址生成 scriptPubKey 锁定脚本 
3. 构造完整交易结构
4. 交易签名
5. 交易广播：发送给矿工节点


### 1：选择 UTXO 作为输入

交易中使用 `(txid, vout)` 唯一标识来引用一个 UTXO，Alice 需要想从钱包服务或 RPC 获取其 UTXO , 例如通过 mempool 服务可以获取到某地址的 UTXO:
```
https://mempool.space/testnet4/api/address/${address}/utxo

```
若 Alice 为 mgnNt1xWWM4eB6jmfhhZnNiL86Cr9sC98A ，可以获取到：

```
[
  {
    "txid": "a3189c2822b22c8a6ba82905e94d9a7a5c2e77f65e571b19973e7f1c92d44a58",
    "vout": 1,
    "status": {
      "confirmed": true,
      "block_height": 111145,
      "block_hash": "000000000c88cac240621a4b35eb25737d7b0832616f0d434b22426b4206f370",
      "block_time": 1763966730
    },
    "value": 5000
  }
]
```

txid: 创建该 UTXO 的交易 ID
vout: 该 UTXO 在交易输出中的索引（从 0 开始）


### 2：构建输出的 UTXO

Alice 向 Bob 支付， Alice 通常拿到的是 Bob 的地址，地址只是一串对用户更友好字符串，真正进入交易数据的是脚本（scriptPubKey），我们需要解析接收者地址生成 scriptPubKey 。


#### 了解 P2PKH 地址是怎么生成 

P2PKH 地址在比特币主网上通常以 `1` 开头 (`1xxxxxxx`)，在测试网则以 `m` 或 `n` 开头，这是 **Base58Check 编码**后的字符串更易于人工传输与校验。

Base58Check 是对原始数据做 `version || data` 拼接后，追加 4 字节校验和的编码方式：
```
version = 0x00               # 主网 P2PKH，测试网为 0x6f
data = pubKeyHash (20 bytes) # RIPEMD160(SHA256(pubkey))
checksum = SHA256(SHA256(version+data))[:4]
```

编码流程：先对三段数据拼接，再做 Base58 编码（使用 58 个字符去掉 0/O/I/l 等易混淆符号），这样用户输入或复制时若有错误，校验和会立即暴露问题。

#### 从地址中解码出 pubKeyHash 并构建 scriptPubKey

把 Base58Check 字符串 decode 后得到三段原始数据：
```
version = 0x00 （P2PKH）
pubKeyHash = <20 bytes>
checksum  = <4 bytes>
```
校验和确认无误以后，中间的 pubKeyHash 这 20 个字节。它是公钥做 HASH160 后的结果，就是 scriptPubKey 锁定脚本需要的关键信息。

接下来分两步把它塞进 scriptPubKey。

1. **准备数据**：将 `pubKeyHash` 当作常量压栈。
2. **拼出 P2PKH 模板**：按固定指令序列生成锁定脚本：
   
```
scriptPubKey = [
  OP_DUP,
  OP_HASH160,
  <pubKeyHash>,      # 刚刚解码得到的 20 字节
  OP_EQUALVERIFY,
  OP_CHECKSIG
]
```

Alice 在给 Bob 支付时，其实是支付给包含 Bob 的 pubKeyHash 的这个锁定脚本。

### 3：构造完整交易结构

现在我们可以构建完整的交易结构了。

Alice 获取到 UTXO 作为输入：
 
```
inputs = [
{
txid: <前一个交易>
vout: <输出索引>
scriptSig: "" // 此时为空，之后签名补上
sequence: ffffffff
}
]
```

输入部分此时 scriptSig 仍为空，等签名完成后再补上。

假设 Alice 给 Bob 支付 0.009 BTC，并把 0.0009 BTC 找回给自己，则需要准备两个输出：
```
outputs = [
{
value: 0.009 BTC,
scriptPubKey: OP_DUP OP_HASH160 <bobPubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
},
{
value: 0.0009 BTC,
scriptPubKey: OP_DUP OP_HASH160 <alicePubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
}
]

把输入和输出拼在一起，就得到了完整的交易骨架：

```json
{
  version: 2,
  inputs: [
    {
      previous_output: {
        txid: 6ba7cb837205a44c59b205a3c9d01077f6e2968a1941d7b9756d43fe4d1682d7,
        vout: 1
      },
      scriptSig: "" // 待签名
      sequence: 0xffffffff
    }
  ],
  outputs: [
    {
      value: 900000, // 0.009 BTC
      scriptPubKey: OP_DUP OP_HASH160 <bobPubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
    },
    {
      value: 90000, // 0.0009 BTC (找零)
      scriptPubKey: OP_DUP OP_HASH160 <alicePubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
    }
  ],
  locktime: 0
}
```

但我们要将交易发送到网络，需要把上述对象序列化，即使用二进制表示（通常写成 Hex）数据。比特币交易序列化比较简单，它是按如下约定的方式把数据拼接在一起。

![比特币交易结构](https://img.learnblockchain.cn/pics/20251125171257.png)

数据布局由固定字段 + 变长字段组成：
**交易整体字段：**
| 字段 | 大小 | 说明 |
|------|------|------|
| version | 4 bytes | 交易版本号 |
| input_count | 1-9 bytes | 输入数量（VarInt） |
| inputs | 变长 | 输入列表 |
| output_count | 1-9 bytes | 输出数量（VarInt） |
| outputs | 变长 | 输出列表 |
| locktime | 4 bytes | 锁定时间 |

**单个输入的结构：**
| 字段 | 大小 | 说明 |
|------|------|------|
| previous_txid | 32 bytes | 前一交易的 ID（小端序） |
| previous_vout | 4 bytes | 前一交易的输出索引 |
| scriptSig_size | 1-9 bytes | scriptSig 长度（VarInt） |
| scriptSig | 变长 | 解锁脚本 |
| sequence | 4 bytes | 序列号（通常为 0xffffffff） |

**单个输出的结构：**
| 字段 | 大小 | 说明 |
|------|------|------|
| value | 8 bytes | 金额（satoshi，小端序） |
| scriptPubKey_size | 1-9 bytes | scriptPubKey 长度（VarInt） |
| scriptPubKey | 变长 | 锁定脚本 |


有兴趣的同学可通过 [breakout-p2pkh-tx-cal-txid.ts](https://github.com/lbc-team/hello_bitcoin/blob/main/src/breakout-p2pkh-tx-cal-txid.ts) 探究交易细节。

### 4：签名 

比特币采用 **ECDSA**（椭圆曲线数字签名算法）并使用 **secp256k1** 曲线。我们可以把私钥当做是解锁 scriptPubKey 的钥匙，签名作为一个解锁过程。

#### 准备签名内容 signature preimage

签名内容通常称为 `signature preimage` 
SIGHASH 决定签名覆盖的范围，通常是 SIGHASH_ALL， 其他几个类型有：

| 类型 | 值 | 覆盖范围 | 常见用途 |
|------|---|---------|---------|
| SIGHASH_ALL | 0x01 | 所有输入 + 所有输出 | 默认，锁死整笔交易 |
| SIGHASH_NONE | 0x02 | 所有输入 | 输出开放，适合协同补充 |
| SIGHASH_SINGLE | 0x03 | 所有输入 + 同索引输出 | 只对自己的那笔输出负责 |
| SIGHASH_ANYONECANPAY | 0x80 | 当前输入 | 允许他人追加额外输入 |


在使用 `SIGHASH_ALL` 类型时签名，signature preimage 是在上一步签名序列化的内容上，将 `scriptSig` 留空的替换为其引用的 UTXO 的 `scriptPubKey` ，并在末尾追加 4 字节小端的 `sighash_type` （此时为小端的 `0x01` ）。

```
signature_preimage = SHA256(SHA256(serialized_transaction + sighash_type))
```

#### 计算原像摘要并签名

 **计算消息摘要**：对上述序列化结果做双重 SHA256：
```
tx_hash = SHA256(SHA256(signature_preimage))
```
 **执行 ECDSA 签名**：使用私钥得到 `(r, s)` 对， 用 DER 编码格式封装一下，最后再补充 1 字节 `sighash_type` ，形成真正写回交易的签名字节串。
 
签名完成后，需要把“签名 + 公钥”写回输入的 `scriptSig`：

```
<sig_len> <DER_signature || sighash_type>
<pub_len> <pubkey_bytes>
```

示例（Hex）：

```
48 3045022100c7e2...26c42a01   # 72 字节 DER + 0x01 (SIGHASH_ALL)
21 0371cf1060c2693a...1d8455   # 33 字节压缩公钥
```

当 `scriptSig` 写好后，完整的交易才算真正签名完成，可以进行广播了。

###  交易广播

交易广播很简单，就是将完整的交易序列化后的16 进制通过节点的 RPC 或  API 发送到比特币网络。

使用 **Bitcoin Core RPC**
```bash
bitcoin-cli sendrawtransaction <tx_hex>
```

使用 **区块链浏览器 API**
```bash
POST https://mempool.space/api/tx
Body: <tx_hex>
```

发送后，我们可以在浏览器中，通过交易 ID 查看的交易的打包情况，交易ID 是 tx_hex 的两次 sha256 ：

```
tx_id = sha256(sha256((tx_hex)) 
```


## 矿工如何验证交易并执行

当矿工（或全节点）收到一笔交易后，需要进行多层次的验证，包括：
- 检查交易格式的有效性（输入/输出结构、字段完整性等）
- 检查金额的有效性（输入总额需大于等于输出总额）
- 检查输入引用的 UTXO 是否存在且未被花费
- 对于 P2PKH 交易，核心是验证 **scriptSig 能否解锁 scriptPubKey**

验证通过后，矿工会将交易加入内存池，并按照交易手续费（输入总额 - 输出总额）排序，优先打包手续费更高的交易。

### 理解比特币脚本系统

比特币使用一种**基于栈的脚本语言**（Script），栈是使用后进先出（LIFO）的数据结构

比特币脚本使用一个**主栈**（Main Stack）和一个**备用栈**（Alt Stack）, 是两个独立的 LIFO 栈, 绝大部分脚本执行**只用主栈**，备用栈是一个临时存储栈，不能执行操作，主要作用是保留某些脚本的中间值。


比特币操作码（opcode）会定义如何操作栈，例如： 
1. 从 主栈（main stack）取几个值
2. 怎么处理这些值
3. 把结果压回栈中
4. 是否需要访问备用栈（alt stack）

我们在[这里](https://btctools.org/opcodes-list) 可以看到所有的opcode 的定义

例如 ` OP_2 OP_3 OP_ADD ` 执行过程如下：

![栈操作示例](https://img.learnblockchain.cn/pics/20251125201624.png)

脚本验证（Script Validation）需要确保执行后主栈（main stack）顶部是 True 。
 
### P2PKH 脚本验证详解

在验证交易时，节点会从交易中提取两个关键脚本：

1. **scriptSig（解锁脚本）**：从当前交易的输入中获取
   - 遍历交易的 `inputs` 数组
   - 对每个输入，读取其 `scriptSig` 字段
   - 对于 P2PKH，`scriptSig` 包含签名和公钥：`<signature> <pubkey>` ，我们这里包含的是 Alice 的签名和公钥

2. **scriptPubKey（锁定脚本）**：从**被引用的 UTXO** 中获取，从 Alice 作为交易输入 UTXO 中提取
   - 根据输入的 `previous_txid` 和 `previous_vout`，查找前一交易的输出
   - 从该输出的 `scriptPubKey` 字段读取锁定脚本
   - 对于 P2PKH，`scriptPubKey` 格式为：`OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG`

验证时，将 `scriptSig` 和 `scriptPubKey` 按顺序拼接执行：`scriptSig + scriptPubKey`

**完整的 P2PKH 验证脚本：**
```
<signature> <pubkey>  OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
```
若执行后最终栈顶为 true（非零值）则验证通过


**逐步执行过程如下**

![P2PKH 验证脚本执行流程](https://img.learnblockchain.cn/pics/20251125210451.png)

这里有双重验证：
- OP_EQUALVERIFY: 验证公钥所有权（pubkey → pubKeyHash）
- OP_CHECKSIG: 验证私钥所有权（signature + pubkey）

### OP_CHECKSIG 深入解析

`OP_CHECKSIG` 是最复杂的操作码，它执行以下步骤：

**1. 提取 Sighash Type**

从签名的最后一个字节提取 sighash type。例如：
```
304502...2a01
└─ 0x01 (SIGHASH_ALL)
```

**2. 构造签名原像（Signature Preimage）**

验证时需要重新构造签名原像，这是因为签名和验证的流程是对称的：

- **签名时**：使用私钥对交易哈希签名
  ```
  signature = sign(private_key, tx_hash)
  ```

- **验证时**：使用公钥验证签名是否匹配交易哈希
  ```
  result = verify(pubkey, signature, tx_hash)
  ```

为了验证签名，节点需要重新计算出相同的 `tx_hash`。具体做法是：
1. 根据提取的 sighash type，重新构建交易的副本
2. 将所有输入的 `scriptSig` 清空，只将当前输入临时替换为被引用 UTXO 的 `scriptPubKey`
3. 根据 sighash type 决定保留哪些输入和输出（SIGHASH_ALL 保留全部）
4. 序列化交易并追加 4 字节的 sighash type，得到签名原像

**3. 计算交易哈希**

对签名原像执行双重 SHA256：
```
tx_hash = SHA256(SHA256(签名原像))
```

**4. ECDSA 验证**

使用 secp256k1 曲线进行 ECDSA 验证：
```
result = secp256k1_verify(
    public_key=pubkey,
    signature=(r, s),
    message=tx_hash
)
```

如果验证通过，`OP_CHECKSIG` 将 1（true）压入栈；否则压入 0（false）。

如果栈顶是 1，则脚本验证通过。但交易要最终生效，还需要通过矿工打包执行，矿工会对**手续费检查**，以确实其有足够的收益。

#### 手续费如何收取

比特币的手续费机制非常巧妙：**手续费不需要显式输出，而是通过输入和输出的差额自动计算**。

**手续费计算公式：**
```
手续费 = 所有输入 UTXO 的金额总和 - 所有输出的金额总和
```

**示例：**
假设 Alice 花费一个 0.01 BTC 的 UTXO，向 Bob 支付 0.009 BTC，找零 0.0009 BTC：
```
输入总额：  0.01 BTC
输出总额：  0.009 + 0.0009 = 0.0099 BTC
手续费：    0.01 - 0.0099 = 0.0001 BTC (10000 satoshi)
```

这 0.0001 BTC 不会出现在交易的任何输出中，而是作为"差额"被矿工收取。当交易被打包进区块后，矿工在构造区块的 coinbase 交易时，可以将所有交易的手续费累加到自己账户。


**手续费检查：**

1. **基本检查**：输入总额必须 ≥ 输出总额（否则交易无效）
   - 输入总额 = 输出总额：零手续费交易，允许但可能被矿工忽略
   - 输入总额 > 输出总额：差额就是手续费

2. **交易大小与手续费费率**

   矿工不是简单地按手续费金额排序，而是按**手续费费率（fee rate）**排序：
   ```
   手续费费率 = 手续费总额 / 交易大小（字节）
   单位：sat/vB（satoshi per virtual byte，聪/虚拟字节）
   ```

  矿工通常会按费率从高到低排序交易，优先打包费率高的交易，直到区块接近满，这样矿工可以在有限空间内获得最大收益。

在矿工打包之后，才算是真正完成了这笔交易。


有兴趣的朋友可以使用 [send-p2pkh.ts](https://github.com/lbc-team/hello_bitcoin/blob/main/src/send-p2pkh.ts) 发起一笔自己的交易。

## 总结

P2PKH 交易的完整流程：
1. **UTXO 模型**：比特币使用未花费输出作为账本状态
2. **交易构造**：选择 UTXO，构造输入输出，签名证明所有权
3. **脚本执行**：通过基于栈的脚本语言验证交易有效性
   
**核心机制：**
- 锁定脚本（scriptPubKey）定义"如何解锁"
- 解锁脚本（scriptSig）提供"证明"
- 脚本执行验证"证明"满足"条件"

P2PKH 只是比特币脚本系统的冰山一角。更复杂的脚本类型（如多签、时间锁、哈希锁）都基于相同的执行模型构建。



