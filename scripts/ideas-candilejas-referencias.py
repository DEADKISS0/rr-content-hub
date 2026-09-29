"""
Ideas de CANDILEJAS con la referencia y la portada ya asignadas.

Santiago, 2026-09-29: "candilejas, y dale mete todas, porfavor con miniatura".

Cada idea trae:
  - el reel que YA fue verificado por el usuario (los 9 que compartio),
  - una portada propia, dibujada en el mismo lenguaje grafico que O1/O2,
  - los cuatro briefs (camara, talento, edicion, que no hacer) escritos, no
    dejados en blanco: una idea sin brief es una idea que nadie puede rodar.

Por que se escriben a mano y no con el generador: el generador llama al bot y
produce texto generico. Estas siete salen de los captions que el propio Santiago
compartio, y el brief tiene que encajar con EL reel de referencia, no con una
idea abstracta.

El `?stkn=` se quita al guardar: Instagram devuelve un embed VACIO si lo lleva
(el bug del 2026-09-29).
"""

IDEAS = [
    {
        "codigo": "O8",
        "titulo": "La pieza que se desarma sola en el aire",
        "portada": "pizza",
        "referencia": "https://www.instagram.com/reel/DcWO-iHOq9T/",
        "descripcion": (
            "Una pieza de comida cayendo en camara lenta, con sus ingredientes separandose en el aire "
            "antes de volver a juntarse. El movimiento es el protagonista: no hay nadie comiendo, no hay "
            "mesa, no hay contexto. Solo el objeto en el aire y la luz que lo revela."
        ),
        "objetivo": (
            "Que se vea la calidad del producto sin necesidad de persona. Un stop en el scroll con un solo "
            "objeto bien iluminado vale mas que veinte planos de mesa servida."
        ),
        "camara": (
            "Plano fijo, camara lenta real (120 fps), contra fondo oscuro. El objeto entra por arriba del "
            "cuadro y se arma solo en el centro. Sin movimientos de camara: el movimiento es del producto."
        ),
        "talento": (
            "Ninguno. Es una pieza de producto. Si aparece una mano, es solo para sostenerlo los primeros "
            "dos segundos y salir."
        ),
        "edicion": (
            "Un solo corte al final, cuando el objeto se completa. Antes, ritmo lento y sin transiciones. "
            "El sonido: el golpe del objeto armandose, sin musica."
        ),
        "avoid": (
            "No poner texto encima del objeto. No usar flashes. No gente mirando. No mesas ni cubiertos: "
            "esto es el producto solo."
        ),
    },
    {
        "codigo": "O9",
        "titulo": "Lo que ves en el vaso antes de probarlo",
        "portada": "bebidas",
        "referencia": "https://www.instagram.com/reel/DadYNVxAsOt/",
        "descripcion": (
            "Bebida de color fuerte en vaso alto, con ingredientes visibles y luz de ventana. Se arma en "
            "plano cenital y luego se pasa a primer plano del vaso ya lleno. El color es el argumento: la "
            "bebida se entiende de un vistazo, sin leer nada."
        ),
        "objetivo": (
            "Comunicar sabor y frescura en menos de tres segundos. La persona decide si lo quiere antes de "
            "que empiece el texto."
        ),
        "camara": (
            "Cenital para el armado, luego frontal a la altura de los ojos del vaso. Luz natural de ventana, "
            "nunca artificial. Fondo de color liso que no compita con la bebida."
        ),
        "talento": (
            "Solo una mano que entra al final para tomar el vaso. Sin cara: la mirada distrae del producto."
        ),
        "edicion": (
            "Corte unico entre cenital y frontal, en el momento en que el vaso queda lleno. Ritmo medio, sin "
            "acelerados. Sonido: hielo y liquido, sin musica."
        ),
        "avoid": (
            "No:hielo en exceso ni vasos con estampado que tapa el producto. No letrero de marca en grande. "
            "No mover el vaso: en video de bebida, el movimiento roba la atencion del color."
        ),
    },
    {
        "codigo": "O10",
        "titulo": "El detalle que nadie ve y todos notan",
        "portada": "bastidores",
        "referencia": "https://www.instagram.com/reel/DaEU309poAv/",
        "descripcion": (
            "Bastidores reales: la mesa de trabajo, las manos preparando, el desorden. La diferencia con una "
            "foto de producto terminada es que aqui se ve el trabajo. Sin pulir nada. Se cuenta lo que hay en "
            "la mesa antes de que la cosa exista."
        ),
        "objetivo": (
            "Bajar la desconfianza. Una persona ve que hay alguien detras del producto y le cree mas rapido "
            "que si ve una imagen perfecta."
        ),
        "camara": (
            "En mano, estilo documental. Luz de la propia mesa, la que hay. Se ve el desorden y no se "
            "corrige nada. Plano medio: manos y mesa, no el rostro."
        ),
        "talento": "Las manos de quien hace el trabajo. No la cara. Sin voz.",
        "edicion": (
            "Cortes largos, sin musica, con el sonido ambiente del local. Si hay una toma que se equivoca, "
            "se deja."
        ),
        "avoid": (
            "No pulir. No lights. No rótulo en la imagen. No contadores de visitas ni tickets a la camara: "
            "eso rompe el pacto de que es verdad."
        ),
    },
    {
        "codigo": "O11",
        "titulo": "El primero que se acaba y nadie lo pidió",
        "portada": "guayaba",
        "referencia": "https://www.instagram.com/reel/DYxwByMPZ3n/",
        "descripcion": (
            "Un plato que se arma en segundos y un primer plano de lo que queda. La idea es que el primer "
            "bocado es siempre el mismo: lo que habia al fondo, lo que nadie elige, lo que se acaba primero. "
            "Sin escanear la carta entera."
        ),
        "objetivo": "Hablar del producto que nadie pide. Generar curiosidad por algo secundario que sí se acaba primero.",
        "camara": (
            "Cenital a 45 grados, luz dura lateral. Un solo plato, un solo encuadre. El primer plano al final "
            "tiene que verse bien a pantalla pequena."
        ),
        "talento": "Ninguno. Solo manos si hace falta para servir. El plato es el protagonista.",
        "edicion": "Prologo largo (3 segundos sin corte) y un corte directo al primer plano. Sin transiciones. Sonido ambiente.",
        "avoid": (
            "No con mas de tres platos. No repetir el unico producto de la pieza. No ofertas ni precios. "
            "No un texto atado a un objeto: eso no lo anuncia, lo esconde."
        ),
    },
    {
        "codigo": "O12",
        "titulo": "El movimiento que se nota antes que la prenda",
        "portada": "fluidez",
        "referencia": "https://www.instagram.com/reel/DbI-fbyuftK/",
        "descripcion": (
            "La prenda en movimiento, siguiendo la idea y no siguiendo a la persona: el vuelo de un volado, la "
            "caida de una manga, lo que hace la tela cuando el cuerpo se detiene. Se filma en plano general "
            "para que el movimiento se lea entero."
        ),
        "objetivo": (
            "Que la primera sensacion sea de algo que se mueve bien, antes de que la persona piense en el "
            "nombre, la talla o el precio."
        ),
        "camara": (
            "Cuerpo entero, camara a la altura del pecho, un solo plano largo. La luz tiene que revelar el "
            "vuelo de la tela: si la prenda se pierde contra el fondo, el video no sirve."
        ),
        "talento": "Una sola modelo. Ritmo lento al principio, giro de caderas al segundo tres. Nada de poses estaticas.",
        "edicion": (
            "Ritmo lento al principio, giro de caderas al segundo tres. Un solo corte, sin transiciones. La "
            "musica entra despues del giro, nunca antes."
        ),
        "avoid": (
            "No editar en camara lenta. No texto ni voz en off sobre el movimiento: si habla, deja de mirarse "
            "la tela. No mas de una prenda por pieza."
        ),
    },
    {
        "codigo": "O13",
        "titulo": "Lo que hay detrás de cada sorbo",
        "portada": "bastidores",
        "referencia": "https://www.instagram.com/reel/Dc2_MxUsJj9/",
        "descripcion": (
            "El antes del producto: la fruta, la hoja, lo que se corta y lo que se exprime. Se ve la materia "
            "primera en plano cenital y despues el vaso ya servido. La transicion entre las dos partes es el "
            "mismo producto, no dos cosas distintas."
        ),
        "objetivo": (
            "Justificar el precio con la materia, sin decirlo. La persona ve de donde sale y el valor se "
            "explica solo."
        ),
        "camara": (
            "Cenital para la materia prima, frontal bajo para el vaso servido. El paso entre los dos encuadres "
            "es un corte, no una transicion."
        ),
        "talento": "Solo manos trabajando. La cara no aporta nada aqui.",
        "edicion": "Ritmo constante, sin acelerados. El corte al vaso servido cae en el primer sorbo del audio.",
        "avoid": "No dejar nada fuera de cuadro. No yerba ni paquetes en la mesa: eso es la marca, no el producto.",
    },
    {
        "codigo": "O14",
        "titulo": "La mesa puesta que se desmonta en cámara",
        "portada": "hamburguesa",
        "referencia": "https://www.instagram.com/reel/DX7ne9-vpmR/",
        "descripcion": (
            "Una mesa con varios platos que se ve completa y despues se va vaciando, plato por plato, con "
            "corte directo. No hay gente comiendo: solo la mesa losing el estado. Empieza llena y termina como "
            "la deja alguien que se fue."
        ),
        "objetivo": (
            "Mostrar la variedad real del producto sin tener que contar nada. Siete platos que se van, "
            "dicen mas que siete nombres en pantalla."
        ),
        "camara": (
            "Plano cenital fijo, toda la mesa dentro del cuadro. Si algo se sale del encuadre, se repite: "
            "el plano no se mueve."
        ),
        "talento": "Ninguno. Ni una mano entra en cuadro: la mesa se vacia sola, por corte.",
        "edicion": "Un corte por plato, todos en el mismo plano. Sin transiciones, sin fundidos. Sonido: el golpe seco de cada plato que se va.",
        "avoid": "No música alegre: rompe el tono. No servilletas usadas. No repetir un plato que ya salió.",
    },
]
