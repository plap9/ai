/**
 * Type guard để check xem value có phải là object không
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard để check xem value có phải là string không
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard để check xem value có phải là number không
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard để check xem value có phải là boolean không
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard để check xem value có phải là array không
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard để check xem value có phải là null hoặc undefined không
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Type guard để check xem value có phải là function không
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * Type guard để check xem value có phải là Date không
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard để check xem value có property cụ thể không
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Type guard để check multiple properties
 */
export function hasProperties<K extends string>(
  obj: unknown,
  ...keys: K[]
): obj is Record<K, unknown> {
  return isObject(obj) && keys.every((key) => key in obj);
}

/**
 * Safe getter cho nested properties
 */
export function getNestedProperty<T = unknown>(
  obj: unknown,
  path: string,
  defaultValue?: T,
): T | undefined {
  if (!isObject(obj)) return defaultValue;

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (!isObject(current) || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current as T;
}

// ===== BỔ SUNG CÁC TYPE GUARDS HỮU ÍCH =====

/**
 * Type guard để check xem string có phải là UUID không
 */
export function isUUID(value: unknown): value is string {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard để check xem string có phải là email không
 */
export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Type guard để check xem string có empty không
 */
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

/**
 * Type guard để check xem number có positive không
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * Type guard để check xem number có trong range không
 */
export function isNumberInRange(min: number, max: number) {
  return (value: unknown): value is number => {
    return isNumber(value) && value >= min && value <= max;
  };
}

/**
 * Type guard để check xem string có length trong range không
 */
export function isStringWithLength(min: number, max?: number) {
  return (value: unknown): value is string => {
    if (!isString(value)) return false;
    const length = value.length;
    return length >= min && (max === undefined || length <= max);
  };
}

/**
 * Type guard để check xem array có empty không
 */
export function isNonEmptyArray<T = unknown>(value: unknown): value is T[] {
  return isArray<T>(value) && value.length > 0;
}

/**
 * Type guard để check all elements trong array
 */
export function isArrayOf<T>(validator: (item: unknown) => item is T) {
  return (value: unknown): value is T[] => {
    return isArray(value) && value.every(validator);
  };
}

/**
 * Type guard để check object có shape cụ thể
 */
export function isObjectWithShape<T extends Record<string, unknown>>(shape: {
  [K in keyof T]: (value: unknown) => value is T[K];
}) {
  return (value: unknown): value is T => {
    if (!isObject(value)) return false;

    for (const [key, validator] of Object.entries(shape)) {
      if (!validator(value[key])) return false;
    }

    return true;
  };
}

/**
 * Type guard để parse Date từ string
 */
export function isDateString(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Type guard để check enum values
 */
export function isEnumValue<T extends Record<string, string | number>>(enumObject: T) {
  const enumValues = Object.values(enumObject);
  return (value: unknown): value is T[keyof T] => {
    return enumValues.includes(value as T[keyof T]);
  };
}

/**
 * Type-safe parser cho request body
 */
export class SafeParser {
  private data: unknown;

  constructor(data: unknown) {
    this.data = data;
  }

  /**
   * Get string value
   */
  getString(key: string, defaultValue = ''): string {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isString(value) ? value : defaultValue;
  }

  /**
   * Get non-empty string value
   */
  getNonEmptyString(key: string, defaultValue = ''): string {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isNonEmptyString(value) ? value : defaultValue;
  }

  /**
   * Get number value
   */
  getNumber(key: string, defaultValue = 0): number {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isNumber(value) ? value : defaultValue;
  }

  /**
   * Get positive number value
   */
  getPositiveNumber(key: string, defaultValue = 1): number {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isPositiveNumber(value) ? value : defaultValue;
  }

  /**
   * Get boolean value
   */
  getBoolean(key: string, defaultValue = false): boolean {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isBoolean(value) ? value : defaultValue;
  }

  /**
   * Get object value
   */
  getObject<T extends Record<string, unknown>>(key: string, defaultValue = {} as T): T {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isObject(value) ? (value as T) : defaultValue;
  }

  /**
   * Get array value
   */
  getArray<T = unknown>(key: string, defaultValue: T[] = []): T[] {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isArray<T>(value) ? value : defaultValue;
  }

  /**
   * Get UUID value
   */
  getUUID(key: string, defaultValue?: string): string | undefined {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isUUID(value) ? value : defaultValue;
  }

  /**
   * Get email value
   */
  getEmail(key: string, defaultValue?: string): string | undefined {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];
    return isEmail(value) ? value : defaultValue;
  }

  /**
   * Get Date value from string
   */
  getDate(key: string, defaultValue?: Date): Date | undefined {
    if (!isObject(this.data)) return defaultValue;
    const value = this.data[key];

    if (isDate(value)) return value;
    if (isDateString(value)) return new Date(value);
    return defaultValue;
  }

  /**
   * Get nested value
   */
  getNested<T = unknown>(path: string, defaultValue?: T): T | undefined {
    return getNestedProperty<T>(this.data, path, defaultValue);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return hasProperty(this.data, key);
  }

  /**
   * Get raw data (type-safe)
   */
  getRaw<T = unknown>(): T {
    return this.data as T;
  }
}

/**
 * Enhanced validation rule interface
 */
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'uuid' | 'email';
  validator?: (value: unknown) => boolean;
  message?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  items?: ValidationSchema; // for array items
  properties?: ValidationSchema; // for nested objects
}

/**
 * Validation schemas using type guards
 */
export interface ValidationSchema {
  [key: string]: ValidationRule;
}

/**
 * Enhanced validate object với schema
 */
export function validateObject(
  obj: unknown,
  schema: ValidationSchema,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isObject(obj)) {
    errors.push('Input must be an object');
    return { valid: false, errors };
  }

  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];

    // Check required
    if (rules.required && isNullOrUndefined(value)) {
      errors.push(rules.message || `${key} is required`);
      continue;
    }

    // Skip if not required and value is null/undefined
    if (!rules.required && isNullOrUndefined(value)) {
      continue;
    }

    // Check type
    if (rules.type) {
      let isValidType = false;
      switch (rules.type) {
        case 'string':
          isValidType = isString(value);
          break;
        case 'number':
          isValidType = isNumber(value);
          break;
        case 'boolean':
          isValidType = isBoolean(value);
          break;
        case 'object':
          isValidType = isObject(value);
          break;
        case 'array':
          isValidType = isArray(value);
          break;
        case 'date':
          isValidType = isDate(value) || isDateString(value);
          break;
        case 'uuid':
          isValidType = isUUID(value);
          break;
        case 'email':
          isValidType = isEmail(value);
          break;
      }

      if (!isValidType) {
        errors.push(rules.message || `${key} must be a ${rules.type}`);
        continue;
      }
    }

    // Check string constraints
    if (isString(value)) {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push(rules.message || `${key} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(rules.message || `${key} must be at most ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(rules.message || `${key} format is invalid`);
      }
    }

    // Check number constraints
    if (isNumber(value)) {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(rules.message || `${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(rules.message || `${key} must be at most ${rules.max}`);
      }
    }

    // Validate array items
    if (isArray(value) && rules.items) {
      for (let i = 0; i < value.length; i++) {
        const itemValidation = validateObject(value[i], rules.items);
        if (!itemValidation.valid) {
          errors.push(...itemValidation.errors.map((err) => `${key}[${i}].${err}`));
        }
      }
    }

    // Validate nested object properties
    if (isObject(value) && rules.properties) {
      const nestedValidation = validateObject(value, rules.properties);
      if (!nestedValidation.valid) {
        errors.push(...nestedValidation.errors.map((err) => `${key}.${err}`));
      }
    }

    // Custom validator
    if (rules.validator && !rules.validator(value)) {
      errors.push(rules.message || `${key} is invalid`);
    }
  }

  return { valid: errors.length === 0, errors };
}
