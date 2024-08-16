import type { Database } from "sqlite3";
import { PigmoEngine, PigmoSchema } from "../Pigmo.js";
import { PigmoCollection } from "../PigmoCollection.js";
import { Instruction, Query } from "../PigmoQuery.js";
export interface Sqlite3EngineOptions {
    path: string;
}
export declare class Sqlite3Collection<T> implements PigmoCollection<T> {
    private db;
    private name;
    private properties;
    constructor(db: Database, name: string, properties: string[]);
    queryToExpression<T>(isTopLevel: boolean, expr: string, values: unknown[], query: Query<T>): string;
    exec(instr: Instruction<T>): Promise<T[]>;
}
export declare class Sqlite3Engine implements PigmoEngine {
    private db;
    constructor(options: Sqlite3EngineOptions);
    createCollection<T>(name: string, schema: PigmoSchema<T>): Promise<void>;
    hasCollection(name: string): Promise<boolean>;
    deleteCollection(name: string): Promise<void>;
    getCollectionSchema<T>(name: string): Promise<PigmoSchema<T> | null>;
    getCollection<T>(name: string): Promise<PigmoCollection<T> | null>;
    updateCollectionSchema<T>(name: string, schema: PigmoSchema<T>): Promise<PigmoSchema<T> | null>;
}
