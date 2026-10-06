"""Como se lê um `import` em cada linguagem — os regexes, e a canonização.

Arquivo próprio porque é a metade que NÃO sabe nada do projeto: dado um texto e
um perfil de linguagem, devolve os nomes importados. Nenhuma função daqui abre
arquivo, consulta configuração ou conhece pasta. Isso deixa a outra metade
(`bibliotecas.py`) livre para responder só *o que varrer e o que mostrar*.

⚠️ OS COMENTÁRIOS SÃO TROCADOS POR ESPAÇOS, NUNCA APAGADOS. Apagar juntaria duas
linhas e criaria um `import` que não existe no arquivo — e o inventário passaria
a listar uma biblioteca que ninguém usa.

⚠️ CADA LINGUAGEM TEM O PRÓPRIO `_canon_*`, e as funções parecidas NÃO devem ser
unificadas: `import a.b.c` em Python vira `a`, `from './x'` em JS não vira nada,
e um `use std::fs` em Rust vira `std`. São regras diferentes que por acaso cabem
em poucas linhas cada.

⚠️ HTML E CSS FICAM DE FORA de propósito: lá não existe biblioteca importada,
existe arquivo carregado por URL, e tirar o nome da biblioteca de uma URL
(`d3.min.js` → `d3`) seria palpite. Numa lista informativa, uma linha adivinhada
contamina todas as outras.
"""

import re as _re
import sys

from ...constantes import *


# ══════════════════════════════════════════════════════ Comentários ══════════
# Rodam ANTES dos regexes de import. Trocam o comentário por espaços em vez de
# apagá-lo, para preservar `\n` — apagar juntaria duas linhas e criaria um
# `import` que não existe no arquivo.

def _bib_apagar(m):
    return _re.sub(r'[^\n]', ' ', m.group(0))


_BIB_BLOCO_C      = _re.compile(r'/\*.*?\*/', _re.S)
_BIB_LINHA_BARRAS = _re.compile(r'^[ \t]*//.*$', _re.M)
_BIB_PY_TRIPLO    = _re.compile(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'')
_BIB_LINHA_CERQ   = _re.compile(r'^[ \t]*#.*$', _re.M)
_BIB_RB_BLOCO     = _re.compile(r'^=begin\b[\s\S]*?^=end\b.*$', _re.M)

# C/C++ NÃO leva o perfil de cerquilha: `#include` seria apagado junto.
_BIB_COM = {
    'py':   (_BIB_PY_TRIPLO, _BIB_LINHA_CERQ),
    'c':    (_BIB_BLOCO_C, _BIB_LINHA_BARRAS),
    'rb':   (_BIB_RB_BLOCO, _BIB_LINHA_CERQ),
    'nada': (),
}


def _bib_sem_comentarios(texto, perfil):
    for rx in _BIB_COM.get(perfil, ()):
        texto = rx.sub(_bib_apagar, texto)
    return texto


# ═══════════════════════════════════════════════ Biblioteca padrão ═══════════
# O que vem junto com a linguagem — o usuário não instalou nada para ter isso.

# Python: sai do próprio interpretador que roda este programa. É constante em
# memória, não arquivo — nenhuma leitura de disco, nenhuma consulta de rede.
_BIB_STD_PY = (frozenset(getattr(sys, 'stdlib_module_names', ()))
               | frozenset(sys.builtin_module_names))

_BIB_STD_NODE = frozenset("""
assert async_hooks buffer child_process cluster console constants crypto dgram
diagnostics_channel dns domain events fs http http2 https inspector module net
os path perf_hooks process punycode querystring readline repl sea sqlite stream
string_decoder sys test timers tls trace_events tty url util v8 vm wasi
worker_threads zlib
""".split())

# Go: comparado pelo PRIMEIRO segmento (`net/http` → `net`).
_BIB_STD_GO = frozenset("""
archive arena bufio builtin bytes cmp compress container context crypto
database debug embed encoding errors expvar flag fmt go hash html image index
io iter log maps math mime net os path plugin reflect regexp runtime slices
sort strconv strings structs sync syscall testing text time unicode unique
unsafe weak
""".split())

