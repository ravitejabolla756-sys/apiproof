export interface ContractDifference { path:string; change:'added'|'removed'|'changed'|'preserved'; matched:boolean; observed?:unknown; expected?:unknown }
