import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { base32Decode, base32Encode } from './base32.util';

const ANCHO = '320'; // miniatura ligera: pesa poco y es fácil de manipular
const MAX_BYTES = 300_000;

export interface Codificada {
  mime: string;
  data: string; // imagen en Base32
}

/**
 * Miniaturas de lugares guardadas en la base de datos como texto Base32.
 *   1) Si ya está en la base de datos (tabla PlaceThumbnail), se usa esa.
 *   2) API 1: Wikipedia en español (imagen principal del artículo)
 *   3) API 2: Wikimedia Commons (búsqueda de archivos de imagen)
 * La app descarga el listado y lo guarda en su base de datos local para verlo sin internet.
 */
@Injectable()
export class PlaceImagesService {
  private readonly log = new Logger(PlaceImagesService.name);
  private readonly headers = { 'User-Agent': 'MXGuide/1.0 (mxguidecontact@gmail.com)' };

  constructor(private readonly prisma: PrismaService) {}

  /** Miniatura codificada de un lugar (de la BD, o la busca y la guarda). */
  async getEncoded(placeId: string): Promise<Codificada> {
    if (!/^[a-f0-9-]{36}$/i.test(placeId)) throw new NotFoundException('Lugar no encontrado');

    const guardada = await this.prisma.placeThumbnail.findUnique({ where: { placeId } });
    if (guardada) return { mime: guardada.mime, data: guardada.data };

    const place = await this.prisma.place.findUnique({
      where: { id: placeId },
      select: { name: true },
    });
    if (!place) throw new NotFoundException('Lugar no encontrado');

    const url = (await this.wikipedia(place.name)) ?? (await this.commons(place.name));
    const img = url ? await this.download(url) : null;
    if (!img) throw new NotFoundException('No se encontró imagen para este lugar');

    const nueva = { mime: img.mime, data: base32Encode(img.buffer) };
    await this.prisma.placeThumbnail.upsert({
      where: { placeId },
      create: { placeId, ...nueva },
      update: nueva,
    });
    return nueva;
  }

  /** Imagen ya decodificada, lista para enviarse como archivo. */
  async getImage(placeId: string) {
    const { mime, data } = await this.getEncoded(placeId);
    return { mime, buffer: base32Decode(data) };
  }

  /** Todas las miniaturas guardadas: la app las copia a su base de datos local. */
  async listAll() {
    return this.prisma.placeThumbnail.findMany({
      select: { placeId: true, mime: true, data: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Busca y guarda la miniatura de todos los lugares que existen hoy en la base de datos. */
  async syncAll() {
    const places = await this.prisma.place.findMany({ select: { id: true, name: true } });
    let listas = 0;
    const sinImagen: string[] = [];
    for (const p of places) {
      try {
        await this.getEncoded(p.id);
        listas++;
      } catch {
        sinImagen.push(p.name);
      }
      await new Promise((r) => setTimeout(r, 300)); // respeta a las APIs
    }
    this.log.log(`Miniaturas: ${listas} listas, ${sinImagen.length} sin resultado`);
    return { total: places.length, conImagen: listas, sinImagen };
  }

  // ---- API 1: Wikipedia ----
  private async wikipedia(nombre: string): Promise<string | null> {
    const json = await this.json('https://es.wikipedia.org/w/api.php', {
      action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail',
      pithumbsize: ANCHO, generator: 'search', gsrsearch: nombre, gsrlimit: '3',
    });
    const pages: any[] = Object.values(json?.query?.pages ?? {});
    pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
    return pages.find((p) => p.thumbnail?.source)?.thumbnail.source ?? null;
  }

  // ---- API 2: Wikimedia Commons ----
  private async commons(nombre: string): Promise<string | null> {
    const json = await this.json('https://commons.wikimedia.org/w/api.php', {
      action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
      gsrsearch: nombre, gsrlimit: '5', prop: 'imageinfo', iiprop: 'url', iiurlwidth: ANCHO,
    });
    const pages: any[] = Object.values(json?.query?.pages ?? {});
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      const url: string | undefined = info?.thumburl ?? info?.url;
      if (url && /\.(jpe?g|png)$/i.test(url)) return url;
    }
    return null;
  }

  private async json(base: string, params: Record<string, string>): Promise<any | null> {
    try {
      const res = await fetch(`${base}?${new URLSearchParams(params)}`, {
        headers: this.headers,
        signal: AbortSignal.timeout(12000),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  private async download(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
    try {
      const res = await fetch(url, { headers: this.headers, signal: AbortSignal.timeout(20000) });
      const mime = res.headers.get('content-type')?.split(';')[0] ?? '';
      if (!res.ok || !mime.startsWith('image/')) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return buffer.length > 0 && buffer.length <= MAX_BYTES ? { buffer, mime } : null;
    } catch {
      return null;
    }
  }
}