_BIB_STD_RUST     = frozenset(('std', 'core', 'alloc', 'proc_macro', 'test'))
_BIB_INTERNO_RUST = frozenset(('crate', 'self', 'super', 'Self'))

# C e C++ compartilham o conjunto: a etiqueta da linguagem muda, a classificação
# não. Inclui o C padrão, o POSIX, o Windows e a STL do C++.
_BIB_STD_C = frozenset("""
assert.h complex.h ctype.h errno.h fenv.h float.h inttypes.h iso646.h limits.h
locale.h math.h setjmp.h signal.h stdalign.h stdarg.h stdatomic.h stdbool.h
stddef.h stdint.h stdio.h stdlib.h stdnoreturn.h string.h tgmath.h threads.h
time.h uchar.h wchar.h wctype.h
unistd.h fcntl.h dirent.h pthread.h semaphore.h termios.h poll.h sched.h
strings.h syslog.h utime.h grp.h pwd.h regex.h netdb.h ifaddrs.h glob.h
libgen.h dlfcn.h aio.h mqueue.h iconv.h langinfo.h monetary.h nl_types.h
windows.h winsock2.h ws2tcpip.h tchar.h io.h direct.h process.h conio.h
intrin.h malloc.h
algorithm any array atomic barrier bit bitset charconv chrono codecvt compare
complex concepts condition_variable coroutine deque exception execution
expected filesystem flat_map flat_set format forward_list fstream functional
future generator initializer_list iomanip ios iosfwd iostream istream iterator
latch limits list locale map mdspan memory memory_resource mutex new numbers
numeric optional ostream print queue random ranges ratio regex scoped_allocator
semaphore set shared_mutex source_location span spanstream sstream stack
stacktrace stdexcept stdfloat stop_token streambuf string string_view
syncstream system_error thread tuple type_traits typeindex typeinfo
unordered_map unordered_set utility valarray variant vector version
cassert cctype cerrno cfenv cfloat cinttypes climits clocale cmath csetjmp
csignal cstdarg cstddef cstdint cstdio cstdlib cstring ctime cuchar cwchar
cwctype
sys netinet arpa linux bits asm scsi rpc
""".split())

# JVM e .NET comparam por PREFIXO de pacote, não por conjunto.
#
# ⚠️ Todo item termina em ponto, e isso NÃO é enfeite: sem o ponto,
# `startswith('kotlin')` casaria com `kotlinx.coroutines`, e `startswith('System')`
# com um `SystemXyz` qualquer. O prefixo exato (`kotlin` sozinho) continua
# coberto pela comparação de igualdade em `_bib_eh_padrao`, que tira o ponto.
#
# `kotlinx.*` fica FORA de propósito: kotlinx.coroutines é dependência de
# verdade, não vem com a linguagem. Mesma lógica em C#: só System e os três
# namespaces que a plataforma traz — o resto da Microsoft é NuGet.
_BIB_STD_JAVA = ('java.', 'javax.', 'jdk.', 'sun.', 'com.sun.',
                 'org.w3c.dom.', 'org.xml.sax.', 'org.ietf.jgss.')
_BIB_STD_KT   = ('kotlin.',) + _BIB_STD_JAVA
_BIB_STD_CS   = ('System.', 'Microsoft.Win32.', 'Microsoft.CSharp.',
                 'Microsoft.VisualBasic.', 'Windows.')

# PHP não tem stdlib com namespace — todo `use` é de pacote. Conjunto vazio é a
# resposta correta aqui, não uma lacuna.
_BIB_STD_PHP = frozenset()

_BIB_STD_RB = frozenset("""
abbrev base64 benchmark bigdecimal cgi coverage csv date dbm delegate digest
did_you_mean drb english erb etc expect fcntl fiber fileutils find forwardable
gdbm getoptlong io ipaddr irb json kconv logger matrix mkmf monitor mutex_m net
nkf objspace observer open-uri open3 openssl optparse ostruct pathname pp prime
pstore psych pty racc rake rdoc readline reline resolv rexml rinda ripper rss
rubygems scanf sdbm securerandom set shellwords singleton socket stringio
strscan syslog tempfile thread time timeout tmpdir tracer tsort un uri weakref
yaml zlib
""".split())

