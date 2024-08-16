import { Instruction } from "./PigmoQuery.js";
export interface PigmoCollection<T> {
    exec(instr: Instruction<T>): Promise<T[]>;
}
