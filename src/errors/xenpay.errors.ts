/**
 * XenPay Typed Error Hierarchy
 */

export class XenPayError extends Error {
  public readonly isXenPayError = true;
  constructor(message: string) {
    super(message);
    this.name = 'XenPayError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class XenPayApiError extends XenPayError {
  public readonly statusCode: number;
  public readonly responseBody: any;
  public readonly endpoint: string;
  public readonly isRetryable: boolean;

  constructor(statusCode: number, message: string, responseBody: any = null, endpoint: string = '') {
    super(message);
    this.name = 'XenPayApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.endpoint = endpoint;
    this.isRetryable = [408, 429, 500, 502, 503, 504].includes(statusCode);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** HTTP 401: Invalid credentials or expired API key */
export class XenPayAuthError extends XenPayApiError {
  constructor(message = 'Unauthorized: Invalid XenPay API key or credentials', responseBody?: any, endpoint?: string) {
    super(401, message, responseBody, endpoint);
    this.name = 'XenPayAuthError';
  }
}

/** HTTP 403: Forbidden - IP restriction, inactive account or KYC pending */
export class XenPayForbiddenError extends XenPayApiError {
  constructor(message = 'Forbidden: Access denied. Check IP whitelisting or merchant account status', responseBody?: any, endpoint?: string) {
    super(403, message, responseBody, endpoint);
    this.name = 'XenPayForbiddenError';
  }
}

/** HTTP 404: Resource or order not found */
export class XenPayNotFoundError extends XenPayApiError {
  constructor(message = 'Not Found: Order or endpoint not found on XenPay gateway', responseBody?: any, endpoint?: string) {
    super(404, message, responseBody, endpoint);
    this.name = 'XenPayNotFoundError';
  }
}

/** HTTP 405: Method Not Allowed */
export class XenPayMethodNotAllowedError extends XenPayApiError {
  constructor(message = 'Method Not Allowed: Invalid HTTP verb for requested XenPay endpoint', responseBody?: any, endpoint?: string) {
    super(405, message, responseBody, endpoint);
    this.name = 'XenPayMethodNotAllowedError';
  }
}

/** HTTP 409: Conflict - Duplicate merchant_order_id or state clash */
export class XenPayConflictError extends XenPayApiError {
  constructor(message = 'Conflict: Duplicate merchant_order_id or invalid order state transition', responseBody?: any, endpoint?: string) {
    super(409, message, responseBody, endpoint);
    this.name = 'XenPayConflictError';
  }
}

/** HTTP 422: Unprocessable Entity - Validation error */
export class XenPayValidationError extends XenPayApiError {
  public readonly validationErrors?: Record<string, string[]>;

  constructor(message = 'Validation Error: Invalid parameters provided to XenPay', responseBody?: any, endpoint?: string) {
    super(422, message, responseBody, endpoint);
    this.name = 'XenPayValidationError';
    this.validationErrors = responseBody?.errors || responseBody?.validation || undefined;
  }
}

/** HTTP 429: Rate Limit Exceeded */
export class XenPayRateLimitError extends XenPayApiError {
  constructor(message = 'Rate Limit Exceeded: Slow down API requests to XenPay', responseBody?: any, endpoint?: string) {
    super(429, message, responseBody, endpoint);
    this.name = 'XenPayRateLimitError';
  }
}

/** HTTP 500, 502, 503, 504: Gateway or Upstream Server Error */
export class XenPayServerError extends XenPayApiError {
  constructor(statusCode = 500, message = 'XenPay Gateway Server Error', responseBody?: any, endpoint?: string) {
    super(statusCode, message, responseBody, endpoint);
    this.name = 'XenPayServerError';
  }
}

/** Network timeout or connection drop */
export class XenPayNetworkError extends XenPayError {
  public readonly isRetryable = true;
  public readonly originalError?: Error;

  constructor(message = 'Network error communicating with XenPay gateway', originalError?: Error) {
    super(message);
    this.name = 'XenPayNetworkError';
    this.originalError = originalError;
  }
}

/**
 * Factory to map HTTP status codes to specific XenPay error classes
 */
export function mapHttpError(status: number, data: any, endpoint: string): XenPayApiError {
  const message = data?.message || data?.error || `XenPay API error [${status}]`;

  switch (status) {
    case 401:
      return new XenPayAuthError(message, data, endpoint);
    case 403:
      return new XenPayForbiddenError(message, data, endpoint);
    case 404:
      return new XenPayNotFoundError(message, data, endpoint);
    case 405:
      return new XenPayMethodNotAllowedError(message, data, endpoint);
    case 409:
      return new XenPayConflictError(message, data, endpoint);
    case 422:
      return new XenPayValidationError(message, data, endpoint);
    case 429:
      return new XenPayRateLimitError(message, data, endpoint);
    case 500:
    case 502:
    case 503:
    case 504:
      return new XenPayServerError(status, `XenPay Gateway Error [${status}]: ${message}`, data, endpoint);
    default:
      return new XenPayApiError(status, message, data, endpoint);
  }
}