_BIB_STD_SWIFT = frozenset("""
Swift Foundation FoundationNetworking FoundationXML Dispatch Combine
Observation Synchronization RegexBuilder Testing XCTest os ObjectiveC Darwin
Glibc WinSDK SwiftUI UIKit AppKit WatchKit TVUIKit Charts WidgetKit
CoreData CoreGraphics CoreFoundation CoreLocation CoreImage CoreML CoreAudio
CoreText CoreBluetooth CoreMotion CoreVideo CoreMedia CoreTelephony QuartzCore
AVFoundation AVKit AudioToolbox VideoToolbox MapKit WebKit Photos PhotosUI
StoreKit CloudKit HealthKit HomeKit ARKit RealityKit SpriteKit SceneKit Metal
MetalKit GameplayKit GameKit Network Security SystemConfiguration Accelerate
Vision NaturalLanguage Speech UserNotifications LocalAuthentication PDFKit
PencilKit QuickLook SafariServices Social Contacts ContactsUI EventKit
EventKitUI MessageUI UniformTypeIdentifiers Intents IntentsUI
""".split())


# ═══════════════════════════════════════ Regexes e nome canônico ═════════════
# Cada canonizador devolve uma LISTA — Python precisa disso por causa de
# `import a, b`. Lista vazia = descarta em silêncio (é caminho de arquivo ou
# referência interna da linguagem), que é a primeira regra da classificação.

# ── Python ───────────────────────────────────────────────────────────────────
_RX_PY_IMPORT = _re.compile(r'^[ \t]*import[ \t]+(?![ \t])([^\n#;]+)', _re.M)
_RX_PY_FROM   = _re.compile(r'^[ \t]*from[ \t]+([.\w]+)[ \t]+import[ \t(]', _re.M)
_RX_PY_ALVO   = _re.compile(r'\s*([A-Za-z_][\w.]*)')


def _canon_py(bruto):
    if bruto.startswith('.'):           # from . / from .mod / from ..pkg
        return []
    nomes = []
    for parte in bruto.split(','):      # import os, sys as s
        m = _RX_PY_ALVO.match(parte)
        if m:
            nomes.append(m.group(1).split('.')[0])   # pandas.io.json → pandas
    return nomes


# ── JavaScript / TypeScript ──────────────────────────────────────────────────
# Casados sobre o texto inteiro: `[^;'"]` inclui `\n`, então o import
# multi-linha (`import {\n a,\n b\n} from 'x'`) funciona sem re.S.
_RX_JS_FROM = _re.compile(
    r"""(?:^|[;\s])(?:import|export)\s+(?:type\s+)?[^;'"]*?\bfrom\s*['"]([^'"]+)['"]""", _re.M)
_RX_JS_BARE = _re.compile(r"""(?:^|[;\s])import\s*['"]([^'"]+)['"]""", _re.M)
_RX_JS_CALL = _re.compile(r"""\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)""")


def _canon_js(bruto):
    if bruto.startswith('node:'):
        bruto = bruto[5:]
    if bruto.startswith('.') or bruto.startswith('/'):
        return []                                    # relativo ou absoluto
    partes = bruto.split('/')
    if bruto.startswith('@'):                        # @scope/pkg/sub → @scope/pkg
        return ['/'.join(partes[:2])] if len(partes) >= 2 else []
    return [partes[0]]                               # lodash/debounce → lodash


# ── Go ───────────────────────────────────────────────────────────────────────
_RX_GO_BLOCO = _re.compile(r'^[ \t]*import[ \t]*\([ \t]*$(.*?)^[ \t]*\)[ \t]*$', _re.M | _re.S)
_RX_GO_ITEM  = _re.compile(r'^[ \t]*(?:(?:[A-Za-z_]\w*|_|\.)[ \t]+)?"([^"]+)"', _re.M)
_RX_GO_UNICO = _re.compile(r'^[ \t]*import[ \t]+(?:(?:[A-Za-z_]\w*|_|\.)[ \t]+)?"([^"]+)"', _re.M)


