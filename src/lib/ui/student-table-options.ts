import {pageOptions} from './table-state';
export function studentTableOptions(params:URLSearchParams){
 const {size,page}=pageOptions(params);
 const rawSort=params.get('sort')??'name';const sort=['name','nisn','className'].includes(rawSort)?rawSort:'name';
 const dir=params.get('dir')==='desc'?'desc':'asc';
 return {size,page,sort,dir} as {size:number;page:number;sort:'name'|'nisn'|'className';dir:'asc'|'desc'};
}
