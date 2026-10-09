import { Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface ClaveJWT {
  clave: string;
  creada: string; // ISO date
}

interface AlmacenClaves {
  activa: ClaveJWT;
  anterior: ClaveJWT | null;
}

const RUTA_ALMACEN = path.join(process.cwd(), 'jwt-keys.json');
const DIAS_VALIDEZ = 14;

@Injectable()
export class JwtKeyService implements OnModuleInit {
  private almacen!: AlmacenClaves;

  onModuleInit() {
    this.almacen = this.cargarAlmacen();
    this.verificarRotacion();
  }

  private generarClave(bits = 1024): string {
    return crypto.randomBytes(bits / 8).toString('base64url');
  }

  private cargarAlmacen(): AlmacenClaves {
    if (fs.existsSync(RUTA_ALMACEN)) {
      return JSON.parse(fs.readFileSync(RUTA_ALMACEN, 'utf-8'));
    }
    const nuevo: AlmacenClaves = {
      activa: { clave: this.generarClave(), creada: new Date().toISOString() },
      anterior: null,
    };
    this.guardarAlmacen(nuevo);
    return nuevo;
  }

  private guardarAlmacen(datos: AlmacenClaves) {
    fs.writeFileSync(RUTA_ALMACEN, JSON.stringify(datos, null, 2));
  }

  private verificarRotacion() {
    const creada = new Date(this.almacen.activa.creada);
    const ahora = new Date();
    const diasTranscurridos =
      (ahora.getTime() - creada.getTime()) / (1000 * 60 * 60 * 24);

    if (diasTranscurridos >= DIAS_VALIDEZ) {
      this.almacen.anterior = this.almacen.activa;
      this.almacen.activa = {
        clave: this.generarClave(),
        creada: ahora.toISOString(),
      };
      this.guardarAlmacen(this.almacen);
    }
  }

  getClaveActiva(): string {
    this.verificarRotacion();
    return this.almacen.activa.clave;
  }

  getClavesValidas(): string[] {
    this.verificarRotacion();
    return this.almacen.anterior
      ? [this.almacen.activa.clave, this.almacen.anterior.clave]
      : [this.almacen.activa.clave];
  }
}