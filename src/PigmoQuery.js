export function $filter(instr) {
    return {
        kind: 0 /* InstructionKind.Filter */,
        ...instr
    };
}
export function $insert(instr) {
    return {
        kind: 1 /* InstructionKind.Insert */,
        ...instr
    };
}
export function $update(instr) {
    return {
        kind: 2 /* InstructionKind.Update */,
        ...instr
    };
}
export function $upsert(instr) {
    return {
        kind: 3 /* InstructionKind.Upsert */,
        ...instr
    };
}
export function $remove(instr) {
    return {
        kind: 4 /* InstructionKind.Remove */,
        ...instr
    };
}
