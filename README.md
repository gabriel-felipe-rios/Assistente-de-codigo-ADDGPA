# Requisitos

## Requisitos do sistema

* Windows
* Python 3.11.2
* Git LFS

## Dependências Python

As dependências Python do programa são divididas em duas partes, pois são instaladas em locais diferentes.

### Instaladas em `Program/Dependencies/`

Estas dependências são instaladas localmente dentro da pasta `Program/Dependencies/`:

```text
tree-sitter==0.26.0
tree-sitter-language-pack==0.13.0
tree-sitter-c-sharp==0.23.5
tree-sitter-embedded-template==0.25.0
tree-sitter-yaml==0.7.2
```

Instalação:

```bash
pip install --target "Program/Dependencies" -r "requirements-dependencies.txt"
```

### Instaladas no Python do sistema

Estas dependências devem ser instaladas normalmente no Python utilizado pelo programa:

```text
pywebview==6.1
pywinpty==3.0.5
pywinauto==0.6.9
pywin32==312
pynput==1.8.1
Pillow==10.4.0
numpy==2.4.6
openai==2.8.1
tiktoken==0.12.0
onnxruntime==1.23.2
tokenizers==0.23.2
```

## Observações

A instalação das dependências deve respeitar a divisão acima.

As dependências da família **Tree-sitter** são instaladas especificamente em `Program/Dependencies/` e não devem ser instaladas usando `--target` junto com todas as demais dependências.

O projeto também utiliza um modelo `.onnx` armazenado por meio do **Git LFS**, devido ao tamanho do arquivo.
