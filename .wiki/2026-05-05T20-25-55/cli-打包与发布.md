Now I have all the information needed. Let me write the page.

---

# CLI 打包与发布

## 包装配的骨架

`cli/pyproject.toml` 是整个 CLI 工具的**唯一包装配描述文件**。它采用 PEP 621 标准格式，内容极其精简——只声明了项目名、版本、Python 版本要求和一个脚本入口点：

```
[project]
name = "drand-draw"
version = "1.0.0"
description = "Verifiable lottery CLI tool powered by drand"
requires-python = ">=3.10"

[project.scripts]
drand-draw = "drand_draw.__main__:main"
```

这份配置值得注意的是：**没有任何 `dependencies` 声明**。原因是 CLI 的所有功能全部依赖 Python 标准库——`argparse` 处理命令行解析，`urllib.request` 调用 drand API，`hashlib` 做 SHA-256 种子派生，`json` 解析 API 响应。不需要 `requests`、`click` 或任何第三方包。

数据来源：[cli/pyproject.toml](cli/pyproject.toml#L1-L8)

---

## 入口点：drand-draw 命令

`[project.scripts]` 中的 `drand-draw = "drand_draw.__main__:main"` 告诉 pip 安装时创建一个名为 `drand-draw` 的可执行文件（Windows 上为 `drand-draw.exe`），该命令调用 `drand_draw/__main__.py` 中的 `main()` 函数。

当用户执行 `drand-draw verify ...` 时，Python 包系统自动将控制权交给 `main()`，后者通过 `argparse.subparsers` 根据第一个位置参数分发到对应的命令处理函数。

入口点函数签名：

```python
def main():
    parser = argparse.ArgumentParser(
        description='drand-draw: Verifiable lottery CLI tool powered by drand'
    )
    sub = parser.add_subparsers(dest='command', required=True)
    # ... 五个子命令注册 ...
    args = parser.parse_args()
    args.func(args)
```

数据来源：[cli/drand_draw/__main__.py](cli/drand_draw/__main__.py#L88-L122)

---

## 五子命令体系

CLI 采用 **argparse subparsers** 构建命令树，共五个子命令，每个绑定一个处理函数：

| 命令 | 处理函数 | 作用 |
|------|----------|------|
| `verify` | `cmd_verify` | 从 drand 获取随机数，验证中奖编号真实性 |
| `compute` | `cmd_compute` | 根据截止时间计算实际开奖结果 |
| `encode` | `cmd_encode` | 将抽奖参数编码为短码 |
| `decode` | `cmd_decode` | 将短码解码为可读参数 |
| `parse` | `cmd_parse` | 从任意格式文本中智能识别抽奖参数 |

所有命令共享同一套 `--chain` 选项，可使用 `quicknet`、`default`、`evmnet` 三者之一，来源自 `encode.CHAINS` 字典。

子命令注册模式完全一致：

```python
p = sub.add_parser('verify', help='Verify claimed winners against drand randomness')
p.add_argument('--chain', required=True, choices=list(encode.CHAINS))
p.add_argument('--round', required=True, type=int)
# ...
p.set_defaults(func=cmd_verify)
```

每个子命令通过 `set_defaults(func=...)` 绑定处理函数，最后 `args.func(args)` 统一分发。这是 argparse 子命令的标准用法，避免了 `if/elif` 链式判断。

数据来源：[cli/drand_draw/__main__.py](cli/drand_draw/__main__.py#L88-L122)

---

## 开发模式：直接运行

开发时无需安装即可运行 CLI。`__main__.py` 末尾的 `if __name__ == '__main__': main()` 块使包支持 `python -m` 调用：

```bash
# 从项目根目录的 cli/ 下执行
python -m drand_draw verify --chain quicknet --round 7398878 --n 100 --prizes 1,3 --winners 42,15,78,33
```

这与安装后的 `drand-draw verify ...` 行为完全一致，区别只是不创建全局可执行文件。Python 解释器执行 `__main__.py` 的流程：

1. 在 `sys.path` 中找到 `drand_draw` 包
2. 执行包内 `__main__.py`
3. `main()` 解析参数并分发

数据来源：[cli/drand_draw/__main__.py](cli/drand_draw/__main__.py#L124-L125)

---

## PyPI 发布准备

当前项目没有 CI/CD 自动发布流程，发布到 PyPI 需要手动操作。标准流程如下：

### 步骤一：构建分发包

```bash
cd cli
pip install build
python -m build
```

命令在 `cli/dist/` 下生成 `.tar.gz` 源码包和 `.whl` wheel 包。构建工具读取 `pyproject.toml` 中的元数据生成 `PKG-INFO`。

### 步骤二：上传到 PyPI

```bash
pip install twine
twine upload dist/*
```

首次发布需要先在 [pypi.org](https://pypi.org) 注册账号，并创建 API token。执行 `twine upload` 时输入用户名 `__token__`，密码为 token 值。

### 版本管理

`version = "1.0.0"` 定义在 `pyproject.toml` 中。更新版本后需要：

1. 修改 `pyproject.toml` 中的 `version` 字段
2. 重新 `python -m build`
3. 重新 `twine upload`

建议在 `pyproject.toml` 中补充更完整的元数据字段，以提升在 PyPI 上的展示效果：

```toml
[project]
authors = [{ name = "Epheia", email = "..." }]
license = { text = "MIT" }
readme = "README.md"
homepage = "https://github.com/epheiamoe/drand-draw"
```

数据来源：[cli/pyproject.toml](cli/pyproject.toml#L1-L8)

---

## 与网页版的约束关系

CLI 的打包发布有一个隐含约束：**算法必须与前端保持一致性**。抽奖核心算法（Round 计算、SHA-256 种子派生、碰撞处理）在 `cli/drand_draw/lottery.py` 中实现，前端在 `src/lib/lottery.ts` 中实现。两个实现必须产生相同的结果，否则 CLI 验证会失败。

详细算法规范参见 [抽奖核心算法](抽奖核心算法.md)。

---

## 下一步

- 安装 CLI 后，参阅 [CLI 工具安装与基础用法](cli-工具安装与基础用法.md) 学习各命令的具体用法
- 算法一致性验证：阅读 [算法规范与测试向量](算法规范与测试向量.md) 确保 CLI 与前端输出一致
- 了解 [短码编解码规范](短码编解码规范.md) 中 CLI 如何参与编解码流程