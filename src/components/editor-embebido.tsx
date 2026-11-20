'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RECORTE_COMPLETO,
  etiquetaDeVersion,
  filtroCss,
  marcaSegundos,
  nombreDeSalida,
  normalizarRecorte,
  rangoTrim,
  rectFuente,
  siguienteRotacion,
  tamanoLienzo,
  type FiltroFoto,
  type ModoEditor,
  type RecortePct,
  type Rotacion,
} from '@/lib/editor-embebido';

type EditorEmbebidoProps = {
  modo: ModoEditor;
  origen: string;
  nombre: string;
  numeroVersion: number;
  /** Solo fotos: el archivo tal cual llegó, para guardarlo sin pasar por el lienzo. */
  archivoOriginal: File | null;
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: (archivo: File, etiqueta: string) => void;
};

const FILTROS: Array<{ value: FiltroFoto; label: string }> = [
  { value: 'ninguno', label: 'SIN FILTRO' },
  { value: 'gris', label: 'GRIS' },
  { value: 'sepia', label: 'SEPIA' },
  { value: 'contraste', label: 'CONTRASTE' },
  { value: 'brillo', label: 'BRILLO' },
];

/**
 * Editor de foto y de video dentro de la ficha.
 *
 * El resultado que se guarda es siempre un JPEG: el bucket solo admite
 * imágenes. En video, ese JPEG es la portada del fotograma que se está viendo,
 * ya recortada, y el tramo (inicio–fin) viaja en la etiqueta de la versión.
 */