def _brutos_go(texto):
    """O bloco `import ( … )` precisa de duas passadas: o item só é lido dentro
    do bloco, senão qualquer string do arquivo viraria import."""
    achados = list(_RX_GO_UNICO.findall(texto))
    for bloco in _RX_GO_BLOCO.findall(texto):
        achados += _RX_GO_ITEM.findall(bloco)
    return achados


def _canon_go(bruto):
    partes = bruto.split('/')
    if '.' in partes[0]:                # host → github.com/gin-gonic/gin
        return ['/'.join(partes[:3])]
    return [bruto]                      # net/http, fmt — stdlib ou módulo local


# ── Rust ─────────────────────────────────────────────────────────────────────
_RX_RUST = _re.compile(r'^[ \t]*(?:pub(?:\([^)]*\))?[ \t]+)?use[ \t]+(?:::)?([A-Za-z_]\w*)\b', _re.M)


def _canon_rust(bruto):
    return [] if bruto in _BIB_INTERNO_RUST else [bruto]


# ── C / C++ ──────────────────────────────────────────────────────────────────
# Só a forma com <>. `#include "local.h"` é arquivo do usuário e nem é casado.
_RX_C = _re.compile(r'^[ \t]*#[ \t]*include[ \t]*<([^>]+)>', _re.M)


def _canon_c(bruto):
    return [bruto.split('/')[0]]        # <sys/types.h> → sys, <vector> → vector


# ── Java / Kotlin ────────────────────────────────────────────────────────────
_RX_JAVA = _re.compile(r'^[ \t]*import[ \t]+(?:static[ \t]+)?([A-Za-z_][\w.]*)(?:\.\*)?[ \t]*;', _re.M)
_RX_KT   = _re.compile(r'^[ \t]*import[ \t]+([A-Za-z_][\w.]*)(?:\.\*)?(?:[ \t]+as[ \t]+\w+)?[ \t]*;?[ \t]*$', _re.M)


def _canon_jvm(bruto):
    """Corta no primeiro segmento capitalizado (que já é a classe) e trunca em
    três — sem isso, `org.apache.…` e `com.google.…` virariam `org` e `com`."""
    segs, fim = bruto.split('.'), 0
    for s in segs:
        if s and s[0].isupper():
            break
        fim += 1
    segs = segs[:fim] or segs[:1]
    return ['.'.join(segs[:3])]


# ── C# ───────────────────────────────────────────────────────────────────────
# O `;` obrigatório no fim é o que separa o import do `using` de recurso
# (`using (var x = …)` e `using var x = …;` não casam).
#
# `using static` tem regex própria porque o último segmento ali é o nome de uma
# CLASSE, não do namespace: em `using static System.Math;` o que importa é
# `System`. O `\.\w+` no fim come o `.Math` de fora do grupo capturado.
_RX_CS = _re.compile(
    r'^[ \t]*(?:global[ \t]+)?using[ \t]+(?!static[ \t])'
    r'(?:[A-Za-z_]\w*[ \t]*=[ \t]*)?([A-Za-z_][\w.]*)[ \t]*;', _re.M)
_RX_CS_STATIC = _re.compile(
    r'^[ \t]*(?:global[ \t]+)?using[ \t]+static[ \t]+([A-Za-z_][\w.]*)\.\w+[ \t]*;', _re.M)


def _canon_cs(bruto):
    return ['.'.join(bruto.split('.')[:2])]


# ── PHP ──────────────────────────────────────────────────────────────────────
# Ancorado na COLUNA ZERO de propósito: `use SomeTrait;` dentro de classe é
# sempre indentado, e não é import de biblioteca.
_RX_PHP = _re.compile(r'^use[ \t]+(?:function[ \t]+|const[ \t]+)?\\?([A-Za-z_][\w\\]*)', _re.M)


def _canon_php(bruto):
    return [bruto.split('\\')[0]]


# ── Ruby ─────────────────────────────────────────────────────────────────────
# `require_relative` cai sozinho: depois de `require` vem `_`, e a aspa não casa.
_RX_RB = _re.compile(r"""^[ \t]*(?:require|gem)[ \t]*\(?[ \t]*['"]([^'"]+)['"]""", _re.M)


