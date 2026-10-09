import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Los errores esperados (400, 401, 403, 404, 409...) sí mandan su mensaje
    // real, porque vienen de nuestras propias validaciones/guards.
    // Cualquier error no controlado (500: fallo de Prisma, excepción no
    // capturada, etc.) se oculta detrás de un mensaje genérico para no
    // exponer detalles internos del servidor (rutas de archivos, queries,
    // stack traces) — justo lo que un escaneo de seguridad como el de
    // Google Play penalizaría.
    const message = isHttpException
      ? exception.getResponse()
      : 'Ocurrió un error interno. Intenta de nuevo más tarde.';

    if (!isHttpException) {
      this.logger.error(
        `${request.method} ${request.url}`,
        (exception as Error)?.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
