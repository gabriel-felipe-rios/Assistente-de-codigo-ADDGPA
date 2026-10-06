"""O único arquivo desta extensão que abre arquivo."""

import json

from . import tin_caminhos


def ler_cores():
    try:
        with open(tin_caminhos.CORES_FILE, 'r', encoding='utf-8') as f:
            dados = json.load(f)
    except FileNotFoundError:
        # O caso NORMAL de quem nunca tingiu nada. Não é erro.
        return {}
    except (OSError, json.JSONDecodeError) as e:
        print('[tin] nao deu para ler as cores:', e)
        return {}
    return dados if isinstance(dados, dict) else {}


def gravar_cores(cores):
    tin_caminhos.garantir_pasta()
    with open(tin_caminhos.CORES_FILE, 'w', encoding='utf-8') as f:
        json.dump(cores, f, ensure_ascii=False, indent=2)