export function EditorEmbebido({
  modo,
  origen,
  nombre,
  numeroVersion,
  archivoOriginal,
  ocupado,
  onCerrar,
  onGuardar,
}: EditorEmbebidoProps) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fotoRef = useRef<HTMLImageElement | null>(null);
  const naturalRef = useRef({ w: 0, h: 0 });
  const videoListo = useRef(false);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState('');
  const [recorte, setRecorte] = useState<RecortePct>(RECORTE_COMPLETO);
  const [rotacion, setRotacion] = useState<Rotacion>(0);
  const [filtro, setFiltro] = useState<FiltroFoto>('ninguno');
  const [texto, setTexto] = useState('');
  const [textoX, setTextoX] = useState(50);
  const [textoY, setTextoY] = useState(78);
  const [duracion, setDuracion] = useState(0);
  const [inicio, setInicio] = useState(0);
  const [fin, setFin] = useState(0);

  const pintar = useCallback(() => {
    const lienzo = lienzoRef.current;
    const fuente = modo === 'video' ? videoRef.current : fotoRef.current;
    const natural = naturalRef.current;
    if (!lienzo || !fuente || natural.w < 1 || natural.h < 1) return;
    const { sx, sy, sw, sh } = rectFuente(natural.w, natural.h, recorte);
    const dest = tamanoLienzo(sw, sh, rotacion);
    lienzo.width = dest.w;
    lienzo.height = dest.h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;
    const girado = rotacion === 90 || rotacion === 270;
    const dw = girado ? dest.h : dest.w;
    const dh = girado ? dest.w : dest.h;
    ctx.save();
    ctx.filter = filtroCss(filtro);
    ctx.translate(dest.w / 2, dest.h / 2);
    ctx.rotate((rotacion * Math.PI) / 180);
    try {
      ctx.drawImage(fuente, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    } catch {
      ctx.restore();
      return;
    }
    ctx.restore();
    const linea = texto.trim();
    if (!linea) return;
    ctx.save();
    ctx.font = `700 ${Math.max(18, Math.round(dest.w * 0.045))}px "Space Grotesk", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, dest.w * 0.004);
    ctx.strokeStyle = '#070001';
    ctx.fillStyle = '#fffff3';
    const x = (textoX / 100) * dest.w;
    const y = (textoY / 100) * dest.h;
    ctx.strokeText(linea, x, y);
    ctx.fillText(linea, x, y);
    ctx.restore();
  }, [filtro, modo, recorte, rotacion, texto, textoX, textoY]);

  useEffect(() => {
    if (modo !== 'foto') return;
    let cancelado = false;
    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      fotoRef.current = img;
      naturalRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      setListo(true);
      setFallo('');
    };
    img.onerror = () => {
      if (!cancelado) setFallo('No se pudo leer la foto en el editor.');
    };
    img.src = origen;
    return () => {
      cancelado = true;
    };
  }, [modo, origen]);

  useEffect(() => {
    if (listo) pintar();
  }, [listo, pintar]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || modo !== 'video') return;
    const alMover = () => {
      const tramo = rangoTrim(duracion, inicio, fin);
      if (video.currentTime < tramo.inicio - 0.15) video.currentTime = tramo.inicio;
      if (duracion > 0 && video.currentTime > tramo.fin + 0.05) {
        video.pause();
        const destino = Math.max(tramo.inicio, tramo.fin - 0.05);
        if (Math.abs(video.currentTime - destino) > 0.05) video.currentTime = destino;
      }
      pintar();
    };
    video.addEventListener('timeupdate', alMover);
    video.addEventListener('seeked', alMover);
    return () => {
      video.removeEventListener('timeupdate', alMover);
      video.removeEventListener('seeked', alMover);
    };
  }, [duracion, fin, inicio, modo, pintar]);

  function alCargarVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.videoWidth || !video.videoHeight) {
      setFallo('Este video no tiene imagen. El editor necesita un cuadro para la portada.');
      return;
    }
    naturalRef.current = { w: video.videoWidth, h: video.videoHeight };
    if (!videoListo.current) {
      videoListo.current = true;
      const segundos = Number.isFinite(video.duration) ? video.duration : 0;
      setDuracion(segundos);
      setInicio(0);
      setFin(Math.round(segundos * 10) / 10);
      setListo(true);
    }
    setFallo('');
    pintar();
  }

  function fijarRecorte(parcial: Partial<RecortePct>) {
    setRecorte((prev) => normalizarRecorte({ ...prev, ...parcial }));
  }

  function fijarTramo(siguienteInicio: number, siguienteFin: number) {
    const tramo = rangoTrim(duracion, siguienteInicio, siguienteFin);
    setInicio(tramo.inicio);
    setFin(tramo.fin);
    const video = videoRef.current;
    if (video && video.currentTime < tramo.inicio) video.currentTime = tramo.inicio;
    if (video && video.currentTime > tramo.fin) video.currentTime = tramo.fin;
  }

  function restablecer() {
    setRecorte(RECORTE_COMPLETO);
    setRotacion(0);
    setFiltro('ninguno');
    setTexto('');
    setTextoX(50);
    setTextoY(78);
    if (modo === 'video') {
      setInicio(0);
      setFin(Math.round(duracion * 10) / 10);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }

  async function guardar(conCambios: boolean) {
    if (!conCambios && archivoOriginal && modo === 'foto') {
      onGuardar(archivoOriginal, etiquetaDeVersion(numeroVersion));
      return;
    }
    pintar();
    const lienzo = lienzoRef.current;
    if (!lienzo || lienzo.width < 1) {
      setFallo('Todavía no hay una imagen que guardar.');
      return;
    }
    const blob = await new Promise<Blob | null>((resolver) => {
      lienzo.toBlob((resultado) => resolver(resultado), 'image/jpeg', 0.9);
    });
    if (!blob) {
      setFallo('El navegador no pudo exportar el JPEG.');
      return;
    }
    const archivo = new File([blob], nombreDeSalida(nombre, modo), { type: 'image/jpeg' });
    const trim = modo === 'video' ? rangoTrim(duracion, inicio, fin) : null;
    onGuardar(archivo, etiquetaDeVersion(numeroVersion, trim && trim.fin > trim.inicio ? trim : null));
  }

  const titulo = modo === 'video' ? 'Editor de video' : 'Editor de foto';

  return (
    <section aria-label={titulo} className="mt-4 border border-blanco-40 bg-negro p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-blanco-50">{modo === 'video' ? '[EDITOR DE VIDEO]' : '[EDITOR DE FOTO]'}</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-blanco">{titulo}</h3>
        </div>
        <button type="button" onClick={onCerrar} className="btn-ghost min-h-[44px]">
          Cerrar
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-blanco-60">
        La edición ocurre en esta ficha. No se abre otra pestaña ni otro sitio.
        {modo === 'video'
          ? ' El bucket solo guarda imágenes: lo que se registra es la portada del fotograma que estás viendo, con el recorte aplicado. El tramo queda escrito en la etiqueta de la versión.'
          : ' Al guardar se crea una versión nueva. La anterior no se reemplaza.'}
      </p>

      {modo === 'video' && (
        <video
          ref={videoRef}
          src={origen}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={alCargarVideo}
          onLoadedData={alCargarVideo}
          onError={() => setFallo('El navegador no pudo reproducir este video.')}
          aria-label="Video a editar"
          className="mt-4 max-h-[40vh] w-full bg-negro"
        />
      )}

      <canvas ref={lienzoRef} className="mt-4 max-h-[50vh] w-full bg-blanco-05" aria-label="Resultado de la edición" />

      {fallo && (
        <p role="alert" className="mt-3 border border-mostaza bg-mostaza-05 p-2 font-mono text-[10px] leading-4 text-mostaza">
          {fallo}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {modo === 'video' && (
          <fieldset className="border border-blanco-20 p-3 sm:col-span-2">
            <legend className="px-1 font-mono text-[10px] text-blanco-50">TRAMO · {marcaSegundos(inicio)} – {marcaSegundos(fin)}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Rango id="trim-inicio" etiqueta="INICIO" min={0} max={duracion || 0} step={0.1} value={inicio} onChange={(valor) => fijarTramo(valor, fin)} />
              <Rango id="trim-fin" etiqueta="FIN" min={0} max={duracion || 0} step={0.1} value={fin} onChange={(valor) => fijarTramo(inicio, valor)} />
            </div>
          </fieldset>
        )}

        <fieldset className="border border-blanco-20 p-3">
          <legend className="px-1 font-mono text-[10px] text-blanco-50">RECORTE</legend>
          <div className="grid gap-3">
            <Rango id="recorte-x" etiqueta="IZQUIERDA" min={0} max={100} step={1} value={recorte.x} onChange={(valor) => fijarRecorte({ x: valor })} />
            <Rango id="recorte-y" etiqueta="ARRIBA" min={0} max={100} step={1} value={recorte.y} onChange={(valor) => fijarRecorte({ y: valor })} />
            <Rango id="recorte-ancho" etiqueta="ANCHO" min={8} max={100} step={1} value={recorte.ancho} onChange={(valor) => fijarRecorte({ ancho: valor })} />
            <Rango id="recorte-alto" etiqueta="ALTO" min={8} max={100} step={1} value={recorte.alto} onChange={(valor) => fijarRecorte({ alto: valor })} />
          </div>
        </fieldset>

        <fieldset className="border border-blanco-20 p-3">
          <legend className="px-1 font-mono text-[10px] text-blanco-50">AJUSTE</legend>
          <button type="button" onClick={() => setRotacion((actual) => siguienteRotacion(actual))} className="btn-ghost min-h-[44px] w-full justify-center">
            Girar 90° · ahora {rotacion}°
          </button>
          <label htmlFor="filtro-editor" className="mt-3 block">
            <span className="mono-label mb-1 block text-blanco-50">FILTRO</span>
            <select
              id="filtro-editor"
              value={filtro}
              onChange={(event) => setFiltro(event.target.value as FiltroFoto)}
              className="input-brutal w-full"
            >
              {FILTROS.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </label>
          <label htmlFor="texto-editor" className="mt-3 block">
            <span className="mono-label mb-1 block text-blanco-50">TEXTO</span>
            <input
              id="texto-editor"
              value={texto}
              onChange={(event) => setTexto(event.target.value.slice(0, 80))}
              className="input-brutal w-full"
              placeholder="Una línea sobre la imagen"
            />
          </label>
          <div className="mt-3 grid gap-3">
            <Rango id="texto-x" etiqueta="TEXTO · HORIZONTAL" min={0} max={100} step={1} value={textoX} onChange={setTextoX} />
            <Rango id="texto-y" etiqueta="TEXTO · VERTICAL" min={0} max={100} step={1} value={textoY} onChange={setTextoY} />
          </div>
        </fieldset>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!listo || ocupado} onClick={() => void guardar(true)} className="btn-brutal min-h-[44px] disabled:opacity-50">
          {ocupado ? 'Guardando…' : modo === 'video' ? 'Guardar portada' : 'Guardar versión'}
        </button>
        {modo === 'foto' && archivoOriginal && (
          <button type="button" disabled={ocupado} onClick={() => void guardar(false)} className="btn-ghost min-h-[44px]">
            Subir original
          </button>
        )}
        <button type="button" onClick={restablecer} className="btn-ghost min-h-[44px]">
          Restablecer
        </button>
      </div>
    </section>
  );
}

function Rango({
  id,
  etiqueta,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string;
  etiqueta: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (valor: number) => void;
}) {
  const mostrado = step < 1 ? value.toFixed(1) : String(Math.round(value));
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-blanco-50">
        <span>{etiqueta}</span>
        <span>{mostrado}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full accent-blanco"
      />
    </label>
  );
}
