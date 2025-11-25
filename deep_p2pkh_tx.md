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
5. 发送给矿工节点


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

但我们要将交易发送到网络，需要把上述对象序列化，使用二进制表示（通常写成 Hex）。序列化数据布局由固定字段 + 变长字段组成：

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

![比特币交易结构](https://img.learnblockchain.cn/pics/20251125171257.png)

breakout-p2pkh-tx-cal-txid.ts

### 4：签名 

比特币使用 **ECDSA**（Elliptic Curve Digital Signature Algorithm）在 **secp256k1** 曲线上进行签名。

签名是交易构造中最关键的步骤。它证明了你有权花费某个 UTXO。

#### 📝 签名的目的

1. **证明所有权**：只有知道私钥的人才能创建有效签名
2. **防止篡改**：签名覆盖交易的关键部分，任何修改都会使签名失效
3. **防止重放**：签名是针对特定交易的，不能用于其他交易
 

#### 📋 签名流程详解

**第一步：构造签名 (Signature Preimage)**
 
**第二步：计算交易哈希**
```python

# Double SHA256

tx_hash = SHA256(SHA256(signature_preimage))
```
**第三步：使用私钥签名**
```python

# ECDSA 签名

(r, s) = ecdsa_sign(private_key, tx_hash)

# DER 编码
signature_der = der_encode(r, s)
# 添加 sighash type

signature_final = signature_der + bytes([sighash_type])
```
**DER 编码格式：**
```
30 DER 签名标记
<length> 总长度
02 INTEGER 标记 (r)
<r_length> r 的长度
<r_bytes> r 的值
02 INTEGER 标记 (s)
<s_length> s 的长度
<s_bytes> s 的值
```
示例：
```
30 45 DER 签名，长度 69
02 21 r: INTEGER, 长度 33
00 c7 e2 b6 8e 51 57 63 r 的值 (33 bytes)
28 6d 9f 77 60 45 72 80
21 f0 8e 74 a0 7e 60 75
75 73 0c fa 20 e8 17 77 a0
02 20 s: INTEGER, 长度 32
0c 8b 96 b0 3a 6b af 25 s 的值 (32 bytes)
cf 40 d1 97 8a b2 9f 9e
e0 83 00 9e 9f d9 02 06
f9 ad ff 76 13 26 c4 2a
01 SIGHASH_ALL
```
 
#### 🏷️ SIGHASH 类型



SIGHASH 类型决定了签名覆盖交易的哪些部分：
| 类型 | 值 | 覆盖范围 | 用途 |
|------|---|---------|------|
| SIGHASH_ALL | 0x01 | 所有输入 + 所有输出 | 最常用，锁定整个交易 |
| SIGHASH_NONE | 0x02 | 所有输入 | 不关心输出，允许其他人添加 |
| SIGHASH_SINGLE | 0x03 | 所有输入 + 对应索引的输出 | 只关心特定输出 |
| SIGHASH_ANYONECANPAY | 0x80 | 当前输入 | 允许其他人添加输入 |
 
**SIGHASH_ALL 的实际含义：**
```
签名覆盖：
✓ 所有输入的 (txid, vout)
✓ 所有输出的 (value, scriptPubKey)
✓ 交易的 version 和 locktime
不覆盖：
✗ scriptSig（签名本身不能包含在签名中）
✗ witness 数据（SegWit 交易）
```
 


签名完成后，将签名和公钥组装成 scriptSig：
```
scriptSig = <signature> <pubkey>
```
**具体格式：**
```
<sig_length> <signature_der> <sighash_type> <pubkey_length> <pubkey>
```
示例（Hex）：
```
48 签名长度 (72 bytes)
30 45 02 21 00 c7 e2 ... DER 签名 (71 bytes)
01 SIGHASH_ALL
21 公钥长度 (33 bytes)
03 71 cf 10 60 c2 69 3a 压缩公钥
35 fa 25 08 61 53 0a 25
e3 06 4d f5 8a 8c a0 9b
48 c4 73 b8 38 2d 1d 84 55
```
**为什么需要公钥？**
虽然 scriptPubKey 中包含了 pubKeyHash，但验证时需要完整的公钥来：
1. 验证 `HASH160(pubKey) == pubKeyHash`
2. 验证 `ECDSA_VERIFY(pubKey, signature, tx_hash)`
**完整的输入：**
```
Input {
previous_output: {
txid: 6ba7cb837205a44c59b205a3c9d01077f6e2968a1941d7b9756d43fe4d1682d7
vout: 1
}
scriptSig: <signature> <pubkey> ← 已填充
sequence: 0xffffffff
}
```
得到最终交易数据。




### 7：序列化并广播到比特币网络



**序列化：**
将交易结构转换为二进制格式（Hex）：
```python
def serialize_transaction(tx):
result = b''



# Version (4 bytes, little endian)

result += tx.version.to_bytes(4, 'little')



# Input count (VarInt)

result += varint(len(tx.inputs))



# Inputs

for inp in tx.inputs:
result += bytes.fromhex(inp.txid)[::-1] # Reverse for little endian
result += inp.vout.to_bytes(4, 'little')
result += varint(len(inp.scriptSig))
result += inp.scriptSig
result += inp.sequence.to_bytes(4, 'little')



# Output count (VarInt)

result += varint(len(tx.outputs))



# Outputs

for out in tx.outputs:
result += out.value.to_bytes(8, 'little')
result += varint(len(out.scriptPubKey))
result += out.scriptPubKey



# Locktime (4 bytes, little endian)

result += tx.locktime.to_bytes(4, 'little')
return result
```
**广播：**
```python

# 1. 计算交易 ID

tx_hex = serialize_transaction(tx).hex()
tx_id = sha256(sha256(bytes.fromhex(tx_hex)))[::-1].hex()



# 2. 通过 RPC 或 API 广播

broadcast_transaction(tx_hex)
```
**广播方式：**
1. **Bitcoin Core RPC**
```bash
bitcoin-cli sendrawtransaction <tx_hex>
```
2. **区块链浏览器 API**
```bash
POST https://mempool.space/api/tx
Body: <tx_hex>
```
3. **P2P 网络**
```
发送 INV 消息 → 其他节点请求 GETDATA → 发送完整交易
```
---



## 交易的执行



当矿工（或全节点）收到一笔交易后，需要验证交易的有效性。对于 P2PKH 交易，核心是验证 **scriptSig 能否解锁 scriptPubKey**。



### 🎯 比特币脚本系统



比特币使用一种**基于栈的脚本语言**（Script），类似于 Forth 语言。



**核心特性：**
| 特性 | 说明 |
|------|------|
| **基于栈** | 使用后进先出（LIFO）的数据结构 |
| **非图灵完备** | 没有循环，保证脚本会终止 |
| **确定性** | 相同输入总是产生相同输出 |
| **无状态** | 不访问外部状态，只操作栈 |
**为什么非图灵完备？**
防止脚本无限循环，确保所有节点都能在有限时间内验证交易。



### 📚 脚本执行模型



比特币脚本使用一个**主栈**（Main Stack）和一个**备用栈**（Alt Stack）。



**栈操作示例：**
```
初始状态：
Stack: []
执行 OP_2:
Stack: [2]
执行 OP_3:
Stack: [2, 3]
执行 OP_ADD:
弹出 3
弹出 2
计算 2 + 3 = 5
压入 5
Stack: [5]
```



### 🔍 P2PKH 脚本验证详解



**完整的 P2PKH 验证脚本：**
```
scriptSig: <signature> <pubkey>
scriptPubKey: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
```
**执行顺序：**
1. 先执行 scriptSig（解锁脚本）
2. 再执行 scriptPubKey（锁定脚本）
3. 最终栈顶为 true（非零值）则验证通过
---



### 📖 逐步执行过程



假设：
- `<signature>` = `304502...01` (DER 签名 + SIGHASH_ALL)
- `<pubkey>` = `0371cf1060c269...` (压缩公钥)
- `<pubKeyHash>` = `62e907b15cbf27...` (20 bytes)
---



#### **初始状态**



```
Script: <signature> <pubkey> OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
Stack: []
```
---



#### **步骤 1：压入 signature**



```
Operation: <signature>
Action: 将签名数据压入栈
Stack: [
<signature>
]
```
---



#### **步骤 2：压入 pubkey**



```
Operation: <pubkey>
Action: 将公钥数据压入栈
Stack: [
<signature>
<pubkey>
]
```
**此时 scriptSig 执行完毕。**
---



#### **步骤 3：OP_DUP 复制栈顶**



```
Operation: OP_DUP
Action: 复制栈顶元素（pubkey）
Stack: [
<signature>
<pubkey>
<pubkey> ← 复制的
]
```
**为什么需要复制？**
因为后面的 OP_HASH160 会消耗一个 pubkey，但 OP_CHECKSIG 还需要一个 pubkey。



---



#### **步骤 4：OP_HASH160 哈希栈顶**



```
Operation: OP_HASH160
Action:
1. 弹出栈顶的 <pubkey>
2. 计算 RIPEMD160(SHA256(<pubkey>))
3. 压入哈希结果
Stack: [
<signature>
<pubkey>
<pubKeyHash_computed> ← HASH160(pubkey)
]
```
---



#### **步骤 5：压入预期的 pubKeyHash**



```
Operation: <pubKeyHash>
Action: 将 scriptPubKey 中的 pubKeyHash 压入栈
Stack: [
<signature>
<pubkey>
<pubKeyHash_computed>
<pubKeyHash_expected> ← scriptPubKey 中的
]
```
---



#### **步骤 6：OP_EQUALVERIFY 验证相等**



```
Operation: OP_EQUALVERIFY
Action:
1. 弹出栈顶两个元素
2. 比较 pubKeyHash_computed == pubKeyHash_expected
3. 如果相等，继续；否则脚本失败
比较：
pubKeyHash_computed = 62e907b15cbf27...
pubKeyHash_expected = 62e907b15cbf27...
结果: ✓ 相等
Stack: [
<signature>
<pubkey>
]
```
**此步骤验证了：提供的公钥确实对应这个地址（pubKeyHash）。**
---



#### **步骤 7：OP_CHECKSIG 验证签名**



```
Operation: OP_CHECKSIG
Action:
1. 弹出 <pubkey>
2. 弹出 <signature>
3. 提取 signature 中的 sighash type
4. 构造签名前置（signature preimage）
5. 计算交易哈希
6. 使用 ECDSA 验证: VERIFY(pubkey, signature, tx_hash)
7. 压入验证结果（true 或 false）
验证过程：
a. 解析 signature，提取 sighash type (0x01 = SIGHASH_ALL)
b. 根据 sighash type 构造签名前置
c. 计算 tx_hash = SHA256(SHA256(签名前置))
d. ECDSA 验证: secp256k1_verify(pubkey, signature, tx_hash)
e. 结果: ✓ 签名有效
Stack: [
1 ← true (签名验证成功)
]
```
**此步骤验证了：签名者拥有对应公钥的私钥。**
---



#### **最终状态**



```
Script: (已全部执行)
Stack: [1]
栈顶 = 1 (true)
验证结果: ✓ 交易有效
```
---



### 🔐 OP_CHECKSIG 深入解析



`OP_CHECKSIG` 是最复杂的操作码，它执行以下步骤：



#### **1. 提取 Sighash Type**



```
signature 的最后一个字节是 sighash type
例如：304502...2a01
└─ 0x01 (SIGHASH_ALL)
```



#### **2. 构造签名前置**



根据 sighash type 修改交易的副本：
```python
def create_sighash_preimage(tx, input_index, prev_scriptPubKey, sighash_type):
tx_copy = tx.copy()
if sighash_type == SIGHASH_ALL:

# 清空所有输入的 scriptSig

for i, inp in enumerate(tx_copy.inputs):
if i == input_index:
inp.scriptSig = prev_scriptPubKey # 当前输入使用 prev scriptPubKey
else:
inp.scriptSig = b'' # 其他输入清空
elif sighash_type == SIGHASH_NONE:

# 清空所有输出

tx_copy.outputs = []

# ...



elif sighash_type == SIGHASH_SINGLE:

# 只保留对应索引的输出

# ...



# 序列化并添加 sighash type

serialized = tx_copy.serialize()
serialized += sighash_type.to_bytes(4, 'little')
return serialized
```



#### **3. 计算交易哈希**



```
tx_hash = SHA256(SHA256(签名前置))
```



#### **4. ECDSA 验证**



```
result = secp256k1_verify(
public_key=pubkey,
signature=(r, s),
message=tx_hash
)
```
**验证公式（ECDSA）：**
```
已知：
- 公钥 Q = d × G (d 是私钥)
- 签名 (r, s)
- 消息哈希 e
验证：
1. w = s⁻¹ mod n
2. u₁ = e × w mod n
3. u₂ = r × w mod n
4. (x, y) = u₁ × G + u₂ × Q
5. 验证 x mod n == r
```
如果验证通过，OP_CHECKSIG 压入 1（true）；否则压入 0（false）。



---



### 🚫 常见失败情况



| 失败原因 | 发生在哪一步 | 错误描述 |
|---------|------------|---------|
| **公钥不匹配** | OP_EQUALVERIFY | HASH160(pubkey) ≠ pubKeyHash |
| **签名无效** | OP_CHECKSIG | ECDSA 验证失败 |
| **UTXO 已花费** | 验证前 | 输入引用的 UTXO 不在 UTXO 集合中 |
| **金额不平衡** | 验证前 | 输入总额 < 输出总额 + 手续费 |
| **脚本格式错误** | 任意步骤 | 栈下溢、数据不足等 |
---



### 🎨 可视化执行流程



```
┌─────────────────────────────────────────────────────────────┐
│ 交易验证流程 │
└─────────────────────────────────────────────────────────────┘
1. 基本验证
├─ 语法检查 ✓
├─ 输入/输出格式 ✓
└─ 金额有效性 ✓
2. 输入验证（对每个输入）
├─ 查找前一交易的输出
│ └─ UTXO 是否存在？ ✓
│
├─ 获取 scriptPubKey
│ └─ scriptPubKey = UTXO.scriptPubKey
│
├─ 组合脚本
│ └─ script = scriptSig + scriptPubKey
│
├─ 执行脚本
│ ├─ 1: <signature> → Stack
│ ├─ 2: <pubkey> → Stack
│ ├─ 3: OP_DUP → Stack
│ ├─ 4: OP_HASH160 → Stack
│ ├─ 5: <pubKeyHash> → Stack
│ ├─ 6: OP_EQUALVERIFY → Verify
│ └─ 7: OP_CHECKSIG → Verify
│
└─ 检查栈顶
└─ 栈顶 == true? ✓
3. 全局验证
├─ 输入总额 ≥ 输出总额 ✓
└─ 交易费合理 ✓
4. 结果
└─ ✅ 交易有效，加入内存池或区块
```
---



### 💡 关键洞察



1. **双重验证**
- OP_EQUALVERIFY: 验证公钥所有权（pubkey → pubKeyHash）
- OP_CHECKSIG: 验证私钥所有权（signature + pubkey）
2. **脚本组合**
- scriptSig 由花费方提供（证明）
- scriptPubKey 由 UTXO 定义（条件）
- 两者组合执行，实现"锁"与"钥匙"的验证
3. **安全性保证**
- 即使知道公钥，也无法伪造签名（ECDSA 安全性）
- 篡改交易任何部分都会使签名失效
- 重放签名到其他交易也会失败（签名包含交易哈希）
4. **效率设计**
- 栈操作简单高效
- 脚本确定性终止
- 并行验证不同输入
---



### 🔬 实践：手动验证一笔交易



让我们用实际数据验证一笔交易：
**交易 Hex:**
```
0200000001d782164dfe436d75b9d741198a96e2f67710d0c9a305b2594ca4057283cba76b
010000006b483045022100c7e2b68e515763286d9f776045728021f08e74a07e607575
730cfa20e81777a002200c8b96b03a6baf25cf40d1978ab29f9ee083009e9fd90206f9
adff761326c42a01210371cf1060c2693a35fa250861530a25e3064df58a8ca09b48c4
73b8382d1d8455ffffffff0100100000000000001976a914de8d00e55147f27899833b
27fe906499ebcadee188ac00000000
```
**解析：**
1. **version:** `02000000` = 2
2. **输入数量:** `01` = 1
3. **输入 #0:**
- txid: `6ba7cb837205a44c59b205a3c9d01077f6e2968a1941d7b9756d43fe4d1682d7`
- vout: `01000000` = 1
- scriptSig: `483045...8455` (107 bytes)
- 签名: `3045022100c7e2...c42a01`
- 公钥: `0371cf1060c269...1d8455`
4. **输出数量:** `01` = 1
5. **输出 #0:**
- value: `0010000000000000` = 4096 sats
- scriptPubKey: `76a914de8d...ee188ac` (P2PKH)
**验证步骤：**
```
1. 执行 scriptSig:
Stack: [<sig>, <pubkey>]
2. 执行 scriptPubKey:
OP_DUP: Stack: [<sig>, <pubkey>, <pubkey>]
OP_HASH160: Stack: [<sig>, <pubkey>, <hash>]
<pubKeyHash>: Stack: [<sig>, <pubkey>, <hash>, <expected_hash>]
OP_EQUALVERIFY: Stack: [<sig>, <pubkey>] (如果相等)
OP_CHECKSIG: Stack: [1] (如果签名有效)
3. 最终: Stack = [1] → ✅ 验证通过
```
---



## 总结



P2PKH 交易的完整流程：
1. **UTXO 模型**：比特币使用未花费输出作为账本状态
2. **交易构造**：选择 UTXO，构造输入输出，签名证明所有权
3. **脚本执行**：通过基于栈的脚本语言验证交易有效性
**核心机制：**
- 锁定脚本（scriptPubKey）定义"如何解锁"
- 解锁脚本（scriptSig）提供"证明"
- 脚本执行验证"证明"满足"条件"
这种设计实现了：
- ✅ **去中心化**：无需可信第三方验证
- ✅ **安全性**：密码学保证无法伪造
- ✅ **可扩展性**：脚本系统支持复杂条件
- ✅ **确定性**：相同输入总是相同结果
P2PKH 只是比特币脚本系统的冰山一角。更复杂的脚本类型（如多签、时间锁、哈希锁）都基于相同的执行模型构建。



