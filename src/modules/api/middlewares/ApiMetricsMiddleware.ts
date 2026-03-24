import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { NextFunction, Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class ApiMetricsMiddleware implements NestMiddleware {
  constructor(
    @InjectMetric('http_request_duration_milliseconds')
    public responseTimeHistogram: Histogram<string>,
    @InjectMetric('http_request_size_bytes')
    public requestSizeHistogram: Histogram<string>,
    @InjectMetric('http_response_size_bytes')
    public responseSizeHistogram: Histogram<string>,
    @InjectMetric('http_all_request_total')
    public allRequestTotal: Counter<string>,
    @InjectMetric('http_all_success_total')
    public allSuccessTotal: Counter<string>,
    @InjectMetric('http_all_errors_total')
    public allErrorsTotal: Counter<string>,
    @InjectMetric('http_all_client_error_total')
    public allClientErrorTotal: Counter<string>,
    @InjectMetric('http_all_server_error_total')
    public allServerErrorTotal: Counter<string>,
    @InjectMetric('http_request_total') public requestTotal: Counter<string>,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // TODO: Figure out if can put that on middleware class context.
    req.metrics = {
      timer: this.responseTimeHistogram.startTimer(),
      contentLength: parseInt(req.get('content-length')) || 0,
    };

    res.once('finish', () => {
      this.handleResponse(req, res);
    });

    next();
  }

  private handleResponse(req: Request, res: Response) {
    const responseLength = parseInt(res.get('Content-Length')) || 0;

    const route = this.getRoute(req);

    const labels = {
      method: req.method,
      route,
      code: res.statusCode,
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.requestSizeHistogram.observe(labels, req.metrics.contentLength);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    req.metrics.timer(labels);
    this.responseSizeHistogram.observe(labels, responseLength);
    this.requestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
    this.countResponse(res);
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

  private countResponse(res: Response) {
    this.allRequestTotal.inc();
    const codeClass = this.getStatusCodeClass(res.statusCode);

    switch (codeClass) {
      case 'success':
        this.allSuccessTotal.inc();
        break;
      case 'redirect':
        if (res.statusCode === 304) {
          this.allSuccessTotal.inc();
        }
        break;
      case 'client_error':
        this.allErrorsTotal.inc();
        this.allClientErrorTotal.inc();
        break;
      case 'server_error':
        this.allErrorsTotal.inc();
        this.allServerErrorTotal.inc();
        break;
    }
  }

  private getStatusCodeClass(code: number): string {
    if (code < 200) return 'info';
    if (code < 300) return 'success';
    if (code < 400) return 'redirect';
    if (code < 500) return 'client_error';
    return 'server_error';
  }
}
