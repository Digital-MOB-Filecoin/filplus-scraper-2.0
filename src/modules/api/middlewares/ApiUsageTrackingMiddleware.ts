import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { GlobalValues } from '../../../../submodules/filecoin-plus-scraper-entities/globalValues.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKeyUsage } from '../entities/apiKeyUsage.entity';

@Injectable()
export class ApiUsageTrackingMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(ApiKeyUsage)
    private apiKeyUsageRepository: Repository<ApiKeyUsage>,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    res.once('finish', () => {
      this.handleResponse(req, res);
    });

    next();
  }

  private handleResponse(req: Request, res: Response) {
    const route = this.getRoute(req);
    const apiKey = req.get('x-api-key');
    var ip = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'][0]
      : req.socket.remoteAddress;

    const item = this.apiKeyUsageRepository.create({
      key: apiKey,
      route,
      timestamp: Math.round(new Date().getTime() / 1000),
      ip,
      statusCode: res.statusCode,
      statusCodeClass: this.getStatusCodeClass(res.statusCode),
    });
    this.apiKeyUsageRepository.save(item);
  }

  private getRoute(req) {
    let route = req.baseUrl;
    if (req.route) {
      if (req.route.path !== '/') {
        route = route ? route + req.route.path : req.route.path;
      }

      if (!route || route === '' || typeof route !== 'string') {
        route = req.originalUrl.split('?')[0];
      } else {
        const splittedRoute = route.split('/');
        const splittedUrl = req.originalUrl.split('?')[0].split('/');
        const routeIndex = splittedUrl.length - splittedRoute.length + 1;

        const baseUrl = splittedUrl.slice(0, routeIndex).join('/');
        route = baseUrl + route;
      }

      // TODO Support on config
      const includeQueryParams = null;
      if (includeQueryParams === true && Object.keys(req.query).length > 0) {
        route = `${route}?${Object.keys(req.query)
          .sort()
          .map((queryParam) => `${queryParam}=<?>`)
          .join('&')}`;
      }
    }

    if (typeof req.params === 'object') {
      Object.keys(req.params).forEach((paramName) => {
        route = route.replace(req.params[paramName], ':' + paramName);
      });
    }

    // this condition will evaluate to true only in
    // express framework and no route was found for the request. if we log this metrics
    // we'll risk in a memory leak since the route is not a pattern but a hardcoded string.
    if (!route || route === '') {
      // if (!req.route && res && res.statusCode === 404) {
      route = 'N/A';
    }

    return route;
  }

  private getStatusCodeClass(code: number): string {
    if (code < 200) return 'info';
    if (code < 300) return 'success';
    if (code < 400) return 'redirect';
    if (code < 500) return 'client_error';
    return 'server_error';
  }
}
