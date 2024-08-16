export type Literal = string | number | Date | boolean | null;
export type Operator<T> = {
    $eq: T;
} | {
    $ne: T;
} | {
    $lt: T & (number | Date);
} | {
    $gt: T & (number | Date);
} | {
    $lte: T & (number | Date);
} | {
    $gte: T & (number | Date);
} | (T extends string ? {
    $regex: RegExp;
} : never) | (T extends string ? {
    $search: string;
} : never) | {
    $in: T[];
} | {
    $or: Query<T>[];
} | {
    $and: Query<T>[];
};
export type Query<T> = unknown extends T ? Operator<Literal> : T extends Literal ? Operator<T> : {
    [K in keyof T]: {
        [_ in K]: Query<T[K]>;
    };
}[keyof T];
export declare const enum InstructionKind {
    Filter = 0,
    Insert = 1,
    Update = 2,
    Upsert = 3,
    Remove = 4
}
export interface FilterInstruction<T> {
    kind: InstructionKind.Filter;
    where: Query<T>;
    offset?: number;
    max?: number;
    sortBy?: {
        [K in keyof T]?: "ASC" | "DESC";
    };
}
export interface InsertInstruction<T> {
    kind: InstructionKind.Insert;
    values: T[];
}
export interface UpdateInstruction<T> {
    kind: InstructionKind.Update;
    sets: {
        [K in keyof T]: {
            [_ in K]: T[K];
        };
    }[keyof T];
    where: Query<T>;
}
export interface UpsertInstruction<T> {
    kind: InstructionKind.Upsert;
    sets: {
        [K in keyof T]: {
            [_ in K]: T[K];
        };
    }[keyof T];
    where: Query<T>;
}
export interface RemoveInstruction<T> {
    kind: InstructionKind.Remove;
    where: Query<T>;
}
export type Instruction<T> = FilterInstruction<T> | InsertInstruction<T> | UpdateInstruction<T> | UpsertInstruction<T> | RemoveInstruction<T>;
export declare function $filter<T, I extends FilterInstruction<T>>(instr: Omit<I, "kind">): FilterInstruction<T>;
export declare function $insert<T, I extends InsertInstruction<T>>(instr: Omit<I, "kind">): InsertInstruction<T>;
export declare function $update<T, I extends UpdateInstruction<T>>(instr: Omit<I, "kind">): UpdateInstruction<T>;
export declare function $upsert<T, I extends UpsertInstruction<T>>(instr: Omit<I, "kind">): UpsertInstruction<T>;
export declare function $remove<T, I extends RemoveInstruction<T>>(instr: Omit<I, "kind">): RemoveInstruction<T>;
