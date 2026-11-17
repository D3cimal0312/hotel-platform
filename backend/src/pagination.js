import {z} from 'zod'; 

// query-string values arrive as text, soz.coerce turn them into numbers, and validate them
export const paginationFields={
    page:z.coerce.number().int().min(1).default(1),
    pageSize:z.coerce.number().int().min(1).max(100).default(10),
}