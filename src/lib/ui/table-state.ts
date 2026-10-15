export function pageOptions(params:URLSearchParams){
  const rawSize=Number(params.get('size'));const size=[10,25,50].includes(rawSize)?rawSize:10;
  const rawPage=Number(params.get('page')??1);const page=Number.isSafeInteger(rawPage)&&rawPage>0&&rawPage<=100000?rawPage:1;
  return {size,page};
}
export function tableView<T>(rows:T[], values:(row:T)=>string[], options:{query:string;filter:string;filterColumn:number;sortColumn:number;direction:'asc'|'desc';page:number;size:number}) {
  const query=options.query.trim().toLocaleLowerCase('id');
  const ordered=options.sortColumn>=0 ? [...rows].sort((a,b)=>{const result=(values(a)[options.sortColumn]??'').localeCompare(values(b)[options.sortColumn]??'','id',{numeric:true,sensitivity:'base'});return options.direction==='asc'?result:-result}) : rows;
  const filtered=ordered.filter(row=>{const cells=values(row);return (!query || cells.join(' ').toLocaleLowerCase('id').includes(query)) && (!options.filter || cells[options.filterColumn]===options.filter)});
  const size=[10,25,50].includes(options.size)?options.size:10;
  const pages=Math.max(1,Math.ceil(filtered.length/size));
  const page=Math.min(pages,Math.max(1,Number.isSafeInteger(options.page)?options.page:1));
  return {rows:filtered.slice((page-1)*size,page*size),ordered,total:filtered.length,page,pages,size};
}