def _canon_rb(bruto):
    return [bruto.split('/')[0]]


# ── Swift ────────────────────────────────────────────────────────────────────
_RX_SWIFT = _re.compile(
    r'^[ \t]*(?:@testable[ \t]+)?import[ \t]+'
    r'(?:(?:struct|class|enum|func|var|let|typealias|protocol)[ \t]+)?([A-Za-z_]\w*)', _re.M)


def _canon_direto(bruto):
    return [bruto]


# ══════════════════════════════════════════ Tabela de linguagens ═════════════
# Acrescentar linguagem é acrescentar UMA linha aqui. As extensões seguem o
# LANG_MAP de `modulos/linguagens.py`, que é a fonte única do projeto.
# HTML e CSS não entram — ver o cabeçalho do módulo.

_BIB_LINGUAGENS = {
    'Python':     dict(exts=('.py', '.pyw'), com='py',
                       rx=(_RX_PY_IMPORT, _RX_PY_FROM), canon=_canon_py,
                       std=_BIB_STD_PY, modo='conjunto'),
    'JavaScript': dict(exts=('.js', '.jsx', '.mjs', '.cjs'), com='c',
                       rx=(_RX_JS_FROM, _RX_JS_BARE, _RX_JS_CALL), canon=_canon_js,
                       std=_BIB_STD_NODE, modo='conjunto'),
    'TypeScript': dict(exts=('.ts', '.tsx', '.mts', '.cts'), com='c',
                       rx=(_RX_JS_FROM, _RX_JS_BARE, _RX_JS_CALL), canon=_canon_js,
                       std=_BIB_STD_NODE, modo='conjunto'),
    'Go':         dict(exts=('.go',), com='c', rx=(), brutos=_brutos_go,
                       canon=_canon_go, std=_BIB_STD_GO, modo='go'),
    'Rust':       dict(exts=('.rs',), com='c', rx=(_RX_RUST,), canon=_canon_rust,
                       std=_BIB_STD_RUST, modo='conjunto'),
    'Java':       dict(exts=('.java',), com='c', rx=(_RX_JAVA,), canon=_canon_jvm,
                       std=_BIB_STD_JAVA, modo='prefixo'),
    'Kotlin':     dict(exts=('.kt', '.kts'), com='c', rx=(_RX_KT,), canon=_canon_jvm,
                       std=_BIB_STD_KT, modo='prefixo'),
    'C#':         dict(exts=('.cs',), com='c', rx=(_RX_CS, _RX_CS_STATIC), canon=_canon_cs,
                       std=_BIB_STD_CS, modo='prefixo'),
    'C':          dict(exts=('.c', '.h'), com='c', rx=(_RX_C,), canon=_canon_c,
                       std=_BIB_STD_C, modo='conjunto'),
    'C++':        dict(exts=('.cc', '.cpp', '.cxx', '.hpp'), com='c', rx=(_RX_C,),
                       canon=_canon_c, std=_BIB_STD_C, modo='conjunto'),
    'PHP':        dict(exts=('.php',), com='c', rx=(_RX_PHP,), canon=_canon_php,
                       std=_BIB_STD_PHP, modo='conjunto'),
    'Ruby':       dict(exts=('.rb',), com='rb', rx=(_RX_RB,), canon=_canon_rb,
                       std=_BIB_STD_RB, modo='conjunto'),
    'Swift':      dict(exts=('.swift',), com='nada', rx=(_RX_SWIFT,), canon=_canon_direto,
                       std=_BIB_STD_SWIFT, modo='conjunto'),
}

_BIB_EXT_LANG = {e: lang for lang, cfg in _BIB_LINGUAGENS.items() for e in cfg['exts']}

# Rede de segurança para nome de arquivo — ver `_bib_slug`.
_BIB_ILEGAL = _re.compile(r'[<>:"|?*\x00-\x1f]')
_BIB_RESERVADOS = ({'con', 'prn', 'aux', 'nul'}
                   | {f'com{i}' for i in range(1, 10)}
                   | {f'lpt{i}' for i in range(1, 10)})

