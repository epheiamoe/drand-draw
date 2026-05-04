# drand-draw CLI

Verifiable lottery CLI tool powered by drand.

## Install

```bash
pip install .
```

## Usage

### verify
```bash
drand-draw verify --chain quicknet --round 1234567 --n 100 --prizes 1,3 --winners 42,15,78,33
```

### compute
```bash
drand-draw compute --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3
```

### encode
```bash
drand-draw encode --chain quicknet --deadline 1715000000 --n 100 --prizes 1,3 --winners 42,15,78,33
```

### decode
```bash
drand-draw decode q-66364280-2s-1,3-2a,f,4e
```

## Run without install

```bash
python -m drand_draw verify --chain quicknet --round 1234567 --n 100 --prizes 1,3 --winners 42,15,78,33
```
