# Simulación antes de producir — investigación y diseño

> Estado: PROPUESTA — investigación + diseño. No hay código y no hay migración aplicada.
> Fecha de corte de la investigación: 2026-10-02
> Autor: investigación para RR ALIADOS · Content Hub
> Alcance: ¿se puede saber, antes de producir, cómo le va a ir a una pieza? Y si sí,
> ¿cuál es la forma más barata y auditable de hacerlo en este Hub?

---

## 0. Resumen ejecutivo (léase esto primero)

**La tecnología existe y está documentada. Pero la evidencia más reciente y más
relevante dice que la versión que se está vendiendo como "simula a tu público" es
peor que no hacer nada.**

Tres hallazgos que cambian la decisión de diseño:

1. **Los paneles de personas sintéticas pierden contra no usar personas.**
   En 399 tests A/B reales de Upworthy con CTR medido, el panel de 10 personas dio
   Kendall τ = 0.084 y 34.6% de acierto en la mejor variante; **preguntarle
   directamente al modelo** (sin personajes) dio τ = 0.361 y 49.2%, con
   intervalos de confianza que no se traslapan. Replicado en 3 particiones de
   Upworthy, en otro dominio, y con 3 tiers de Gemini más otra familia de modelo.
   → [arXiv:2609.25010](https://arxiv.org/abs/2609.25010)

2. **Los agentes LLM no superan a un clasificador de texto.** Con 120.000+
   combinaciones agente-persona de 1.511 personas reales y 27 modelos: 70.7% de
   exactitud global, pero MCC = 0.29 — y un clasificador de texto convencional
   (TF-IDF, MCC 0.36) los superó. La señal predictiva viene del acceso semántico
   al texto, no del razonamiento "agéntico".
   → [arXiv:2604.19787](https://arxiv.org/abs/2604.19787)

3. **Cinco modelos punteros coinciden entre sí y se apartan de los humanos.**
   En una encuesta real a 420 developers de Silicon Valley replicada con cinco
   LLMs de frontera (GPT-5-thinking, Claude Sonnet 4.5, Gemini 2.5 Pro,
   DeepSeek 3.2 y otro): ninguno capturó los hallazgos contraintuitivos que
   hicieron valiosa la encuesta. Las desviaciones se agruparon para todos los
   modelos y el dato real quedó como atípico.
   → [arXiv:2603.00059](https://arxiv.org/abs/2603.00059)

**Consecuencia para RR Aliados:** no vamos a comprar ni construir una "población
simulada" que nos diga si una pieza va a funcionar. Vamos a construir algo más
modesto y más honesto: **una rúbrica calibrada con el propio historial del Hub**,
que produzca un número con las operaciones a la vista, y que esté **validada
contra las piezas ya publicadas antes de que nadie se la crea**.

El número que sí sale confiable y barato es el de **dificultad de producción**: es
determinista, sale de los briefs por rol que ya existen, y no depende de que un
modelo "adivine" a un público.

**Costo del camino recomendado: ~US$1–15 por las 19 ideas de Wundeer hoy en
votación.** El camino de modelo local es medido e inviable en esta máquina
(2.8 h por idea). Las herramientas comerciales arrancan en US$317/mes, que es
justo el presupuesto que la evidencia dice que no Vale la pena gastar.

---

## PARTE 1 — Investigación

### 1.1 Lo que se pidió por nombre y **no existe** (verificado, no asumido)

Antes de comparar, se verificó cada nombre. Esto importa: un diseño que se apoya
en un paper inexistente es un oráculo con bibliografía.

| Lo pedido | Veredicto | Cómo se comprobó |
|---|---|---|
| **"Artica Compute"** — simulación de managers con LLM | **No encontrado.** | Búsqueda literal en arXiv (API + web), Crossref, GitHub Search, y buscadores. `artica.com` existe (Bellevue, WA) pero es una empresa de e-commerce/ML sin relación con simulación de campañas; `articacompute.com` no resuelve. |
| **"MAD" (Marketing AI Diffusion), Zhang et al., Stanford/UCSD** | **No encontrado.** | `"Marketing AI Diffusion"` en arXiv API y web: 0 resultados. Crossref: nada pertinente. GitHub Search: 30–33 repos que no corresponden. Búsquedas de relleno ("marketing diffusion LLM agents", "simulating marketing managers LLM agents") devuelven papers de misinformation y subastas, no esto. |
| **SurvAI** | **Dominio estacionado.** | `survai.com` responde 200 pero es un lander vacío (`window.location.href="/lander"`). No es un producto vivo. |
| **Syntheticcx** | **No resuelve.** | `syntheticcx.com` y `.ai` no resuelven (sin DNS). |
| **Creator(i)deZZON** | **No encontrado.** | Sin resultado en arXiv, Crossref, GitHub, ni buscadores. Posible corruption de otro nombre. |

> **Si alguien de RR tiene el PDF o el link correcto de MAD / Artica Compute,
> que lo pase.** Puede existir con otro título (los trabajos de simulación de
> managers en mercados suelenpublicarse bajo nombres como *marketplace
> simulation* o con el nombre del framework). No lo di por existente ni lo di por
> inexistente: lo di por **no verificable con las fuentes públicas indexadas**.

### 1.2 Lo que **sí** existe y es el estado del arte

#### A. Simulación generativa basada en agentes (GABM)

| Sistema | Qué es | Fuente | Licencia / salud |
|---|---|---|---|
| **Concordia** (Google DeepMind) | Biblioteca para construir simulaciones donde agentes actuados por LLM se mueven en un entorno físico o digital. Un agente "Game Master"traduce intenciones en lenguaje natural a acciones verificables. | Vezhnevets et al., [arXiv:2312.03664](https://arxiv.org/abs/2312.03664) (dic 2023) | Apache-2.0, `google-deepmind/concordia`, **1.755 estrellas**, último push **2026-10-01**. Viva. |
| **Generative Agents** (Stanford) | El paper fundacional: memoria → reflexión → planificación para 25 agentes en una ciudad ficticia. | Park et al., [arXiv:2304.03442](https://arxiv.org/abs/2304.03442) (UIST 2023) | Apache-2.0, `joonspk-research/generative_agents`, **22.184 estrellas**, último push **2024-08-05**. Referencia, no maintained. |
| **Guía de experimentos confiables con Concordia** | Cómo diseñar GABM para que el resultado sea reproducible y no un cuento. | [arXiv:2411.07038](https://arxiv.org/abs/2411.07038) | Útil si algún día se justifica un simulador completo. |
| **Persona Generators** (autores DeepMind) | Generadores de poblaciones sintéticas optimizados con AlphaEvolve, para máxima cobertura de la cola larga en vez de densidad. | Paglieri et al., [arXiv:2602.03545](https://arxiv.org/abs/2602.03545) | Aporta el matiz:Optimiza *cobertura*, no *densidad*. |

**Para RR Aliados hoy: ninguno es la herramienta.** Concordia es un framework de
investigación; montar un sandbox con Game Master para 19 piezas de ropa y
panadería es un proyecto de meses, y su salida sigue siendoopinión de LLM
agregada — con el problema de validez de la §0.

#### B. El paper más cercano a lo que se pidió

**"LLM-Based Multi-Agent System for Simulating and Analyzing Marketing and Consumer
Behavior"** — Chu, Terhorst, Reed, Ni, Chen, Lin. [arXiv:2510.18155](https://arxiv.org/abs/2510.18155),
aceptado en IEEE ICEBE 2025. Es exactamente la idea: agentes generativos que
interactúan, forman hábitos y deciden compras sin reglas prefijadas, en un
escenario de descuentos. **8 páginas, 5 figuras, escenario único.** Es la
demonstración más honesta del estado del arte: sirve para un artículo de
conferencia, no para decidir si una campaña de ropa funciona en Colombia.

#### C. Simulación de comportamiento con datos reales (el enfoque correcto)

**CXSimulator** (Sony) representa el historial de un usuario como embeddings de
LLM y entrena un modelo de transición entre eventos. A diferencia de los paneles
de personas, **sí usa datos reales de comportamiento** (Google Merchandise Store
vía BigQuery). → [arXiv:2407.21553](https://arxiv.org/abs/2407.21553)

> Esto es la lección de diseño: lo que hace confiable a CXSimulator no es el LLM,
> es que **el modelo está entrenado sobre transiciones reales**. RR no tiene
> transiciones reales todavía (su tabla `metrics` está vacía — ver §2.6).

#### D. Validación: lo que se sabe que *no* funciona

| Hallazgo | Cifra | Fuente |
|---|---|---|
| Personas sintéticas vs. línea base sin personas | τ 0.084 vs **0.361**; top-1 34.6% vs **49.2%** | [arXiv:2609.25010](https://arxiv.org/abs/2609.25010) |
| Agentes LLM vs. clasificador TF-IDF | MCC **0.29** vs **0.36** | [arXiv:2604.19787](https://arxiv.org/abs/2604.19787) |
| Predecir el mejor titular (17.681 A/B de Upworthy) | Ningún método LLM puro predice bien con alta exactitud; solo se quita del nivel de azar con *embeddings* o *fine-tuning* | [LOLA, arXiv:2406.02611](https://arxiv.org/abs/2406.02611) |
| Replicar una encuesta humana (420 personas, 5 modelos) | Ninguno capturó los hallazgos contraintuitivos; todos coincidieron entre sí y el humano quedó como atípico | [arXiv:2603.00059](https://arxiv.org/abs/2603.00059) |
| Cómo medir si tus agentes son válidos | HumanStudy-Bench: Probability Alignment Score + Effect Consistency Score sobre estudios humanos publicados, 6.588 participantes simulados por configuración | [arXiv:2605.15473](https://arxiv.org/abs/2605.15473) |
| Cuánto humano validar cuando la IA es poco confiable | Optimización tipo Neyman para repartir un presupuesto de validación humana entre muchas tareas heterogéneas | Ye, Lyu, Tao, [arXiv:2604.12497](https://arxiv.org/abs/2604.12497) |

**Nota sobre HumanStudy-Bench:** es el marco correcto para el backtest de RR
(Fase 0 del diseño). El concepto central —*descomponer el acuerdo en "qué efectos
humanos reprodujo y dónde divergió"*— se copia tal cual.

**Límite honesto:** la mayoría de esta evidencia es de 2024–2026 y de contextos
angloparlantes/ociales. No hay, hasta donde se pudo verificar, un estudio de
validez de personas sintéticas sobre **audiencias latinoamericanos de moda y
panadería en Instagram y Meta Ads**. La evidencia hay que tomarla como
dirección, no como número transferible.

### 1.3 Herramientas comerciales: qué hacen, cuánto cuestan, si tienen API

Precios leídos directamente de la página de cada proveedor el **2026-10-02**.

| Herramienta | Qué hace | Precio verificado | API | Límites | Qué tan confiable |
|---|---|---|---|---|---|
| **Delve AI** | "Digital Twins": personas sintéticas construidas sobre datos reales de clientes y web. Marketing Advisor, Synthetic Research. | **Research Essential US$317/mes** (100 usuarios sintéticos, 5 segmentos, 5k créditos de chat) · **Marketing Essential US$877/mes** · **Complete US$2.499/mes** (1k usuarios, 5k registros de cliente). Anual 20% menos. **Plan gratuito real** (no trial): 1 persona + 50 créditos. | **Sí — add-on US$99/mes.** Devuelve JSON de atributos y segmentos, **excluye journeys**. Activación por el equipo de ellos, sin portal público. | El tier se define por **tráfico web mensual**, no por clientes. Requiere conectar GA. Créditos de chat caducan a 12 meses. | Producto más serio de la lista: los personas se **anclan en datos reales**, no inventados. Pero el tier mínimo pide tráfico web que RR probablemente no tiene. |
| **Anyword** (Keywee) | Predicción de performance de copy contra un dataset histórico de$~9M$ piezas. El ángulo no es simular personas: es un modelo entrenado en resultados reales. | **Starter US$49/mes** (50 predicciones/mes, 1 asiento) · **Data-Driven US$99/mes** (100 predicciones, 3 asientos) · **Business** a cotización · **Enterprise** a cotización. Trial 7 días. | **Solo Enterprise.** La tabla comparativa muestra "API" con guion en Starter, Data-Driven y Business. | **50–100 predicciones al mes** en los planes individueles. seats extra US$59/mes. | **El más alineado con la evidencia**: no vende magia, vende un modelo predictivo entrenado en datos de performance real. El límite duro son las 50–100 predicciones/mes. |
| **Voxpop / voxpop.ai** | "Synthetic focus groups" para decisiones pre-lanzamiento. | — | — | `voxpop.ai` responde con **lander de dominio estacionado**. Existe una `voxpop.io` distinta (herramienta de feedback, no simulación). | **No evaluable.** El dominio citado está estacionado. |
| **Genti** | "AI focus group for marketing" — clones de 2.017 personas reales con demografía y psicografía de entrevistas. | No publicada (página de 2 KB, contenido en JS) | No confirmada | claims de "2.017 personas reales" sin methodology pública | **No verificada.** Demasiado poca información pública para juzgarla. |
| **Panorama de la categoría** | SurvAI, Syntheticcx, Creator(i)deZZON, Artica Compute | — | — | — | **No existen como producto verificable** (§1.1). |

**Conclusión de §1.3:** las dos herramientas vivas y serias (Delve, Anyword)
cuestan **US$317–2.499/mes** y **US$49–99/mes** respectivamente, y el único con
API accesible (Delve) cuesta **US$416/mes** sumando add-on. Para una pyme que
produce ~19 ideas por ciclo, ninguna es un purchase defendible hoy — y Delve
cobraría por la tecnología que la evidencia de §1.2D dice que no predice bien.

---

## PARTE 2 — Diseño aplicado al Content Hub

### 2.1 El principio de diseño

> **La simulación no es una caja negra que escupe un número. Es una suma visible
> de seis scores, cada uno con su evidencia escrita, y una calibración medida
> contra las piezas que el Hub ya publicó.**

Tres reglas que salen de la evidencia y que gobiernan todo lo demás:

1. **No hay panel de personas.** La evidencia dice que restaexactitud (§1.2D).
   En su lugar: un juez LLM que evalúa la pieza directamente, promediado sobre N
   repeticiones con distinta semilla, más las reglas deterministas.
2. **Todo número tiene su operación a la vista.** Cada score guarda el fragmento
   de prompt, la respuesta cruda del modelo y la razón escrita. Santiago puede
   auditar por qué una idea dio 0.62 sin leer código.
3. **Ningún score se muestra hasta que el backtest lo respalde.** Fase 0 es
   obligatoria y puede terminar en "no lo hacemos" (§2.5).

### 2.2 Los tres números que la empresa recibe

| Número | Naturaleza | Fuente | Confianza objetivo |
|---|---|---|---|
| **PROBABILIDAD DE QUE FUNCIONE** (0–1) | Score compuesto, 6 dimensiones | Modelo + histórico del Hub | Media. Calibrable. **Debe superarse contra línea base.** |
| **DIFICULTAD DE PRODUCCIÓN** (1–5) | **Determinista, sin LLM** | Briefs por rol que ya existen | **Alta.** Es el número más confiable de los tres. |
| **NICHO** (texto) | Declarado, no simulado | Se declara el nicho objetivo; se evalúa encaje | Media-baja. Útil como *obligación de pensamiento*, no como descubrimiento. |
| **RECOMENDACIÓN** | Regla determinista sobre los dos anteriores | — | Alta (es una regla, no una predicción) |

### 2.3 El motor de scoring (auditable por construcción)

**Probabilidad de éxito** = sigmoide de seis features, cada una en [0,1] con peso
fijo:

```
z   = -1.8
    + 1.1·x_adherencia_pilar     ¿encaja en una categoría que funcionó para este cliente?
    + 0.9·x_especificidad_visual  ¿hay un referente visual concreto, no una abstracción?
    + 0.8·x_claridad_objetivo    ¿el objetivo se entiende en una frase por un tercero?
    + 0.7·x_diferenciacion       ¿se distingue de las últimas N piezas del cliente?
    + 0.6·x_encaje_momento       ¿temporalidad / estacionalidad / tendencia vigente?
    + 0.4·(1 - x_friccion)       ¿es fácil de producir?
P   = 1 / (1 + e^(-z))
```

Los **pesos son un número en una tabla de la base, no un parámetro escondido**.
Cambiar un peso es una migración; la auditoría ve el peso con el que se calculó.

**Cómo se produce cada evidencia** (una llamada de juez por dimensión):

- El juez recibe: título, descripción, objetivo, categoría, tipo de contenido,
  las referencias visuales, los briefs por rol, y **las últimas N piezas
  publicadas del mismo cliente** con su desenlace.
- Devuelve JSON estricto: `{"score": 0.0-1.0, "razon": "una frase", "debilidad": "una frase"}`.
- Se ejecuta **3 veces con distinta semilla**; se reporta la mediana y la
  dispersión. Si la dispersión > 0.25, la dimensión se marca **"incierta"** y la
  simulación entera baja a confianza *baja*. Esto es barato y es lo que separa
  una señal de un ruido de LLM.

**Dificultad de producción** — sin modelo, solo reglas sobre campos existentes:

| Señal | De dónde sale | Peso |
|---|---|---|
| Requiere talent disponible | `talent_brief` no vacío + disponibilidad del roster | +1 |
| Requires location / estilaje | texto del brief contiene location/styling/traslado | +1 |
| Nº de looks / piezas | conteo en `edit_brief` | +0.5 por look extra |
| Complejidad de cámara | técnica en `camera_brief` (macro, slow motion, match cuts, multi-setup) | +1 |
| Nº de referencias | `len(reference_urls)` | +0.5 por sobre 3 |
| Dependencia de cliente | `status` exige aprobación de guion antes de rodar | +0.5 |

Rango 1–5. Determinista, auditable fila por fila, y **el equipo de producción lo
puede discutir sin pelearse con un modelo**.

**Cuadrante de recomendación** (regla fija, sin pesos ocultos):

| | **Fácil** (1–2.5) | **Media** (2.6–4) | **Difícil** (4.1–5) |
|---|---|---|---|
| **P alta** (≥0.62) | `PRODUCIR` | `PRODUCIR` | `PRODUCIR_CON_AJUSTE` — ajustar alcance/talento |
| **P media** (0.45–0.61) | `PRODUCIR_BAJO` — producir solo como experimento barato | `PILOTO` — reducir a un corte | `REPLANTEAR` |
| **P baja** (<0.45) | `APARTAR` | `APARTAR` | `APARTAR` — nunca producir la versión difícil de la idea mala |

`PRODUCIR_CON_AJUSTE` y `REPLANTEAR` **no bloquean**: propose un cambio concreto
(qué dimensión bajó y por qué) y la decisión sigue siendo de dirección.

### 2.4 Los tres caminos, con números

Medición de hardware de esta máquina, hoy: **sin GPU NVIDIA**, 12 GB RAM totales
con **3 GB disponibles**, 8 núcleos, `ollama` con `deepseek-r1:7b` instalado.

**Medición real de rendimiento local** (no estimada):
```
ollama deepseek-r1:7b, 200 tokens de salida, CPU
  total_duration : 97.83 s
  eval_count     : 200  →  5.4 tokens/s
  load_duration  : 58.3 s (carga del modelo, por llamada)
```

| | **Camino A — API de pago** | **Camino B — modelo local** | **Camino C — Híbrido** ✅ |
|---|---|---|---|
| **Cómo** | Un juez por dimensión vía OpenRouter, modelo económico (`gemini-2.5-flash-lite`) | 7B en CPU por Ollama | Reglas + dificultad **locales y gratis**; LLM solo para las 4 dimensiones que lo necesitan; resultado cacheado por huella de la idea |
| **Costo por idea** (6 dims × 3 semillas = 18 llamadas, ~6k in / 1.5k out c/u) | **US$0.018** con flash-lite · US$0.81 con `gemini-2.5-pro` | **US$0** marginal | **US$0.018** (flash-lite) |
| **Costo 19 ideas** | **US$0.34** a **US$15.4** | US$0 | **~US$0.34** |
| **Tiempo por idea** | ~40 s (paralelo) | **~2.8 h** (54.000 tokens ÷ 5,4 tok/s) + 58 s de carga por llamada | ~40 s, y **US$0 si ya se corrió** |
| **Calidad** | Alta — modelo de frontera | **Baja.** 7B en CPU vs. flash-lite: brecha grande, y los estudios muestran que el salto de modelo mueve la respuesta hasta 13 puntos (arXiv:2604.19787) | Alta en las dimensiones con LLM, **exacta** en dificultad |
| **Privacidad** | Briefs de cliente salen a un tercero | Todo local | Solo las 4 dimensiones acotadas salen |
| **Veredicto** | viable | **in viable** en esta máquina | **recomendado** |

**Precios de referencia leídos de la API de OpenRouter el 2026-10-02** (USD por
millón de tokens, entrada/salida):

| Modelo | in | out | contexto |
|---|---|---|---|
| `google/gemini-2.5-flash-lite` | 0.10 | 0.40 | 1.048.576 |
| `google/gemini-2.5-flash` | 0.30 | 2.50 | 1.048.576 |
| `google/gemini-2.5-pro` | 1.25 | 10.00 | 1.048.576 |
| `openai/gpt-4o-mini` | 0.15 | 0.60 | 128.000 |
| `openai/gpt-4.1-mini` | 0.40 | 1.60 | 1.047.576 |
| `anthropic/claude-haiku-4.5` | 1.00 | 5.00 | 200.000 |
| `meta-llama/llama-3.3-70b-instruct` | 0.10 | 0.32 | 131.072 |

**Camino D (descartado, para comparación):** Delve Marketing Essential US$877/mes
+ API US$99 = **US$11.868/año**. Anyword Data-Driven US$99/mes = US$1.188/año pero
con tope de 100 predicciones/mes y sin API. Contra eso, el Camino C cuesta
**US$4 al año** y no tiene topes.

> Nota deArchitecture: si algún día se quiere bajar el costo a cero, la palanca no
> es un modelo local — es **subir el caché y bajar la frecuencia**. El Hub tiene
> `metrics` que nadie está llenando; cuando se llene, el término histórico de
> `x_adherencia_pilar` y `x_diferenciacion` se computa en SQL y **esas dos
> dimensiones dejan de necesitar LLM**. Ahí el costo marginal por idea cae a
> cerca de cero de verdad.

### 2.5 Fases

#### Fase 0 — Backtest. Sin presupuesto, sin código de producto. **ES OBLIGATORIA.**

No se muestra un solo número antes de esto.

1. Exportar las piezas ya **publicadas** de Wundeer y Candilejas con su desenlace
   real (`published_url`, `metrics`).
2. Correr la rúbrica **a ciegas** sobre esas piezas (el juez no ve el desenlace).
3. Comparar contra dos líneas base:
   - **Base 1 — azar.** P ≈ tasa de éxito histórica del cliente.
   - **Base 2 — la que gana la evidencia.** Juntar los 6 scores en una sola
     llamada y preguntar "¿cuál de estas piezas funcionó mejor?", sin desglose.
     (§1.2D dice que esta gana.)
4. **Criterio de arranque, escrito ahora para no autoengañarse después:**
   - El score compuesto debe superar la base 1 por **≥10 puntos** de exactitud
     top-1 en el subconjunto con desenlace confiable.
   - Y **no** debe perder contra la base 2.
5. Si falla → se registra el hallazgo, no se muestra el número, y el Hub sigue
   como está. Esto vale más que un número bonito y falso.

> **Advertencia metodológica que viene de la propia evidencia:** en Upworthy,
> "la mayoría de los tests A/B no tiene ganador estadísticamente distinguible", y
> la validez solo pudo medirse sobre el subconjunto confiable (n = 399). Con el
> volumen de piezas publicadas de RR, el subconjunto confiable puede ser de
> **una o dos piezas**. Si es así, Fase 0 no tiene poder estadístico y la
> conclusión honesta es: *el score sirve como conversación estructurada, no como
> predicción calibrada*. Se documenta así y se etiqueta en pantalla.

#### Fase 1 — Sin presupuesto nuevo (lo que ya se puede hacer hoy)

Esto no cuesta un peso y usa lo que ya existe:

1. **La difficulty score ya es real hoy.** Los briefs por rol existen
   (`camera_brief`, `talent_brief`, `edit_brief`, `reference_urls`). La tabla de
   §2.3 se puede calcular con una hoja o con `scripts/` sin tocar la base.
2. **Los votos de Wundeer ya son una señal.** 19 ideas en votación con umbral de
   3 votos: el ratio sí/no por idea, más la nota del votante (`note` existe en
   `rr_hub_votes`), es un juicio humano sobre la misma ficha. **Es la fuente de
   verdad más barata que existe.**
3. **El ranking de Anyword se puede usar a mano**, una vez, sobre 10 titulares de
   Wundeer, para ver si el orden le hace sentido a dirección. $49/mes, un mes,
   se cancela. Si el orden es basura, ya se gastó $49 y se sabe.
4. **Llenar `metrics`.** La columna existe (`20260926_hub_v3_board_feed_search.sql`)
   y `metricas/page.tsx` dice textualmente que hoy no se mide rendimiento porque
   "ninguna tabla lo registra". **Es el bloqueador de todo lo demás**: sin
   desenlace real no hay backtest posible en Fase 0. Es trabajo de `media_buyer`,
   no de desarrollo.

#### Fase 2 — El motor, si Fase 0 lo aprueba

- Tablas nuevas (§2.6).
- Un script en `scripts/` que corre la rúbrica y escribe evidencia.
- Una pestaña en la ficha de la idea: **"SIMULACIÓN"**, con los seis scores, cada
  uno con su `razon` y su `debilidad` visibles, la dispersión por dimensión, y el
  cuadrante. Nada de barras de progreso animadas: números y frases.
- Cache por `hash(title + description + objective + briefs + últimas N publicadas)`
  → re-correr no cuesta.
- El rol `media_buyer` es quien ve el resultado y quien carga `metrics` después.

#### Fase 3 — Solo si las fases anteriores pagaron

Recién aquí se justifica un simulador más rico (Concordia, o un fine-tune como el
de CXSimulator) cuando exista **un histórico de desenlaces reales suficiente**.
No antes. Es exactamente la inversión que CXSimulator demuestra que funciona y
que la evidencia dice que no se puede saltar.

### 2.6 Esquema de datos a agregar

Todo bajo el patrón existente: `rr_hub_*`, RLS activo, migraciones reejecutables
con `if not exists`, granted por rol.

```sql
-- 1) Un conteo por cliente: qué DEBEO (histórico) para cada rol.
create table if not exists public.rr_hub_dificultad_reglas (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.rr_hub_projects(id) on delete cascade,
  clave       text not null,           -- 'talent.requerido', 'edit.looks', ...
  peso        numeric not null,        -- EL PESO, visible y editable
  vigente     boolean not null default true,
  actualizado_at timestamptz not null default now(),
  unique (project_id, clave, vigente)
);

-- 2) Pesos de las dimensiones. Cambiar un peso es una fila, no un deploy.
create table if not exists public.rr_hub_sim_pesos (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rr_hub_projects(id) on delete cascade,
  dimension  text not null,            -- 'adherencia_pilar', 'claridad_objetivo', ...
  peso       numeric not null,
  intercepto numeric not null default -1.8,
  version    text not null,            -- 'v1' — entra en la auditoría
  vigente    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, version, dimension)
);

-- 3) Una corrida. Guarda el modelo, la semilla y la huella del input:
--    eso es lo que hace la corrida reproducible y auditable.
create table if not exists public.rr_hub_simulaciones (
  id           uuid primary key default gen_random_uuid(),
  idea_id      uuid not null references public.rr_hub_ideas(id) on delete cascade,
  project_id   uuid not null references public.rr_hub_projects(id) on delete cascade,
  version      text not null,                    -- versión de pesos usada
  modo         text not null check (modo in ('rubrica','panel')),  -- 'panel' queda deshabilitado a propósito
  juez_modelo  text not null,
  semillas     int not null default 3,
  huella       text not null,                    -- hash del input; cache
  probabilidad numeric,                          -- 0..1
  confianza    text not null check (confianza in ('alta','media','baja')),
  recomendacion text not null check (recomendacion in
                ('PRODUCIR','PRODUCIR_BAJO','PRODUCIR_CON_AJUSTE','PILOTO','REPLANTEAR','APARTAR')),
  created_by   uuid references public.rr_hub_profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists rr_hub_simulaciones_idea_idx on public.rr_hub_simulaciones (idea_id);
create index if not exists rr_hub_simulaciones_huella_idx on public.rr_hub_simulaciones (idea_id, huella);

-- 4) LA EVIDENCIA. Esto es lo que se lee para entender el número.
create table if not exists public.rr_hub_sim_evidencia (
  id             uuid primary key default gen_random_uuid(),
  simulacion_id  uuid not null references public.rr_hub_simulaciones(id) on delete cascade,
  dimension      text not null,
  puntaje        numeric not null check (puntaje >= 0 and puntaje <= 1),
  mediana        numeric,            -- sobre las 3 semillas
  dispersion     numeric,            -- si > 0.25 -> confianza 'baja'
  razon          text,               -- UNA FRASE, escrita para humanos
  debilidad      text,
  evidencia_cruda jsonb not null default '{}',  -- prompt + respuesta tal cual
  fuente         text not null check (fuente in ('regla','modelo','historico')),
  created_at     timestamptz not null default now()
);
create index if not exists rr_hub_sim_evidencia_sim_idx on public.rr_hub_sim_evidencia (simulacion_id);

-- 5) Dificultad: fila por regla aplicada, para que se pueda discutir sin creerse.
create table if not exists public.rr_hub_sim_dificultad (
  id            uuid primary key default gen_random_uuid(),
  simulacion_id uuid not null references public.rr_hub_simulaciones(id) on delete cascade,
  clave         text not null,
  aplico        boolean not null,
  aporte        numeric not null,     -- cuánto sumó/restó a la dificultad
  detalle       text,
  created_at    timestamptz not null default now()
);
```

**Campos que NO se agregan (a propósito):**

- **Columnas de performance directo en `rr_hub_ideas`.** Un `probabilidad_va_a_funcionar`
  sobre la ficha esconde que el número tiene fecha de corte, versión de pesos y
  confianza. Vive en su tabla con su padre.
- **Cualquier cosa con "score" en el nombre de la idea.** El score es de la
  simulación, no de la idea. La idea no tiene score; tiene una evaluación fechada.
- **Guardar el jsonb de métricas de performance en la misma tabla que `metrics`.**
  Son cosas distintas: `metrics` es el resultado real de una pieza publicada,
  `rr_hub_sim_evidencia` es la razón de una conjetura sobre una idea no producida.
  Confundirlas es exactamente el error que §1.2D está tratando de evitar.

### 2.7 Lo que este diseño se compromete a NO hacer

- **No muestra un número sin fecha de corte, modelo y versión de pesos a la vista.**
- **No llama "probabilidad" a nada que no haya pasado el backtest de Fase 0.**
- **No guarda datos personales de terceros.** Los tokens de votante en
  `rr_hub_votes` ya son opacos y así se quedan; ninguna simulación crea una
  tabla con emails de clientes finales.
- **No automatiza la decisión.** El Hub aprueba y rechaza con reglas de rol
  explícitas (`docs/ROLES.md`); la simulación es un insumo más en la ficha, como
  lo es hoy la referencia visual. Un `APARTAR` es una recomendación, no un veto.

---

## Fuentes

**Papers (arXiv, todos leídos):**
[2609.25010](https://arxiv.org/abs/2609.25010) · [2604.19787](https://arxiv.org/abs/2604.19787) ·
[2603.00059](https://arxiv.org/abs/2603.00059) · [2605.15473](https://arxiv.org/abs/2605.15473) ·
[2604.12497](https://arxiv.org/abs/2604.12497) · [2602.03545](https://arxiv.org/abs/2602.03545) ·
[2510.18155](https://arxiv.org/abs/2510.18155) · [2411.07038](https://arxiv.org/abs/2411.07038) ·
[2312.03664](https://arxiv.org/abs/2312.03664) · [2304.03442](https://arxiv.org/abs/2304.03442) ·
[2407.21553](https://arxiv.org/abs/2407.21553) · [2406.02611](https://arxiv.org/abs/2406.02611)

**Código:**
`github.com/google-deepmind/concordia` (Apache-2.0, 1.755★, push 2026-10-01) ·
`github.com/joonspk-research/generative_agents` (Apache-2.0, 22.184★, push 2024-08-05)

**Precios de proveedores (leídos 2026-10-02):**
`delve.ai/pricing` · `anyword.com/pricing` · `survai.com` (estacionado) ·
`voxpop.ai` (estacionado) · `syntheticcx.com` (no resuelve)

**Precios de modelos:** `openrouter.ai/api/v1/models`, leído 2026-10-02.

**Estado del Hub:** migraciones `20260910_content_hub_isolated.sql`,
`20260926_hub_v3_board_feed_search.sql`, `20260928_hub_votacion_interna.sql`,
`20260929_hub_voto_cambio_y_nota.sql`; `docs/ROLES.md`, `docs/PENDIENTE_BASE.md`;
`src/lib/data.ts`, `src/app/[projectSlug]/metricas/page.tsx`.
