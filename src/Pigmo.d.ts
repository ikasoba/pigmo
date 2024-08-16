import { PigmoCollection } from "./PigmoCollection.js";
export interface PigmoSchema<T> {
    primaryKey: string;
    properties?: {
        [K in keyof T]?: {
            isIndexed?: boolean;
        };
    };
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
    };
}
export declare function schema<T>(schema: PigmoSchema<T>): PigmoSchema<T>;
export declare class Pigmo<T> {
    private engine;
    private cache;
    static create<T>(options: PigmoOptions<T>): Promise<Pigmo<T>>;
    private constructor();
    getCollection<K extends Extract<keyof T, string>>(name: K): Promise<PigmoCollection<T[K]>>;
}
