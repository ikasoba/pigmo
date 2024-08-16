import { PigmoCollection } from "./PigmoCollection.js";

export interface PigmoSchema<T> {
  primaryKey: string;
  properties?: {
    [K in keyof T]?: {
      isIndexed?: boolean;
    }
  }
}

export interface PigmoEngine {
  createCollection<T>(name: string, schema: PigmoSchema<T>): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  getCollection<T>(name: string): Promise<PigmoCollection<T> | null>;
  hasCollection(name: string): Promise<boolean>;

  updateCollectionSchema<T>(name: string, schema: PigmoSchema<T>): Promise<PigmoSchema<T> | null>;
  getCollectionSchema<T>(name: string): Promise<PigmoSchema<T> | null>;
}

export interface PigmoOptions<T> {
  engine: PigmoEngine;
  collections: {
    [K in keyof T]: PigmoSchema<T[K]>;
  }
}

export function schema<T>(schema: PigmoSchema<T>) {
  return schema;
}

export class Pigmo<T> {
  private engine: PigmoEngine;
  private cache: { [ K in keyof T ]?: PigmoCollection<T[K]> } = {};

  static async create<T>(options: PigmoOptions<T>) {
    for (const name in options.collections) {
      if (await options.engine.hasCollection(name)) {
        await options.engine.updateCollectionSchema(name, options.collections[name]);
      } else {
        await options.engine.createCollection(name, options.collections[name]);
      }
    }

    return new Pigmo(options);
  }
  
  private constructor(options: PigmoOptions<T>) {
    this.engine = options.engine;
  }

  async getCollection<K extends Extract<keyof T, string>>(name: K): Promise<PigmoCollection<T[K]>> {
    const collection = this.cache[name] ?? await this.engine.getCollection<T[K]>(name);
    if (collection == null) {
      throw new Error(`Collection ${name} is not exists.`);
    }

    this.cache[name] = collection;

    return collection;    
  }
}
