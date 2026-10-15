import {tableView} from './table-state';
export function initDataTables(){
  for(const root of document.querySelectorAll<HTMLElement>('[data-ui-table][data-mode=client]')){
    if(root.dataset.initialized)continue;root.dataset.initialized='true';
    const table=root.querySelector('table');const body=table?.tBodies[0];if(!table||!body)continue;
    const search=root.querySelector<HTMLInputElement>('[data-table-search]')!;
    const size=root.querySelector<HTMLSelectElement>('[data-table-size]')!;
    const filter=root.querySelector<HTMLSelectElement>('[data-table-filter]');
    const prev=root.querySelector<HTMLButtonElement>('[data-table-prev]')!;
    const next=root.querySelector<HTMLButtonElement>('[data-table-next]')!;
    const filterColumn=Number(root.dataset.filterColumn??-1);
    let page=1,sortColumn=-1,direction:'asc'|'desc'='asc';
    const cells=(row:HTMLTableRowElement)=>[...row.cells].map(cell=>(cell.textContent??'').trim());
    const rows=()=>[...body.rows].filter(row=>!row.querySelector('td[colspan]'));
    const observer=new MutationObserver(()=>{fillFilter();render()});
    function fillFilter(){if(!filter)return;const current=filter.value;filter.replaceChildren(new Option('Semua',''));for(const value of [...new Set(rows().map(row=>cells(row)[filterColumn]??''))].filter(Boolean).sort())filter.add(new Option(value,value));filter.value=current;}
    function render(){
      observer.disconnect();
      const all=rows();const view=tableView(all,cells,{query:search.value,filter:filter?.value??'',filterColumn,sortColumn,direction,page,size:Number(size.value)});
      page=view.page;
      for(const row of all)row.hidden=!view.rows.includes(row);
      if(sortColumn>=0)for(const row of view.ordered)body.append(row);
      const empty=all.length>0&&view.total===0;
      root.querySelector<HTMLElement>('[data-table-empty]')!.hidden=!empty;
      root.querySelector<HTMLElement>('[data-table-count]')!.textContent=`${view.total ? (page-1)*view.size+1 : 0}–${Math.min(page*view.size,view.total)} dari ${view.total} data${view.total!==all.length ? ' (total '+all.length+')' : ''}`;
      root.querySelector<HTMLElement>('[data-table-page]')!.textContent=`${page} / ${view.pages}`;
      prev.disabled=page<=1;next.disabled=page>=view.pages;
      root.querySelectorAll<HTMLElement>('[data-table-controls]').forEach(control=>control.hidden=all.length===0);
      observer.observe(body,{childList:true});
    }
    [...table.tHead?.rows[0].cells??[]].forEach((header,index)=>{
      header.scope='col';if(header.querySelector('a,input')||!header.textContent?.trim()||/^(aksi|tindakan|pilih)$/i.test(header.textContent.trim()))return;
      const button=document.createElement('button');button.type='button';button.className='table-sort-button';button.textContent=header.textContent;header.replaceChildren(button);
      button.addEventListener('click',()=>{direction=sortColumn===index&&direction==='asc'?'desc':'asc';sortColumn=index;page=1;table.querySelectorAll('th[aria-sort]').forEach(th=>th.removeAttribute('aria-sort'));header.setAttribute('aria-sort',direction==='asc'?'ascending':'descending');render()});
    });
    search.addEventListener('input',()=>{page=1;render()});filter?.addEventListener('change',()=>{page=1;render()});size.addEventListener('change',()=>{page=1;render()});
    prev.addEventListener('click',()=>{page--;render()});next.addEventListener('click',()=>{page++;render()});fillFilter();render();
  }
}
