#!/bin/bash
set -e

echo "🔍 检查 Bitcoin Core 是否安装..."
if ! command -v bitcoind &> /dev/null; then
  echo "⚙️ 未检测到 Bitcoin Core，正在安装..."
  brew install bitcoin
fi

CONFIG_DIR="$HOME/Library/Application Support/Bitcoin"
CONF_FILE="$CONFIG_DIR/bitcoin.conf"

echo "📁 创建配置文件目录: $CONFIG_DIR"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONF_FILE" ]; then
  echo "📝 创建配置文件..."
  cat <<EOF > "$CONF_FILE"
chain=testnet4
server=1
rpcuser=user
rpcpassword=pass
EOF
else
  echo "⚠️ 已存在 bitcoin.conf，跳过创建。"
fi

echo "🚀 启动 bitcoind (testnet4)..."
bitcoind -chain=testnet4 -daemon

echo "⏳ 等待节点启动..."
sleep 5

echo "📡 获取区块信息..."
bitcoin-cli -chain=testnet4 getblockchaininfo || echo "请等待区块同步完成。"

# 添加命令别名
if ! grep -q "alias btc4=" ~/.zshrc; then
  echo "✨ 添加快捷命令别名到 ~/.zshrc"
  echo "alias btc4='bitcoin-cli -chain=testnet4'" >> ~/.zshrc
  source ~/.zshrc
fi

echo "✅ 设置完成！你现在可以使用以下命令："
echo ""
echo "  ▶ 查看区块高度：    btc4 getblockcount"
echo "  ▶ 获取区块信息：    btc4 getblockchaininfo"
echo "  ▶ 停止节点：        btc4 stop"
echo ""
echo "数据目录: $CONFIG_DIR/testnet4"

