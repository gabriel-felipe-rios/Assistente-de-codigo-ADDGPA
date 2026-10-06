"""Ver o que não é texto: imagem no Editor, e um cartão para o resto.

⚠️ POR `file://` NÃO EXISTE `<img src="file:///…">`. O WebView2 recusa, e não é
contornável do lado do frontend. O padrão do projeto — e o único — é o backend
devolver **data-URI base64** e a tela pôr no `src`; foi assim que a aba Aparência
resolveu as miniaturas (`aparencia_imagens.py:328`).

⚠️ NÃO REUSA `aparencia_miniatura`. Ela faz `thumbnail(96)`, que é o que aquele
cartão precisa e o oposto do que este precisa; é função de módulo fora da ponte;
e mexer nela para servir aos dois quebraria os cartões da Aparência. O que se
reusa é a TÉCNICA, não a função.

A imagem vai em **bytes crus** sempre que couber no teto — sem reencode, sem
perda, e é isso que preserva GIF animado. Só acima do teto a Pillow entra para
reduzir, e aí a tela avisa que reduziu. Sem Pillow instalada, o caminho dos
bytes crus continua funcionando sozinho.
"""

import base64
import os

from .caminhos import *


# Acima disto a imagem é reduzida antes de virar base64. O número é do custo da
# PONTE, não do disco: base64 infla ~33%, então 2 MB de PNG viram ~2,7 MB de
# texto dentro de um JSON atravessando o pywebview.
_ED_BIN_TETO_BYTES = 2 * 1024 * 1024

# Extensão → mime. Só o que o WebView2 desenha em <img>.
_ED_BIN_IMAGENS = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.avif': 'image/avif',
}


class EditorBinariosMixin:
    """A pré-visualização de arquivo que o editor de texto não abre."""

    @staticmethod
    def _ed_bin_e_imagem(caminho):
        return os.path.splitext(caminho)[1].lower() in _ED_BIN_IMAGENS

    def editor_prever_binario(self, project_name, caminho_relativo):
        """A imagem como data-URI, ou os dados para o cartão de "não abre"."""
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            if not os.path.isfile(alvo):
                return {'success': False, 'error': 'Esse arquivo não existe mais.'}
            tamanho = os.path.getsize(alvo)
            ext = os.path.splitext(alvo)[1].lower()

            if not self._ed_bin_e_imagem(alvo):
                return {'success': True, 'tipo': 'binario',
                        'bytes': tamanho, 'extensao': ext or '(sem extensão)'}

            mime = _ED_BIN_IMAGENS[ext]

            # SVG é texto: vai inteiro, sem teto de redução (reduzir vetor não
            # faz sentido) — só o teto de tamanho bruto.
            if ext == '.svg':
                if tamanho > _ED_BIN_TETO_BYTES:
                    return {'success': True, 'tipo': 'binario',
                            'bytes': tamanho, 'extensao': ext,
                            'aviso': 'SVG grande demais para pré-visualizar.'}
                with open(alvo, 'rb') as f:
                    dados = f.read()
                return {'success': True, 'tipo': 'imagem', 'mime': mime,
                        'bytes': tamanho, 'reduzida': False,
                        'data_uri': 'data:image/svg+xml;base64,'
                                    + base64.b64encode(dados).decode('ascii')}

            if tamanho <= _ED_BIN_TETO_BYTES:
                # Bytes crus: tamanho real, sem reencode, e o GIF continua
                # animando. Passar pela Pillow aqui congelaria o primeiro quadro.
                with open(alvo, 'rb') as f:
                    dados = f.read()
                return {'success': True, 'tipo': 'imagem', 'mime': mime,
                        'bytes': tamanho, 'reduzida': False,
                        'data_uri': f'data:{mime};base64,'
                                    + base64.b64encode(dados).decode('ascii')}

            # Acima do teto: reduz. Se a Pillow não estiver instalada, o
            # caminho honesto é dizer que não dá — não mandar 8 MB pela ponte.
            try:
                from PIL import Image
                import io as _io
                imagem = Image.open(alvo)
                imagem = imagem.convert('RGBA')
                imagem.thumbnail((1600, 1600))
                buf = _io.BytesIO()
                imagem.save(buf, format='PNG')
                return {'success': True, 'tipo': 'imagem', 'mime': 'image/png',
                        'bytes': tamanho, 'reduzida': True,
                        'data_uri': 'data:image/png;base64,'
                                    + base64.b64encode(buf.getvalue()).decode('ascii')}
            except Exception:
                return {'success': True, 'tipo': 'binario',
                        'bytes': tamanho, 'extensao': ext,
                        'aviso': 'Imagem grande demais para pré-visualizar aqui.'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
